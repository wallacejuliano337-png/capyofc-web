-- LYC Arena: Fase 1 Critical & Structural Fixes
-- Real community bans, audit log persistence, security settings and community tag persistence

-- 1. Extend public.communities with tag, verification_level, content_filter, banner_url, description
alter table public.communities
  add column if not exists banner_url text,
  add column if not exists description text,
  add column if not exists tag text check(tag is null or length(trim(tag)) between 2 and 4),
  add column if not exists verification_level text not null default 'low' check(verification_level in ('none', 'low', 'medium', 'high', 'highest')),
  add column if not exists content_filter text not null default 'norole' check(content_filter in ('disabled', 'norole', 'all'));

-- 2. Real Community Bans table
create table if not exists public.community_bans (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid not null references public.profiles(id),
  reason text not null default '',
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create index if not exists community_bans_user_idx on public.community_bans(user_id);
create index if not exists community_bans_comm_idx on public.community_bans(community_id);

alter table public.community_bans enable row level security;
alter publication supabase_realtime add table public.community_bans;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_bans' and policyname = 'community_bans_select') then
    create policy community_bans_select on public.community_bans
      for select to authenticated
      using (
        user_id = (select auth.uid())
        or exists (
          select 1 from public.communities c
          where c.id = community_bans.community_id and c.owner_id = (select auth.uid())
        )
        or private.community_permission(community_bans.community_id, 'moderate_members')
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_bans' and policyname = 'community_bans_insert') then
    create policy community_bans_insert on public.community_bans
      for insert to authenticated
      with check (
        exists (
          select 1 from public.communities c
          where c.id = community_bans.community_id and c.owner_id = (select auth.uid())
        )
        or private.community_permission(community_bans.community_id, 'moderate_members')
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_bans' and policyname = 'community_bans_delete') then
    create policy community_bans_delete on public.community_bans
      for delete to authenticated
      using (
        exists (
          select 1 from public.communities c
          where c.id = community_bans.community_id and c.owner_id = (select auth.uid())
        )
        or private.community_permission(community_bans.community_id, 'moderate_members')
      );
  end if;
end $$;

grant select, insert, delete on public.community_bans to authenticated;

-- 3. Real Community Audit Logs table
create table if not exists public.community_audit_logs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action_type text not null,
  target_type text not null,
  target_id text,
  target_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists community_audit_logs_comm_created on public.community_audit_logs(community_id, created_at desc);
create index if not exists community_audit_logs_actor on public.community_audit_logs(actor_id);

alter table public.community_audit_logs enable row level security;
alter publication supabase_realtime add table public.community_audit_logs;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_audit_logs' and policyname = 'comm_audit_select') then
    create policy comm_audit_select on public.community_audit_logs
      for select to authenticated
      using (
        exists (
          select 1 from public.communities c
          where c.id = community_audit_logs.community_id and c.owner_id = (select auth.uid())
        )
        or private.community_permission(community_audit_logs.community_id, 'manage_community')
        or private.community_permission(community_audit_logs.community_id, 'manage_roles')
        or private.community_permission(community_audit_logs.community_id, 'manage_channels')
        or private.community_permission(community_audit_logs.community_id, 'moderate_members')
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_audit_logs' and policyname = 'comm_audit_insert') then
    create policy comm_audit_insert on public.community_audit_logs
      for insert to authenticated
      with check (
        actor_id = (select auth.uid()) and (
          exists (
            select 1 from public.communities c
            where c.id = community_audit_logs.community_id and c.owner_id = (select auth.uid())
          )
          or private.community_permission(community_audit_logs.community_id, 'manage_community')
          or private.community_permission(community_audit_logs.community_id, 'manage_roles')
          or private.community_permission(community_audit_logs.community_id, 'manage_channels')
          or private.community_permission(community_audit_logs.community_id, 'moderate_members')
        )
      );
  end if;
end $$;

grant select, insert on public.community_audit_logs to authenticated;

-- 4. Update private.is_community_member to instantly revoke access for banned users
create or replace function private.is_community_member(cid uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and private.active_user()
    and not exists (
      select 1 from public.community_bans b
      where b.community_id = cid and b.user_id = auth.uid()
    )
    and exists (
      select 1 from public.community_members m
      where m.community_id = cid and m.user_id = auth.uid() and m.left_at is null
    );
$$;

-- 5. Comprehensive private.community_command supporting all actions + ban, unban, kick, delete_community, tag & safety settings
create or replace function private.community_command(action text, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  rid uuid;
  item uuid;
  target uuid;
  invitation public.community_invites;
  result jsonb;
  owner_uid uuid;
  actor_role uuid;
  actor_position integer;
  subject public.community_roles;
  new_position integer;
  wanted text[];
  ids uuid[];
  expected integer;
begin
  if uid is null or not private.active_user() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if action = 'create' then
    insert into public.communities(name, image_url, owner_id)
      values (trim(payload->>'name'), nullif(payload->>'image_url', ''), uid)
      returning id into cid;
    insert into public.channel_categories(community_id, name)
      values (cid, 'Canais');
    return to_jsonb(cid);
  end if;

  if action = 'join' then
    select community_id into cid from public.community_invites where code = payload->>'code';
    perform 1 from public.communities where id = cid for update;

    -- Block banned users from re-joining
    if exists (select 1 from public.community_bans where community_id = cid and user_id = uid) then
      raise exception 'Você foi banido desta comunidade' using errcode = '42501';
    end if;

    select * into invitation from public.community_invites where code = payload->>'code' for update;
    if not found or invitation.revoked_at is not null or (invitation.expires_at is not null and invitation.expires_at <= now()) then
      raise exception 'Convite inválido ou expirado';
    end if;

    cid := invitation.community_id;
    if exists (select 1 from public.community_members where community_id = cid and user_id = uid and left_at is null) then
      return to_jsonb(cid);
    end if;

    if invitation.max_uses is not null and invitation.uses >= invitation.max_uses then
      raise exception 'Convite esgotado';
    end if;

    select id into rid from public.community_roles where community_id = cid and base_role = 'MEMBER';
    insert into public.community_members(community_id, user_id, role_id)
      values (cid, uid, rid)
      on conflict (community_id, user_id) do update set
        role_id = excluded.role_id,
        joined_at = now(),
        left_at = null;

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
    update public.community_members set left_at = now()
      where community_id = cid and user_id = uid;
    return 'true';

  elsif action = 'edit_community' then
    if not (uid = owner_uid or private.community_permission(cid, 'manage_community')) then
      raise exception 'Permission denied' using errcode = '42501';
    end if;

    update public.communities set
      name = coalesce(nullif(trim(payload->>'name'), ''), name),
      image_url = case when payload ? 'image_url' then nullif(payload->>'image_url', '') else image_url end,
      banner_url = case when payload ? 'banner_url' then nullif(payload->>'banner_url', '') else banner_url end,
      description = case when payload ? 'description' then coalesce(payload->>'description', '') else description end,
      tag = case when payload ? 'tag' then nullif(upper(trim(payload->>'tag')), '') else tag end,
      verification_level = case when payload ? 'verification_level' then (payload->>'verification_level') else verification_level end,
      content_filter = case when payload ? 'content_filter' then (payload->>'content_filter') else content_filter end
    where id = cid;

  elsif action = 'delete_community' then
    if uid <> owner_uid then
      raise exception 'Apenas o proprietário pode excluir a comunidade' using errcode = '42501';
    end if;
    delete from public.communities where id = cid;
    return 'true';

  elsif action = 'ban_member' then
    if not (uid = owner_uid or private.community_permission(cid, 'moderate_members')) then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    target := (payload->>'user_id')::uuid;
    if target is null or target = owner_uid or (uid <> owner_uid and target = uid) then
      raise exception 'Protected member or invalid target' using errcode = '42501';
    end if;

    select r.id, r.position into actor_role, actor_position
      from public.community_members m join public.community_roles r on r.id = m.role_id
      where m.community_id = cid and m.user_id = uid and m.left_at is null;
    select r.* into subject
      from public.community_members m join public.community_roles r on r.id = m.role_id
      where m.community_id = cid and m.user_id = target and m.left_at is null;
    if found and uid <> owner_uid and subject.position >= actor_position then
      raise exception 'Role hierarchy denied' using errcode = '42501';
    end if;

    insert into public.community_bans(community_id, user_id, banned_by, reason)
      values (cid, target, uid, coalesce(trim(payload->>'reason'), ''))
      on conflict (community_id, user_id) do update set
        banned_by = excluded.banned_by,
        reason = excluded.reason,
        created_at = now();

    update public.community_members set left_at = now()
      where community_id = cid and user_id = target;
    return 'true';

  elsif action = 'unban_member' then
    if not (uid = owner_uid or private.community_permission(cid, 'moderate_members')) then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    target := (payload->>'user_id')::uuid;
    delete from public.community_bans where community_id = cid and user_id = target;
    return 'true';

  elsif action = 'kick_member' then
    if not (uid = owner_uid or private.community_permission(cid, 'moderate_members')) then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    target := (payload->>'user_id')::uuid;
    if target is null or target = owner_uid or (uid <> owner_uid and target = uid) then
      raise exception 'Protected member or invalid target' using errcode = '42501';
    end if;

    select r.id, r.position into actor_role, actor_position
      from public.community_members m join public.community_roles r on r.id = m.role_id
      where m.community_id = cid and m.user_id = uid and m.left_at is null;
    select r.* into subject
      from public.community_members m join public.community_roles r on r.id = m.role_id
      where m.community_id = cid and m.user_id = target and m.left_at is null;
    if found and uid <> owner_uid and subject.position >= actor_position then
      raise exception 'Role hierarchy denied' using errcode = '42501';
    end if;

    update public.community_members set left_at = now()
      where community_id = cid and user_id = target;
    return 'true';

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
    select owner_id into owner_uid from public.communities where id = cid for update;
    if uid <> owner_uid then
      raise exception 'Only the owner can transfer ownership' using errcode = '42501';
    end if;
    if payload->>'confirm_name' is distinct from (select name from public.communities where id = cid) then
      raise exception 'Confirme o nome da comunidade para transferir a propriedade';
    end if;
    target := (payload->>'user_id')::uuid;
    if target = uid or not exists (select 1 from public.community_members where community_id = cid and user_id = target and left_at is null) then
      raise exception 'Invalid successor';
    end if;
    update public.community_members set role_id = (select id from public.community_roles where community_id = cid and base_role = 'ADMIN')
      where community_id = cid and user_id = uid;
    update public.community_members set role_id = (select id from public.community_roles where community_id = cid and base_role = 'OWNER')
      where community_id = cid and user_id = target;
    update public.communities set owner_id = target where id = cid;

  elsif action in ('create_role', 'edit_role', 'delete_role', 'assign_role', 'remove_role') then
    if not private.community_permission(cid, 'manage_roles') then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    select r.id, r.position into actor_role, actor_position
      from public.community_members m join public.community_roles r on r.id = m.role_id
      where m.community_id = cid and m.user_id = uid and m.left_at is null;
    rid := nullif(payload->>'id', '')::uuid;

    if action in ('assign_role', 'remove_role') then
      target := (payload->>'user_id')::uuid;
      if target = owner_uid or (uid <> owner_uid and target = uid) then
        raise exception 'Protected member' using errcode = '42501';
      end if;
      select r.* into subject
        from public.community_members m join public.community_roles r on r.id = m.role_id
        where m.community_id = cid and m.user_id = target and m.left_at is null;
      if not found then
        raise exception 'Member not found';
      end if;
      if uid <> owner_uid and subject.position >= actor_position then
        raise exception 'Hierarchy violation' using errcode = '42501';
      end if;
      if action = 'assign_role' then
        select * into subject from public.community_roles where community_id = cid and id = rid and deleted_at is null;
        if not found or (uid <> owner_uid and subject.position >= actor_position) or subject.base_role = 'OWNER' then
          raise exception 'Cannot assign role' using errcode = '42501';
        end if;
        update public.community_members set role_id = rid where community_id = cid and user_id = target;
      else
        select id into rid from public.community_roles where community_id = cid and base_role = 'MEMBER';
        update public.community_members set role_id = rid where community_id = cid and user_id = target;
      end if;
    elsif action = 'create_role' then
      select coalesce(max(position), 0) + 1 into new_position
        from public.community_roles where community_id = cid and deleted_at is null and base_role <> 'OWNER';
      insert into public.community_roles(community_id, name, position)
        values (cid, trim(payload->>'name'), new_position) returning id into rid;
      wanted := coalesce((select array_agg(value::text) from jsonb_array_elements_text(payload->'permissions')), array[]::text[]);
      insert into public.community_role_permissions(community_id, role_id, permission)
        select cid, rid, name from public.permissions where name = any(wanted);
      return to_jsonb(rid);
    elsif action = 'delete_role' then
      select * into subject from public.community_roles where community_id = cid and id = rid and deleted_at is null;
      if not found or subject.base_role is not null or (uid <> owner_uid and subject.position >= actor_position) then
        raise exception 'Role cannot be deleted' using errcode = '42501';
      end if;
      select id into item from public.community_roles where community_id = cid and base_role = 'MEMBER';
      update public.community_members set role_id = item where community_id = cid and role_id = rid;
      update public.community_roles set deleted_at = now() where community_id = cid and id = rid;
    elsif action = 'edit_role' then
      select * into subject from public.community_roles where community_id = cid and id = rid and deleted_at is null;
      if not found or (uid <> owner_uid and subject.position >= actor_position) then
        raise exception 'Role cannot be edited' using errcode = '42501';
      end if;
      if payload ? 'name' then
        if subject.base_role = 'OWNER' then
          raise exception 'O cargo de proprietário não pode ser renomeado';
        end if;
        update public.community_roles set name = trim(payload->>'name') where community_id = cid and id = rid;
      end if;
      if payload ? 'permissions' then
        if subject.base_role = 'OWNER' then
          raise exception 'As permissões do proprietário não podem ser alteradas';
        end if;
        wanted := coalesce((select array_agg(value::text) from jsonb_array_elements_text(payload->'permissions')), array[]::text[]);
        delete from public.community_role_permissions where community_id = cid and role_id = rid;
        insert into public.community_role_permissions(community_id, role_id, permission)
          select cid, rid, name from public.permissions where name = any(wanted);
      end if;
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
      update public.channel_categories c set position = s.ordinality - 1
        from unnest(ids) with ordinality s(id, ordinality) where c.id = s.id and c.community_id = cid;
    else
      item := (payload->>'category_id')::uuid;
      if not exists(select 1 from public.channel_categories where id = item and community_id = cid and deleted_at is null) then
        raise exception 'Invalid category';
      end if;
      select count(*) into expected from public.channels where community_id = cid and category_id = item and deleted_at is null;
      if cardinality(ids) <> expected or exists(select 1 from unnest(ids) v where not exists(select 1 from public.channels where id = v and community_id = cid and category_id = item and deleted_at is null)) then
        raise exception 'Channels changed; reload';
      end if;
      update public.channels c set position = s.ordinality - 1
        from unnest(ids) with ordinality s(id, ordinality) where c.id = s.id and c.community_id = cid;
    end if;

  elsif action in ('create_category', 'edit_category', 'delete_category', 'create_channel', 'edit_channel', 'delete_channel') then
    if not private.community_permission(cid, 'manage_channels') then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    item := nullif(payload->>'id', '')::uuid;

    if action = 'create_category' then
      insert into public.channel_categories(community_id, name, position)
        values (cid, trim(payload->>'name'), coalesce((payload->>'position')::integer, 0))
        returning id into item;
    elsif action = 'edit_category' then
      update public.channel_categories set
        name = trim(payload->>'name'),
        position = coalesce((payload->>'position')::integer, 0)
        where id = item and community_id = cid and deleted_at is null;
      if not found then raise exception 'Category not found'; end if;
      update public.channels set category = trim(payload->>'name')
        where category_id = item and community_id = cid;
    elsif action = 'delete_category' then
      if exists(select 1 from public.channels where category_id = item and community_id = cid and deleted_at is null) then
        raise exception 'Mova ou exclua os canais antes de excluir a categoria';
      end if;
      update public.channel_categories set deleted_at = now()
        where id = item and community_id = cid;
    elsif action = 'create_channel' then
      insert into public.channels(community_id, name, category, category_id, kind, description, position)
        values (cid, trim(payload->>'name'), '', (payload->>'category_id')::uuid, payload->>'kind', coalesce(payload->>'description', ''), coalesce((payload->>'position')::integer, 0))
        returning id into item;
    elsif action = 'edit_channel' then
      update public.channels set
        name = trim(payload->>'name'),
        category_id = (payload->>'category_id')::uuid,
        description = coalesce(payload->>'description', ''),
        position = coalesce((payload->>'position')::integer, 0)
        where id = item and community_id = cid and deleted_at is null;
      if not found then raise exception 'Channel not found'; end if;
    else
      update public.channels set deleted_at = now()
        where id = item and community_id = cid;
    end if;
    return to_jsonb(item);
  else
    raise exception 'Unknown community action';
  end if;

  return 'true';
end;
$$;
