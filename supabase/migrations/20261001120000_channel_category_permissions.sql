-- Migration: 20261001120000_channel_category_permissions.sql
-- LYC Arena: Sistema Real de Cargos e Permissões - Fase 2
-- Permissões por Canal, Categoria, Canais Privados, Herança e Sincronização

-- 1. Estender public.channels com sync_permissions
alter table public.channels add column if not exists sync_permissions boolean not null default true;

-- 2. Tabela de overrides específicos de canal
create table if not exists public.channel_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  target_type text not null check(target_type in ('role', 'member')),
  role_id uuid references public.community_roles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  permission text not null references public.permissions(name) on delete cascade,
  state text not null check(state in ('allow', 'deny')),
  created_at timestamptz not null default now(),
  check (
    (target_type = 'role' and role_id is not null and user_id is null) or
    (target_type = 'member' and user_id is not null and role_id is null)
  )
);

create unique index if not exists channel_override_role_idx
  on public.channel_permission_overrides(channel_id, role_id, permission)
  where target_type = 'role';

create unique index if not exists channel_override_member_idx
  on public.channel_permission_overrides(channel_id, user_id, permission)
  where target_type = 'member';

create index if not exists channel_overrides_channel_idx on public.channel_permission_overrides(channel_id);
create index if not exists channel_overrides_community_idx on public.channel_permission_overrides(community_id);

-- 3. Tabela de overrides específicos de categoria
create table if not exists public.category_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  category_id uuid not null references public.channel_categories(id) on delete cascade,
  target_type text not null check(target_type in ('role', 'member')),
  role_id uuid references public.community_roles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  permission text not null references public.permissions(name) on delete cascade,
  state text not null check(state in ('allow', 'deny')),
  created_at timestamptz not null default now(),
  check (
    (target_type = 'role' and role_id is not null and user_id is null) or
    (target_type = 'member' and user_id is not null and role_id is null)
  )
);

create unique index if not exists category_override_role_idx
  on public.category_permission_overrides(category_id, role_id, permission)
  where target_type = 'role';

create unique index if not exists category_override_member_idx
  on public.category_permission_overrides(category_id, user_id, permission)
  where target_type = 'member';

create index if not exists category_overrides_cat_idx on public.category_permission_overrides(category_id);
create index if not exists category_overrides_comm_idx on public.category_permission_overrides(community_id);

-- 4. RLS e Permissões de Leitura
alter table public.channel_permission_overrides enable row level security;
revoke all on public.channel_permission_overrides from public, anon, authenticated;
grant select on public.channel_permission_overrides to authenticated;

drop policy if exists channel_overrides_read on public.channel_permission_overrides;
create policy channel_overrides_read on public.channel_permission_overrides
  for select to authenticated using (private.is_community_member(community_id));

alter table public.category_permission_overrides enable row level security;
revoke all on public.category_permission_overrides from public, anon, authenticated;
grant select on public.category_permission_overrides to authenticated;

drop policy if exists category_overrides_read on public.category_permission_overrides;
create policy category_overrides_read on public.category_permission_overrides
  for select to authenticated using (private.is_community_member(community_id));

-- Realtime
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'channel_permission_overrides') then
    alter publication supabase_realtime add table public.channel_permission_overrides;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'category_permission_overrides') then
    alter publication supabase_realtime add table public.category_permission_overrides;
  end if;
end $$;

drop trigger if exists channel_overrides_revision on public.channel_permission_overrides;
create trigger channel_overrides_revision
  after insert or update or delete on public.channel_permission_overrides
  for each row execute function private.community_revision();

drop trigger if exists category_overrides_revision on public.category_permission_overrides;
create trigger category_overrides_revision
  after insert or update or delete on public.category_permission_overrides
  for each row execute function private.community_revision();

-- 5. Função Central de Resolução de Permissões de Canal em SQL
create or replace function private.channel_permission(target_channel_id uuid, perm text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  comm_id uuid;
  cat_id uuid;
  is_synced boolean;
  ch_is_private boolean;
  is_owner boolean;
  has_admin boolean;
  is_mem boolean;
  everyone_rid uuid;
  mem_override text;
  role_allowed boolean;
  role_denied boolean;
  everyone_override text;
begin
  if uid is null or not private.active_user() then
    return false;
  end if;

  select c.community_id, c.category_id, coalesce(c.sync_permissions, true), coalesce(c.is_private, false)
  into comm_id, cat_id, is_synced, ch_is_private
  from public.channels c
  where c.id = target_channel_id and c.deleted_at is null;

  if comm_id is null then
    return false;
  end if;

  -- Checar associação ativa à comunidade
  select exists(
    select 1 from public.community_members m
    where m.community_id = comm_id and m.user_id = uid and m.left_at is null
  ) into is_mem;
  if not is_mem then
    return false;
  end if;

  -- 1. Proprietário possui acesso irrestrito total
  select exists(
    select 1 from public.communities com
    where com.id = comm_id and com.owner_id = uid
  ) into is_owner;
  if is_owner then
    return true;
  end if;

  -- 2. Cargo com 'administrator' possui acesso irrestrito total
  select exists(
    select 1 from public.community_role_permissions crp
    where crp.community_id = comm_id
      and crp.permission = 'administrator'
      and (
        crp.role_id in (select cmr.role_id from public.community_member_roles cmr where cmr.community_id = comm_id and cmr.user_id = uid)
        or crp.role_id in (select cm.role_id from public.community_members cm where cm.community_id = comm_id and cm.user_id = uid and cm.left_at is null)
      )
  ) into has_admin;
  if has_admin then
    return true;
  end if;

  -- Cargo padrão @todos da comunidade
  select id into everyone_rid
  from public.community_roles
  where community_id = comm_id and (is_default or base_role = 'MEMBER') and deleted_at is null
  limit 1;

  -- A. OVERRIDES DO CANAL
  -- 3. Override específico de membro no canal
  select state into mem_override
  from public.channel_permission_overrides
  where channel_id = target_channel_id and target_type = 'member' and user_id = uid and permission = perm;

  if mem_override = 'deny' then return false; end if;
  if mem_override = 'allow' then return true; end if;

  -- 4. Overrides dos cargos atribuídos no canal
  select
    exists(
      select 1 from public.channel_permission_overrides cpo
      where cpo.channel_id = target_channel_id
        and cpo.target_type = 'role'
        and cpo.permission = perm
        and cpo.state = 'allow'
        and (
          cpo.role_id in (select cmr.role_id from public.community_member_roles cmr where cmr.community_id = comm_id and cmr.user_id = uid)
          or cpo.role_id in (select cm.role_id from public.community_members cm where cm.community_id = comm_id and cm.user_id = uid and cm.left_at is null)
        )
        and cpo.role_id <> everyone_rid
    ),
    exists(
      select 1 from public.channel_permission_overrides cpo
      where cpo.channel_id = target_channel_id
        and cpo.target_type = 'role'
        and cpo.permission = perm
        and cpo.state = 'deny'
        and (
          cpo.role_id in (select cmr.role_id from public.community_member_roles cmr where cmr.community_id = comm_id and cmr.user_id = uid)
          or cpo.role_id in (select cm.role_id from public.community_members cm where cm.community_id = comm_id and cm.user_id = uid and cm.left_at is null)
        )
        and cpo.role_id <> everyone_rid
    )
  into role_allowed, role_denied;

  if role_allowed then return true; end if;
  if role_denied then return false; end if;

  -- 5. Override de @todos no canal
  select state into everyone_override
  from public.channel_permission_overrides
  where channel_id = target_channel_id and target_type = 'role' and role_id = everyone_rid and permission = perm;

  if everyone_override = 'deny' then return false; end if;
  if everyone_override = 'allow' then return true; end if;

  -- B. SE O CANAL FOR SINCRONIZADO COM CATEGORIA: HERDAR DA CATEGORIA
  if is_synced and cat_id is not null then
    -- 6. Override de membro na categoria
    select state into mem_override
    from public.category_permission_overrides
    where category_id = cat_id and target_type = 'member' and user_id = uid and permission = perm;

    if mem_override = 'deny' then return false; end if;
    if mem_override = 'allow' then return true; end if;

    -- 7. Overrides de cargos atribuídos na categoria
    select
      exists(
        select 1 from public.category_permission_overrides cpo
        where cpo.category_id = cat_id
          and cpo.target_type = 'role'
          and cpo.permission = perm
          and cpo.state = 'allow'
          and (
            cpo.role_id in (select cmr.role_id from public.community_member_roles cmr where cmr.community_id = comm_id and cmr.user_id = uid)
            or cpo.role_id in (select cm.role_id from public.community_members cm where cm.community_id = comm_id and cm.user_id = uid and cm.left_at is null)
          )
          and cpo.role_id <> everyone_rid
      ),
      exists(
        select 1 from public.category_permission_overrides cpo
        where cpo.category_id = cat_id
          and cpo.target_type = 'role'
          and cpo.permission = perm
          and cpo.state = 'deny'
          and (
            cpo.role_id in (select cmr.role_id from public.community_member_roles cmr where cmr.community_id = comm_id and cmr.user_id = uid)
            or cpo.role_id in (select cm.role_id from public.community_members cm where cm.community_id = comm_id and cm.user_id = uid and cm.left_at is null)
          )
          and cpo.role_id <> everyone_rid
      )
    into role_allowed, role_denied;

    if role_allowed then return true; end if;
    if role_denied then return false; end if;

    -- 8. Override de @todos na categoria
    select state into everyone_override
    from public.category_permission_overrides
    where category_id = cat_id and target_type = 'role' and role_id = everyone_rid and permission = perm;

    if everyone_override = 'deny' then return false; end if;
    if everyone_override = 'allow' then return true; end if;
  end if;

  -- C. PERMISSÕES BASE DA COMUNIDADE
  return private.community_permission(comm_id, perm);
end $$;

-- 6. Atualizar can_read_channel e can_write_channel
create or replace function private.can_read_channel(cid uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.active_user()
    and private.channel_permission(cid, 'view_channels')
    and not exists(
      select 1 from public.moderation_actions
      where user_id = auth.uid() and channel_id = cid and kind = 'REMOVE_CHANNEL'
        and (expires_at is null or expires_at > now())
    );
$$;

create or replace function private.can_write_channel(cid uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.can_read_channel(cid)
    and private.channel_permission(
      cid,
      case when (select kind from public.channels where id = cid) = 'voice' then 'connect_voice' else 'send_messages' end
    )
    and not exists(
      select 1 from public.moderation_actions
      where user_id = auth.uid() and kind = 'MUTE' and (channel_id is null or channel_id = cid)
        and (expires_at is null or expires_at > now())
    );
$$;

create or replace function public.can_join_voice(channel_id uuid)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from public.channels where id = channel_id and kind = 'voice' and private.can_write_channel(id));
$$;

create or replace function public.voice_channel_permissions(channel_id uuid)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object(
    'connect', public.can_join_voice(channel_id),
    'speak', private.channel_permission(channel_id, 'speak'),
    'video', private.channel_permission(channel_id, 'video'),
    'share_screen', private.channel_permission(channel_id, 'share_screen')
  ) from public.channels where id = channel_id and kind = 'voice';
$$;

-- 7. Atualizar community_command com suporte a canais privados, overrides e sincronização
create or replace function private.community_command(action text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  rid uuid;
  item uuid;
  target uuid;
  invitation public.community_invites;
  result jsonb;
  owner_uid uuid;
  label text;
  actor_position integer;
  target_position integer;
  subject public.community_roles;
  new_position integer;
  wanted text[];
  ids uuid[];
  expected integer;
  highest_role uuid;
  i integer;

  -- Phase 2 variables
  ch_id uuid;
  cat_id uuid;
  tgt_type text;
  tgt_role_id uuid;
  tgt_user_id uuid;
  perm_key text;
  perm_state text;
  perm_obj jsonb;
  everyone_id uuid;
begin
  if uid is null or not private.active_user() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if action = 'create' then
    insert into public.communities(name, image_url, owner_id)
    values (trim(payload->>'name'), nullif(payload->>'image_url', ''), uid)
    returning id into cid;
    insert into public.channel_categories(community_id, name) values (cid, 'Canais');
    return to_jsonb(cid);
  end if;

  if action = 'join' then
    select community_id into cid from public.community_invites where code = payload->>'code';
    perform 1 from public.communities where id = cid for update;
    select * into invitation from public.community_invites where code = payload->>'code' for update;
    if not found or invitation.revoked_at is not null or (invitation.expires_at is not null and invitation.expires_at <= now()) then
      raise exception 'Convite inválido ou expirado';
    end if;
    cid := invitation.community_id;
    if exists(select 1 from public.community_members where community_id = cid and user_id = uid and left_at is null) then
      return to_jsonb(cid);
    end if;
    if invitation.max_uses is not null and invitation.uses >= invitation.max_uses then
      raise exception 'Convite esgotado';
    end if;
    select id into rid from public.community_roles where community_id = cid and (is_default or base_role = 'MEMBER') and deleted_at is null limit 1;
    insert into public.community_members(community_id, user_id, role_id)
    values (cid, uid, rid)
    on conflict (community_id, user_id) do update set role_id = excluded.role_id, joined_at = now(), left_at = null;
    update public.community_invites set uses = uses + 1 where code = invitation.code;
    return to_jsonb(cid);
  end if;

  cid := (payload->>'community_id')::uuid;
  perform 1 from public.communities where id = cid for update;
  if not private.is_community_member(cid) then
    raise exception 'Community access denied' using errcode = '42501';
  end if;
  select owner_id into owner_uid from public.communities where id = cid;

  -- Calcular ator position
  if uid = owner_uid then
    actor_position := 100;
  else
    select coalesce(max(r.position), 0) into actor_position
    from public.community_roles r
    where r.community_id = cid and r.deleted_at is null and (
      r.id in (select cmr.role_id from public.community_member_roles cmr where cmr.community_id = cid and cmr.user_id = uid)
      or r.id in (select cm.role_id from public.community_members cm where cm.community_id = cid and cm.user_id = uid and cm.left_at is null)
    );
  end if;

  if action = 'leave' then
    if owner_uid = uid then
      raise exception 'O proprietário precisa transferir a comunidade antes de sair';
    end if;
    update public.community_members set left_at = now() where community_id = cid and user_id = uid;
    return 'true';

  elsif action = 'edit_community' then
    if not private.community_permission(cid, 'manage_community') then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    update public.communities
    set name = trim(payload->>'name'),
        image_url = nullif(payload->>'image_url', '')
    where id = cid;

  elsif action = 'invite' then
    if not private.community_permission(cid, 'create_invites') then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    if (payload->>'expires_at')::timestamptz <= now() then
      raise exception 'Expiration must be in the future';
    end if;
    insert into public.community_invites(community_id, created_by, expires_at, max_uses)
    values (cid, uid, (payload->>'expires_at')::timestamptz, (payload->>'max_uses')::integer)
    returning to_jsonb(community_invites) into result;
    return result;

  elsif action = 'revoke_invite' then
    if not private.community_permission(cid, 'create_invites') then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    update public.community_invites set revoked_at = now()
    where community_id = cid and code = payload->>'code';

  elsif action = 'transfer_ownership' then
    if uid <> owner_uid then
      raise exception 'Only the owner can transfer ownership' using errcode = '42501';
    end if;
    if payload->>'confirm_name' is distinct from (select name from public.communities where id = cid) then
      raise exception 'Confirme o nome da comunidade para transferir a propriedade';
    end if;
    target := (payload->>'user_id')::uuid;
    if target = uid or not exists(select 1 from public.community_members where community_id = cid and user_id = target and left_at is null) then
      raise exception 'Invalid successor';
    end if;
    update public.community_members
    set role_id = (select id from public.community_roles where community_id = cid and base_role = 'ADMIN' and deleted_at is null limit 1)
    where community_id = cid and user_id = uid;
    update public.community_members
    set role_id = (select id from public.community_roles where community_id = cid and base_role = 'OWNER' and deleted_at is null limit 1)
    where community_id = cid and user_id = target;
    update public.communities set owner_id = target where id = cid;

  -- ========================================================
  -- GESTÃO DE CARGOS E PERMISSÕES (FASE 1)
  -- ========================================================
  elsif action in ('create_role', 'edit_role', 'delete_role', 'reorder_roles', 'assign_role', 'remove_role', 'add_member_role', 'remove_member_role') then
    if not private.community_permission(cid, 'manage_roles') then
      raise exception 'Permission denied' using errcode = '42501';
    end if;

    if action = 'create_role' then
      new_position := coalesce((payload->>'position')::integer, 1);
      if new_position < 1 or new_position >= 100 then
        raise exception 'Prioridade inválida (1–99; @todos permanece em 0)';
      end if;
      if uid <> owner_uid and new_position >= actor_position then
        raise exception 'Role hierarchy denied' using errcode = '42501';
      end if;

      if jsonb_typeof(payload->'permissions') is distinct from 'array' then
        raise exception 'Permissions array required';
      end if;
      select coalesce(array_agg(distinct value), '{}') into wanted
      from jsonb_array_elements_text(payload->'permissions');

      if exists(select 1 from unnest(wanted) p where not exists(select 1 from public.permissions where name = p)) then
        raise exception 'Unknown permission';
      end if;
      if uid <> owner_uid and not private.community_permission(cid, 'administrator') and exists(
        select 1 from unnest(wanted) p where not private.community_permission(cid, p)
      ) then
        raise exception 'Cannot grant permissions you do not have' using errcode = '42501';
      end if;

      insert into public.community_roles (community_id, name, color, position, is_default)
      values (
        cid,
        trim(payload->>'name'),
        coalesce(nullif(trim(payload->>'color'), ''), '#99aab5'),
        new_position,
        false
      ) returning id into rid;

      insert into public.community_role_permissions (community_id, role_id, permission)
      select cid, rid, p from unnest(wanted) p;

      return to_jsonb(rid);

    elsif action = 'edit_role' then
      rid := coalesce((payload->>'id')::uuid, (payload->>'role_id')::uuid);
      select * into subject from public.community_roles where id = rid and community_id = cid and deleted_at is null;
      if not found then raise exception 'Role not found'; end if;
      if subject.base_role = 'OWNER' then raise exception 'Owner role is protected' using errcode = '42501'; end if;
      if uid <> owner_uid and subject.position >= actor_position then
        raise exception 'Role hierarchy denied' using errcode = '42501';
      end if;

      new_position := coalesce((payload->>'position')::integer, subject.position);
      if coalesce(subject.is_default, false) or coalesce(subject.base_role, '') = 'MEMBER' then
        if new_position <> 0 then
          raise exception 'Prioridade inválida (0–99; Membro permanece em 0)';
        end if;
        new_position := 0;
      else
        if new_position < 1 or new_position >= 100 then
          raise exception 'Prioridade inválida (1–99; @todos permanece em 0)';
        end if;
        if uid <> owner_uid and new_position >= actor_position then
          raise exception 'Role hierarchy denied' using errcode = '42501';
        end if;
      end if;

      if payload ? 'permissions' then
        if jsonb_typeof(payload->'permissions') is distinct from 'array' then
          raise exception 'Permissions array required';
        end if;
        select coalesce(array_agg(distinct value), '{}') into wanted
        from jsonb_array_elements_text(payload->'permissions');

        if exists(select 1 from unnest(wanted) p where not exists(select 1 from public.permissions where name = p)) then
          raise exception 'Unknown permission';
        end if;
        if uid <> owner_uid and not private.community_permission(cid, 'administrator') and exists(
          select 1 from unnest(wanted) p where not private.community_permission(cid, p)
        ) then
          raise exception 'Cannot grant permissions you do not have' using errcode = '42501';
        end if;

        delete from public.community_role_permissions where role_id = rid and community_id = cid;
        insert into public.community_role_permissions (community_id, role_id, permission)
        select cid, rid, p from unnest(wanted) p;
      end if;

      update public.community_roles
      set name = coalesce(nullif(trim(payload->>'name'), ''), name),
          color = coalesce(nullif(trim(payload->>'color'), ''), color),
          position = new_position,
          updated_at = now()
      where id = rid;

      return to_jsonb(rid);

    elsif action = 'delete_role' then
      rid := coalesce((payload->>'id')::uuid, (payload->>'role_id')::uuid);
      select * into subject from public.community_roles where id = rid and community_id = cid and deleted_at is null;
      if not found then raise exception 'Role not found'; end if;
      if coalesce(subject.base_role, '') = 'OWNER' or coalesce(subject.is_default, false) or coalesce(subject.base_role, '') = 'MEMBER' then
        raise exception 'Os cargos padrão não podem ser excluídos';
      end if;
      if uid <> owner_uid and subject.position >= actor_position then
        raise exception 'Role hierarchy denied' using errcode = '42501';
      end if;

      update public.community_roles set deleted_at = now() where id = rid;
      delete from public.community_member_roles where community_id = cid and role_id = rid;
      delete from public.community_role_permissions where community_id = cid and role_id = rid;

      update public.community_members m
      set role_id = coalesce(
        (
          select cmr.role_id from public.community_member_roles cmr
          join public.community_roles cr on cr.id = cmr.role_id
          where cmr.community_id = cid and cmr.user_id = m.user_id and cr.deleted_at is null
          order by cr.position desc limit 1
        ),
        (select id from public.community_roles where community_id = cid and (is_default or base_role = 'MEMBER') and deleted_at is null limit 1)
      )
      where m.community_id = cid and m.role_id = rid;

      return 'true';

    elsif action = 'reorder_roles' then
      if jsonb_typeof(payload->'ids') is distinct from 'array' then
        raise exception 'IDs array required';
      end if;
      select coalesce(array_agg(value::uuid), '{}') into ids from jsonb_array_elements_text(payload->'ids');
      for i in 1..cardinality(ids) loop
        select * into subject from public.community_roles where id = ids[i] and community_id = cid and deleted_at is null;
        if found and not coalesce(subject.is_default, false) and coalesce(subject.base_role, '') not in ('MEMBER', 'OWNER') then
          new_position := cardinality(ids) - i + 1;
          if uid = owner_uid or (subject.position < actor_position and new_position < actor_position) then
            update public.community_roles set position = new_position, updated_at = now() where id = ids[i];
          end if;
        end if;
      end loop;
      return 'true';

    elsif action in ('assign_role', 'add_member_role') then
      target := (payload->>'user_id')::uuid;
      rid := coalesce((payload->>'role_id')::uuid, (payload->>'id')::uuid);

      if target = owner_uid or (uid <> owner_uid and target = uid) then
        raise exception 'Protected member' using errcode = '42501';
      end if;

      select * into subject from public.community_roles where id = rid and community_id = cid and deleted_at is null;
      if not found then raise exception 'Role not found'; end if;
      if coalesce(subject.base_role, '') = 'OWNER' then raise exception 'Invalid role assignment'; end if;

      if uid <> owner_uid then
        select coalesce(max(r.position), 0) into target_position
        from public.community_roles r
        where r.community_id = cid and r.deleted_at is null and (
          r.id in (select cmr.role_id from public.community_member_roles cmr where cmr.community_id = cid and cmr.user_id = target)
          or r.id in (select cm.role_id from public.community_members cm where cm.community_id = cid and cm.user_id = target and cm.left_at is null)
        );

        if target_position >= actor_position or subject.position >= actor_position then
          raise exception 'Role hierarchy denied' using errcode = '42501';
        end if;

        if not private.community_permission(cid, 'administrator') and exists(
          select 1 from public.community_role_permissions where role_id = rid and community_id = cid and not private.community_permission(cid, permission)
        ) then
          raise exception 'Cannot grant permissions you do not have' using errcode = '42501';
        end if;
      end if;

      if not (coalesce(subject.is_default, false) or coalesce(subject.base_role, '') = 'MEMBER') then
        insert into public.community_member_roles (community_id, user_id, role_id)
        values (cid, target, rid)
        on conflict do nothing;
      end if;

      select coalesce(
        (
          select cmr.role_id from public.community_member_roles cmr
          join public.community_roles cr on cr.id = cmr.role_id
          where cmr.community_id = cid and cmr.user_id = target and cr.deleted_at is null
          order by cr.position desc limit 1
        ),
        rid
      ) into highest_role;

      update public.community_members set role_id = highest_role
      where community_id = cid and user_id = target and left_at is null;
      if not found then raise exception 'Member not found'; end if;

      return 'true';

    elsif action in ('remove_role', 'remove_member_role') then
      target := (payload->>'user_id')::uuid;
      rid := coalesce((payload->>'role_id')::uuid, (payload->>'id')::uuid);

      if target = owner_uid or (uid <> owner_uid and target = uid) then
        raise exception 'Protected member' using errcode = '42501';
      end if;

      select * into subject from public.community_roles where id = rid and community_id = cid and deleted_at is null;
      if not found then raise exception 'Role not found'; end if;

      if uid <> owner_uid then
        select coalesce(max(r.position), 0) into target_position
        from public.community_roles r
        where r.community_id = cid and r.deleted_at is null and (
          r.id in (select cmr.role_id from public.community_member_roles cmr where cmr.community_id = cid and cmr.user_id = target)
          or r.id in (select cm.role_id from public.community_members cm where cm.community_id = cid and cm.user_id = target and cm.left_at is null)
        );

        if target_position >= actor_position or subject.position >= actor_position then
          raise exception 'Role hierarchy denied' using errcode = '42501';
        end if;
      end if;

      delete from public.community_member_roles
      where community_id = cid and user_id = target and role_id = rid;

      update public.community_members m
      set role_id = coalesce(
        (
          select cmr.role_id from public.community_member_roles cmr
          join public.community_roles cr on cr.id = cmr.role_id
          where cmr.community_id = cid and cmr.user_id = target and cr.deleted_at is null
          order by cr.position desc limit 1
        ),
        (select id from public.community_roles where community_id = cid and (is_default or base_role = 'MEMBER') and deleted_at is null limit 1)
      )
      where m.community_id = cid and m.user_id = target and m.left_at is null;
      if not found then raise exception 'Member not found'; end if;

      return 'true';
    end if;

  -- ========================================================
  -- CANAIS E CATEGORIAS (FASE 2)
  -- ========================================================
  elsif action in ('reorder_categories', 'reorder_channels') then
    if not private.community_permission(cid, 'manage_channels') then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    if jsonb_typeof(payload->'ids') is distinct from 'array' then
      raise exception 'IDs array required';
    end if;
    select coalesce(array_agg(value::uuid), '{}') into ids from jsonb_array_elements_text(payload->'ids');
    if cardinality(ids) <> (select count(distinct v) from unnest(ids) v) then
      raise exception 'Duplicate IDs';
    end if;
    if action = 'reorder_categories' then
      select count(*) into expected from public.channel_categories where community_id = cid and deleted_at is null;
      if cardinality(ids) <> expected or exists(select 1 from unnest(ids) v where not exists(select 1 from public.channel_categories where id = v and community_id = cid and deleted_at is null)) then
        raise exception 'Categories changed; reload';
      end if;
      update public.channel_categories c set position = s.ordinality - 1 from unnest(ids) with ordinality s(id, ordinality) where c.id = s.id and c.community_id = cid;
    else
      item := (payload->>'category_id')::uuid;
      if not exists(select 1 from public.channel_categories where id = item and community_id = cid and deleted_at is null) then
        raise exception 'Invalid category';
      end if;
      select count(*) into expected from public.channels where community_id = cid and category_id = item and deleted_at is null;
      if cardinality(ids) <> expected or exists(select 1 from unnest(ids) v where not exists(select 1 from public.channels where id = v and community_id = cid and category_id = item and deleted_at is null)) then
        raise exception 'Channels changed; reload';
      end if;
      update public.channels c set position = s.ordinality - 1 from unnest(ids) with ordinality s(id, ordinality) where c.id = s.id and c.community_id = cid;
    end if;

  elsif action in ('create_category', 'edit_category', 'delete_category') then
    if not private.community_permission(cid, 'manage_channels') then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    item := nullif(payload->>'id', '')::uuid;
    if action = 'create_category' then
      insert into public.channel_categories(community_id, name, position)
      values (cid, trim(payload->>'name'), coalesce((payload->>'position')::integer, 0))
      returning id into item;
    elsif action = 'edit_category' then
      update public.channel_categories
      set name = trim(payload->>'name'), position = coalesce((payload->>'position')::integer, position)
      where id = item and community_id = cid and deleted_at is null;
      if not found then raise exception 'Category not found'; end if;
      update public.channels set category = trim(payload->>'name') where category_id = item and community_id = cid;
    else
      if exists(select 1 from public.channels where category_id = item and community_id = cid and deleted_at is null) then
        raise exception 'Mova ou exclua os canais antes de excluir a categoria';
      end if;
      update public.channel_categories set deleted_at = now() where id = item and community_id = cid;
      delete from public.category_permission_overrides where category_id = item and community_id = cid;
    end if;
    return to_jsonb(item);

  elsif action in ('create_channel', 'edit_channel', 'delete_channel') then
    if not private.community_permission(cid, 'manage_channels') then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    item := nullif(payload->>'id', '')::uuid;

    if action = 'create_channel' then
      insert into public.channels(
        community_id, name, category, category_id, kind, description, position, is_private, sync_permissions
      ) values (
        cid,
        trim(payload->>'name'),
        '',
        (payload->>'category_id')::uuid,
        payload->>'kind',
        coalesce(payload->>'description', ''),
        coalesce((payload->>'position')::integer, 0),
        coalesce((payload->>'is_private')::boolean, false),
        coalesce((payload->>'sync_permissions')::boolean, not coalesce((payload->>'is_private')::boolean, false))
      ) returning id into item;

      -- Se for canal privado, aplicar override de @everyone (deny view_channels) e allow para os cargos permitidos
      if coalesce((payload->>'is_private')::boolean, false) then
        select id into everyone_id from public.community_roles
        where community_id = cid and (is_default or base_role = 'MEMBER') and deleted_at is null limit 1;

        if everyone_id is not null then
          insert into public.channel_permission_overrides (community_id, channel_id, target_type, role_id, permission, state)
          values (cid, item, 'role', everyone_id, 'view_channels', 'deny')
          on conflict do nothing;
        end if;

        if jsonb_typeof(payload->'private_role_ids') = 'array' then
          insert into public.channel_permission_overrides (community_id, channel_id, target_type, role_id, permission, state)
          select cid, item, 'role', r.val::uuid, 'view_channels', 'allow'
          from jsonb_array_elements_text(payload->'private_role_ids') as r(val)
          where r.val ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          on conflict do nothing;
        end if;
      end if;

    elsif action = 'edit_channel' then
      update public.channels set
        name = coalesce(nullif(trim(payload->>'name'), ''), name),
        category_id = coalesce((payload->>'category_id')::uuid, category_id),
        description = coalesce(payload->>'description', description),
        position = coalesce((payload->>'position')::integer, position),
        is_private = coalesce((payload->>'is_private')::boolean, is_private),
        sync_permissions = coalesce((payload->>'sync_permissions')::boolean, sync_permissions)
      where id = item and community_id = cid and deleted_at is null;
      if not found then raise exception 'Channel not found'; end if;

    else
      update public.channels set deleted_at = now() where id = item and community_id = cid;
      delete from public.channel_permission_overrides where channel_id = item and community_id = cid;
    end if;
    return to_jsonb(item);

  -- ========================================================
  -- GESTÃO DE OVERRIDES DE PERMISSÕES (FASE 2)
  -- ========================================================
  elsif action in ('set_channel_override', 'delete_channel_override', 'sync_channel_permissions') then
    if not (private.community_permission(cid, 'manage_channels') or private.community_permission(cid, 'manage_roles')) then
      raise exception 'Permission denied' using errcode = '42501';
    end if;

    ch_id := (payload->>'channel_id')::uuid;

    if action = 'sync_channel_permissions' then
      -- Remove todos os overrides específicos do canal e marca sync_permissions = true
      delete from public.channel_permission_overrides where channel_id = ch_id and community_id = cid;
      update public.channels set sync_permissions = true where id = ch_id and community_id = cid;
      return 'true';

    elsif action = 'delete_channel_override' then
      tgt_type := payload->>'target_type';
      if tgt_type = 'role' then
        tgt_role_id := (payload->>'target_id')::uuid;
        delete from public.channel_permission_overrides
        where channel_id = ch_id and community_id = cid and target_type = 'role' and role_id = tgt_role_id;
      else
        tgt_user_id := (payload->>'target_id')::uuid;
        delete from public.channel_permission_overrides
        where channel_id = ch_id and community_id = cid and target_type = 'member' and user_id = tgt_user_id;
      end if;
      return 'true';

    elsif action = 'set_channel_override' then
      tgt_type := payload->>'target_type';
      if tgt_type not in ('role', 'member') then
        raise exception 'Invalid target_type';
      end if;

      if tgt_type = 'role' then
        tgt_role_id := (payload->>'target_id')::uuid;
        tgt_user_id := null;
        -- Validação de hierarquia
        select * into subject from public.community_roles where id = tgt_role_id and community_id = cid and deleted_at is null;
        if not found then raise exception 'Role not found'; end if;
        if uid <> owner_uid and subject.position >= actor_position then
          raise exception 'Role hierarchy denied' using errcode = '42501';
        end if;
      else
        tgt_user_id := (payload->>'target_id')::uuid;
        tgt_role_id := null;
        if tgt_user_id = owner_uid and uid <> owner_uid then
          raise exception 'Protected member' using errcode = '42501';
        end if;
      end if;

      -- O canal passa a ter overrides próprios (desvincula da sincronização com a categoria)
      update public.channels set sync_permissions = false where id = ch_id and community_id = cid;

      -- Processar mapa de permissões { "view_channels": "allow", "send_messages": "deny", "connect_voice": "inherit" }
      perm_obj := payload->'permissions';
      for perm_key, perm_state in select key, value#>>'{}' from jsonb_each_text(perm_obj) loop
        if not exists(select 1 from public.permissions where name = perm_key) then
          raise exception 'Unknown permission';
        end if;

        if perm_state = 'inherit' then
          if tgt_type = 'role' then
            delete from public.channel_permission_overrides
            where channel_id = ch_id and community_id = cid and target_type = 'role' and role_id = tgt_role_id and permission = perm_key;
          else
            delete from public.channel_permission_overrides
            where channel_id = ch_id and community_id = cid and target_type = 'member' and user_id = tgt_user_id and permission = perm_key;
          end if;
        elsif perm_state in ('allow', 'deny') then
          if tgt_type = 'role' then
            insert into public.channel_permission_overrides (community_id, channel_id, target_type, role_id, permission, state)
            values (cid, ch_id, 'role', tgt_role_id, perm_key, perm_state)
            on conflict (channel_id, role_id, permission) where target_type = 'role'
            do update set state = excluded.state;
          else
            insert into public.channel_permission_overrides (community_id, channel_id, target_type, user_id, permission, state)
            values (cid, ch_id, 'member', tgt_user_id, perm_key, perm_state)
            on conflict (channel_id, user_id, permission) where target_type = 'member'
            do update set state = excluded.state;
          end if;
        end if;
      end loop;

      return 'true';
    end if;

  elsif action in ('set_category_override', 'delete_category_override') then
    if not (private.community_permission(cid, 'manage_channels') or private.community_permission(cid, 'manage_roles')) then
      raise exception 'Permission denied' using errcode = '42501';
    end if;

    cat_id := (payload->>'category_id')::uuid;

    if action = 'delete_category_override' then
      tgt_type := payload->>'target_type';
      if tgt_type = 'role' then
        tgt_role_id := (payload->>'target_id')::uuid;
        delete from public.category_permission_overrides
        where category_id = cat_id and community_id = cid and target_type = 'role' and role_id = tgt_role_id;
      else
        tgt_user_id := (payload->>'target_id')::uuid;
        delete from public.category_permission_overrides
        where category_id = cat_id and community_id = cid and target_type = 'member' and user_id = tgt_user_id;
      end if;
      return 'true';

    elsif action = 'set_category_override' then
      tgt_type := payload->>'target_type';
      if tgt_type not in ('role', 'member') then
        raise exception 'Invalid target_type';
      end if;

      if tgt_type = 'role' then
        tgt_role_id := (payload->>'target_id')::uuid;
        tgt_user_id := null;
        select * into subject from public.community_roles where id = tgt_role_id and community_id = cid and deleted_at is null;
        if not found then raise exception 'Role not found'; end if;
        if uid <> owner_uid and subject.position >= actor_position then
          raise exception 'Role hierarchy denied' using errcode = '42501';
        end if;
      else
        tgt_user_id := (payload->>'target_id')::uuid;
        tgt_role_id := null;
        if tgt_user_id = owner_uid and uid <> owner_uid then
          raise exception 'Protected member' using errcode = '42501';
        end if;
      end if;

      perm_obj := payload->'permissions';
      for perm_key, perm_state in select key, value#>>'{}' from jsonb_each_text(perm_obj) loop
        if not exists(select 1 from public.permissions where name = perm_key) then
          raise exception 'Unknown permission';
        end if;

        if perm_state = 'inherit' then
          if tgt_type = 'role' then
            delete from public.category_permission_overrides
            where category_id = cat_id and community_id = cid and target_type = 'role' and role_id = tgt_role_id and permission = perm_key;
          else
            delete from public.category_permission_overrides
            where category_id = cat_id and community_id = cid and target_type = 'member' and user_id = tgt_user_id and permission = perm_key;
          end if;
        elsif perm_state in ('allow', 'deny') then
          if tgt_type = 'role' then
            insert into public.category_permission_overrides (community_id, category_id, target_type, role_id, permission, state)
            values (cid, cat_id, 'role', tgt_role_id, perm_key, perm_state)
            on conflict (category_id, role_id, permission) where target_type = 'role'
            do update set state = excluded.state;
          else
            insert into public.category_permission_overrides (community_id, category_id, target_type, user_id, permission, state)
            values (cid, cat_id, 'member', tgt_user_id, perm_key, perm_state)
            on conflict (category_id, user_id, permission) where target_type = 'member'
            do update set state = excluded.state;
          end if;
        end if;
      end loop;

      return 'true';
    end if;

  else
    raise exception 'Unknown community action';
  end if;

  return 'true';
end $$;

-- Permissões
grant select on public.channel_permission_overrides to authenticated;
grant select on public.category_permission_overrides to authenticated;
grant execute on function public.can_join_voice(uuid) to authenticated;
grant execute on function public.voice_channel_permissions(uuid) to authenticated;
grant execute on function private.channel_permission(uuid, text) to authenticated;

notify pgrst, 'reload schema';
