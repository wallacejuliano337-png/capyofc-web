-- Migration: 20260930180000_community_roles_system.sql
-- LYC Arena: Sistema Real de Cargos e Permissões - Fase 1

-- 1. Inserir permissões granulares completas
insert into public.permissions (name) values
  ('administrator'),
  ('view_channels'),
  ('manage_channels'),
  ('manage_roles'),
  ('manage_community'),
  ('view_audit_log'),
  ('change_nickname'),
  ('manage_nicknames'),
  ('kick_members'),
  ('ban_members'),
  ('timeout_members'),
  ('send_messages'),
  ('manage_messages'),
  ('embed_links'),
  ('attach_files'),
  ('add_reactions'),
  ('mention_everyone'),
  ('connect_voice'),
  ('speak'),
  ('video'),
  ('share_screen'),
  ('mute_members'),
  ('disconnect_members')
on conflict (name) do nothing;

-- 2. Estender public.community_roles com cor persistida e flag de cargo padrão
alter table public.community_roles add column if not exists color text not null default '#99aab5';
alter table public.community_roles add column if not exists is_default boolean not null default false;
alter table public.community_roles add column if not exists created_at timestamptz not null default now();
alter table public.community_roles add column if not exists updated_at timestamptz not null default now();

-- 3. Atualizar cargo padrão existente para @todos
update public.community_roles
set name = '@todos',
    is_default = true,
    position = 0,
    color = '#99aab5'
where base_role = 'MEMBER';

update public.community_roles set color = '#f1c40f' where base_role = 'OWNER' and color = '#99aab5';
update public.community_roles set color = '#e91e63' where base_role = 'ADMIN' and color = '#99aab5';
update public.community_roles set color = '#2ecc71' where base_role = 'MODERATOR' and color = '#99aab5';

-- Atribuir permissões padrão essenciais para o cargo @todos
insert into public.community_role_permissions (community_id, role_id, permission)
select r.community_id, r.id, p.name
from public.community_roles r
cross join (
  values
    ('view_channels'),
    ('send_messages'),
    ('embed_links'),
    ('attach_files'),
    ('add_reactions'),
    ('connect_voice'),
    ('speak'),
    ('video'),
    ('share_screen'),
    ('change_nickname')
) as p(name)
where r.is_default or r.base_role = 'MEMBER'
on conflict do nothing;

-- 4. Tabela de atribuição múltipla de cargos por membro
create table if not exists public.community_member_roles (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id, role_id),
  foreign key (community_id, role_id) references public.community_roles(community_id, id) on delete cascade
);

create index if not exists community_member_roles_user on public.community_member_roles(user_id, community_id);
create index if not exists community_member_roles_role on public.community_member_roles(community_id, role_id);

alter table public.community_member_roles enable row level security;
revoke all on public.community_member_roles from public, anon, authenticated;
grant select on public.community_member_roles to authenticated;

drop policy if exists member_roles_read on public.community_member_roles;
create policy member_roles_read on public.community_member_roles
  for select to authenticated using (private.is_community_member(community_id));

-- Backfill cargos existentes não padrão para community_member_roles
insert into public.community_member_roles (community_id, user_id, role_id)
select m.community_id, m.user_id, m.role_id
from public.community_members m
join public.community_roles r on r.id = m.role_id and r.community_id = m.community_id
where r.base_role is distinct from 'MEMBER' and r.is_default is false
on conflict do nothing;

-- 5. Realtime e gatilhos de revisão
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_member_roles'
  ) then
    alter publication supabase_realtime add table public.community_member_roles;
  end if;
end $$;

drop trigger if exists community_member_roles_revision on public.community_member_roles;
create trigger community_member_roles_revision
  after insert or update or delete on public.community_member_roles
  for each row execute function private.community_revision();

-- 6. Atualizar função de autorização com suporte a @todos, administrador e múltiplos cargos
create or replace function private.community_permission(cid uuid, perm text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  is_member boolean;
  is_owner boolean;
  has_admin boolean;
  has_perm boolean;
begin
  if uid is null or not private.active_user() then
    return false;
  end if;

  select exists(
    select 1 from public.community_members m
    where m.community_id = cid and m.user_id = uid and m.left_at is null
  ) into is_member;

  if not is_member then
    return false;
  end if;

  -- Proprietário possui todas as permissões
  select exists(
    select 1 from public.communities c
    where c.id = cid and c.owner_id = uid
  ) into is_owner;

  if is_owner then
    return true;
  end if;

  -- 'administrator' ou 'manage_community' concede todas as permissões
  select exists(
    select 1 from public.community_role_permissions crp
    where crp.community_id = cid
      and crp.permission in ('administrator', 'manage_community')
      and (
        crp.role_id in (
          select cmr.role_id from public.community_member_roles cmr
          where cmr.community_id = cid and cmr.user_id = uid
        )
        or crp.role_id in (
          select cm.role_id from public.community_members cm
          where cm.community_id = cid and cm.user_id = uid and cm.left_at is null
        )
      )
  ) into has_admin;

  if has_admin then
    return true;
  end if;

  -- Checar se possui a permissão específica em cargos atribuídos OU no cargo base @todos
  select exists(
    select 1 from public.community_role_permissions crp
    where crp.community_id = cid
      and crp.permission = perm
      and (
        crp.role_id in (
          select cmr.role_id from public.community_member_roles cmr
          where cmr.community_id = cid and cmr.user_id = uid
        )
        or crp.role_id in (
          select cm.role_id from public.community_members cm
          where cm.community_id = cid and cm.user_id = uid and cm.left_at is null
        )
        or crp.role_id in (
          select r.id from public.community_roles r
          where r.community_id = cid and (r.is_default or r.base_role = 'MEMBER') and r.deleted_at is null
        )
      )
  ) into has_perm;

  return has_perm;
end $$;

-- 7. Atualizar seed de nova comunidade para incluir @todos
create or replace function private.seed_community() returns trigger language plpgsql security definer set search_path='' as $$
declare
  owner_rid uuid;
  everyone_rid uuid;
begin
  insert into public.community_roles(community_id, name, base_role, position, color, is_default) values
    (new.id, 'Proprietário', 'OWNER', 100, '#f1c40f', false) returning id into owner_rid;
  insert into public.community_roles(community_id, name, base_role, position, color, is_default) values
    (new.id, 'Administrador', 'ADMIN', 90, '#e91e63', false);
  insert into public.community_roles(community_id, name, base_role, position, color, is_default) values
    (new.id, 'Moderador', 'MODERATOR', 50, '#2ecc71', false);
  insert into public.community_roles(community_id, name, base_role, position, color, is_default) values
    (new.id, '@todos', 'MEMBER', 0, '#99aab5', true) returning id into everyone_rid;

  insert into public.community_role_permissions(community_id, role_id, permission)
  select new.id, r.id, p.name from public.community_roles r cross join public.permissions p where r.community_id = new.id and
  (
    r.base_role in ('OWNER', 'ADMIN')
    or (r.base_role = 'MODERATOR' and p.name in ('send_messages', 'connect_voice', 'speak', 'video', 'share_screen', 'create_invites', 'moderate_members', 'kick_members', 'mute_members', 'view_channels', 'change_nickname', 'add_reactions', 'embed_links', 'attach_files'))
    or (r.is_default and p.name in ('view_channels', 'send_messages', 'connect_voice', 'speak', 'video', 'share_screen', 'add_reactions', 'embed_links', 'attach_files', 'change_nickname'))
  );

  insert into public.community_members(community_id, user_id, role_id)
  values (new.id, new.owner_id, owner_rid);

  return new;
end $$;

-- 8. Atualizar community_command para gerenciar cargos, hierarquia e múltiplos cargos com segurança estrita
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
  -- GESTÃO DE CARGOS E PERMISSÕES
  -- ========================================================
  elsif action in ('create_role', 'edit_role', 'delete_role', 'reorder_roles', 'assign_role', 'remove_role', 'add_member_role', 'remove_member_role') then
    if not private.community_permission(cid, 'manage_roles') then
      raise exception 'Permission denied' using errcode = '42501';
    end if;

    -- Calcular a posição máxima do ator
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

      -- Membros que tinham este cargo como primário recebem o maior cargo restante ou @todos
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
      -- ids são enviados em ordem decrescente de hierarquia (topo ao mais baixo acima de @todos)
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

      -- Inserir em community_member_roles se não for o cargo padrão @todos
      if not (coalesce(subject.is_default, false) or coalesce(subject.base_role, '') = 'MEMBER') then
        insert into public.community_member_roles (community_id, user_id, role_id)
        values (cid, target, rid)
        on conflict do nothing;
      end if;

      -- Atualizar role_id primário para o cargo de maior hierarquia do membro
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

      -- Atualizar para o maior cargo restante ou @todos
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

  elsif action in ('create_category', 'edit_category', 'delete_category', 'create_channel', 'edit_channel', 'delete_channel') then
    if not private.community_permission(cid, 'manage_channels') then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    item := nullif(payload->>'id', '')::uuid;
    if action = 'create_category' then
      insert into public.channel_categories(community_id, name, position) values (cid, trim(payload->>'name'), coalesce((payload->>'position')::integer, 0)) returning id into item;
    elsif action = 'edit_category' then
      update public.channel_categories set name = trim(payload->>'name'), position = coalesce((payload->>'position')::integer, 0) where id = item and community_id = cid and deleted_at is null;
      if not found then raise exception 'Category not found'; end if;
      update public.channels set category = trim(payload->>'name') where category_id = item and community_id = cid;
    elsif action = 'delete_category' then
      if exists(select 1 from public.channels where category_id = item and community_id = cid and deleted_at is null) then
        raise exception 'Mova ou exclua os canais antes de excluir a categoria';
      end if;
      update public.channel_categories set deleted_at = now() where id = item and community_id = cid;
    elsif action = 'create_channel' then
      insert into public.channels(community_id, name, category, category_id, kind, description, position) values (cid, trim(payload->>'name'), '', (payload->>'category_id')::uuid, payload->>'kind', coalesce(payload->>'description', ''), coalesce((payload->>'position')::integer, 0)) returning id into item;
    elsif action = 'edit_channel' then
      update public.channels set name = trim(payload->>'name'), category_id = (payload->>'category_id')::uuid, description = coalesce(payload->>'description', ''), position = coalesce((payload->>'position')::integer, 0) where id = item and community_id = cid and deleted_at is null;
      if not found then raise exception 'Channel not found'; end if;
    else
      update public.channels set deleted_at = now() where id = item and community_id = cid;
    end if;
    return to_jsonb(item);
  else
    raise exception 'Unknown community action';
  end if;

  return 'true';
end $$;

-- Conceder permissões necessárias
grant select on public.permissions to authenticated, anon;
grant select on public.community_roles to authenticated;
grant select on public.community_role_permissions to authenticated;
grant select on public.community_member_roles to authenticated;
grant execute on function public.community_action(text, jsonb) to authenticated;
grant execute on function private.community_command(text, jsonb) to authenticated;
grant execute on function private.community_permission(uuid, text) to authenticated;

notify pgrst, 'reload schema';

