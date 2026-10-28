-- ==============================================================================
-- CAPYCHAT: SCRIPT ADMINISTRATIVO PARA O SQL EDITOR DO SUPABASE DASHBOARD
-- Projeto: tfjkinffnksmiqatdhnb (arena lyc)
-- Data: 25/10/2026
-- Objetivo: Corrigir erro de coluna creator_id em community_invites e cascade de delete
-- ==============================================================================

-- 1. Garantir que a coluna creator_id exista em community_invites (compatibilidade total)
alter table public.community_invites
  add column if not exists creator_id uuid references public.profiles(id);

update public.community_invites
set creator_id = created_by
where creator_id is null;

-- 2. Atualizar private.community_command para inserir em created_by e creator_id
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

  if action in (
    'update_name', 'update_description', 'update_icon', 'update_banner', 'update_tag',
    'update_verification_level', 'update_content_filter', 'delete'
  ) then
    if uid <> owner_uid and not private.community_permission(cid, 'manage_community') then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    if action = 'update_name' then
      update public.communities set name = trim(payload->>'name') where id = cid;
    elsif action = 'update_description' then
      update public.communities set description = coalesce(payload->>'description', '') where id = cid;
    elsif action = 'update_icon' then
      update public.communities set image_url = nullif(payload->>'image_url', '') where id = cid;
    elsif action = 'update_banner' then
      update public.communities set banner_url = nullif(payload->>'banner_url', '') where id = cid;
    elsif action = 'update_tag' then
      label := trim(payload->>'tag');
      if label <> '' and not (label ~ '^[A-Za-z0-9_]{2,12}$') then
        raise exception 'Tag inválida';
      end if;
      update public.communities set tag = nullif(label, '') where id = cid;
    elsif action = 'update_verification_level' then
      update public.communities set verification_level = payload->>'verification_level' where id = cid;
    elsif action = 'update_content_filter' then
      update public.communities set content_filter = payload->>'content_filter' where id = cid;
    else
      if uid <> owner_uid then
        raise exception 'Somente o proprietário pode excluir a comunidade' using errcode = '42501';
      end if;
      delete from public.community_member_roles where community_id = cid;
      delete from public.community_members where community_id = cid;
      delete from public.community_role_permissions where community_id = cid;
      delete from public.channel_permission_overrides where community_id = cid;
      delete from public.category_permission_overrides where community_id = cid;
      delete from public.channels where community_id = cid;
      delete from public.channel_categories where community_id = cid;
      delete from public.community_invites where community_id = cid;
      delete from public.community_roles where community_id = cid;
      delete from public.communities where id = cid;
    end if;

  elsif action in ('create_invite', 'revoke_invite') then
    if not (private.community_permission(cid, 'create_invites') or private.community_permission(cid, 'manage_community')) then
      raise exception 'Permission denied' using errcode = '42501';
    end if;
    if action = 'create_invite' then
      insert into public.community_invites(community_id, code, created_by, creator_id, max_uses, expires_at)
      values (
        cid,
        md5(random()::text || clock_timestamp()::text),
        uid,
        uid,
        nullif(payload->>'max_uses', '')::integer,
        case
          when (payload->>'expires_in_hours')::integer is not null and (payload->>'expires_in_hours')::integer > 0
          then now() + ((payload->>'expires_in_hours')::integer || ' hours')::interval
          else null
        end
      ) returning to_jsonb(community_invites.*) into result;
      return result;
    else
      update public.community_invites
      set revoked_at = now()
      where community_id = cid and code = payload->>'code';
      return 'true';
    end if;

  elsif action in ('create_role', 'edit_role', 'delete_role', 'reorder_roles', 'assign_role', 'remove_role', 'add_member_role', 'remove_member_role') then
    if not private.community_permission(cid, 'manage_roles') then
      raise exception 'Permission denied' using errcode = '42501';
    end if;

    if action = 'create_role' then
      label := trim(payload->>'name');
      if label = '' then raise exception 'Role name cannot be empty'; end if;
      new_position := coalesce((payload->>'position')::integer, 1);
      if new_position < 1 or new_position >= 100 then
        raise exception 'Prioridade inválida (1–99; @todos permanece em 0)';
      end if;
      if uid <> owner_uid and new_position >= actor_position then
        raise exception 'Role hierarchy denied' using errcode = '42501';
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
      else
        wanted := '{}';
      end if;

      insert into public.community_roles (community_id, name, color, position, is_default)
      values (cid, label, coalesce(nullif(trim(payload->>'color'), ''), '#99aab5'), new_position, false)
      returning id into rid;

      if cardinality(wanted) > 0 then
        insert into public.community_role_permissions (community_id, role_id, permission)
        select cid, rid, p from unnest(wanted) p;
      end if;

      return to_jsonb(rid);

    elsif action = 'edit_role' then
      rid := coalesce((payload->>'id')::uuid, (payload->>'role_id')::uuid);
      select * into subject from public.community_roles where id = rid and community_id = cid and deleted_at is null;
      if not found then raise exception 'Role not found'; end if;
      if target = owner_uid and coalesce(subject.base_role, '') = 'OWNER' then
        raise exception 'O cargo de proprietário não pode ser removido' using errcode = '42501';
      end if;
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
      if target = owner_uid and coalesce(subject.base_role, '') = 'OWNER' then
        raise exception 'O cargo de proprietário não pode ser removido' using errcode = '42501';
      end if;
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

      if uid <> owner_uid and (target = owner_uid or target = uid) then
        raise exception 'Protected member' using errcode = '42501';
      end if;

      select * into subject from public.community_roles where id = rid and community_id = cid and deleted_at is null;
      if not found then raise exception 'Role not found'; end if;
      if target = owner_uid and coalesce(subject.base_role, '') = 'OWNER' then
        raise exception 'O cargo de proprietário não pode ser removido' using errcode = '42501';
      end if;
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

      if uid <> owner_uid and (target = owner_uid or target = uid) then
        raise exception 'Protected member' using errcode = '42501';
      end if;

      select * into subject from public.community_roles where id = rid and community_id = cid and deleted_at is null;
      if not found then raise exception 'Role not found'; end if;
      if target = owner_uid and coalesce(subject.base_role, '') = 'OWNER' then
        raise exception 'O cargo de proprietário não pode ser removido' using errcode = '42501';
      end if;

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
      where m.community_id = cid and m.user_id = target and left_at is null;

      return 'true';
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
      set name = coalesce(nullif(trim(payload->>'name'), ''), name),
          position = coalesce((payload->>'position')::integer, position)
      where id = item and community_id = cid and deleted_at is null;
      if not found then raise exception 'Category not found'; end if;
    else
      if exists(select 1 from public.channels where category_id = item and community_id = cid and deleted_at is null) then
        raise exception 'Não é possível excluir uma categoria que contém canais ativos';
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

  elsif action in ('set_channel_override', 'delete_channel_override', 'sync_channel_permissions') then
    if not (private.community_permission(cid, 'manage_channels') or private.community_permission(cid, 'manage_roles')) then
      raise exception 'Permission denied' using errcode = '42501';
    end if;

    ch_id := (payload->>'channel_id')::uuid;

    if action = 'sync_channel_permissions' then
      delete from public.channel_permission_overrides where channel_id = ch_id and community_id = cid;
      update public.channels set sync_permissions = true where id = ch_id and community_id = cid;
      return 'true';

    elsif action = 'delete_channel_override' then
      tgt_type := payload->>'target_type';
      if tgt_type = 'role' then
        tgt_role_id := (payload->>'role_id')::uuid;
        delete from public.channel_permission_overrides
        where community_id = cid and channel_id = ch_id and target_type = 'role' and role_id = tgt_role_id;
      else
        tgt_user_id := (payload->>'user_id')::uuid;
        delete from public.channel_permission_overrides
        where community_id = cid and channel_id = ch_id and target_type = 'member' and user_id = tgt_user_id;
      end if;
      return 'true';

    elsif action = 'set_channel_override' then
      tgt_type := payload->>'target_type';
      perm_key := payload->>'permission';
      perm_state := payload->>'state';

      if perm_state not in ('allow', 'deny') then
        raise exception 'Invalid override state (must be allow or deny)';
      end if;

      if tgt_type = 'role' then
        tgt_role_id := (payload->>'role_id')::uuid;
        insert into public.channel_permission_overrides (community_id, channel_id, target_type, role_id, permission, state)
        values (cid, ch_id, 'role', tgt_role_id, perm_key, perm_state)
        on conflict (community_id, channel_id, target_type, role_id, permission)
        do update set state = excluded.state;
      else
        tgt_user_id := (payload->>'user_id')::uuid;
        insert into public.channel_permission_overrides (community_id, channel_id, target_type, user_id, permission, state)
        values (cid, ch_id, 'member', tgt_user_id, perm_key, perm_state)
        on conflict (community_id, channel_id, target_type, user_id, permission)
        do update set state = excluded.state;
      end if;

      update public.channels set sync_permissions = false where id = ch_id and community_id = cid;
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
        tgt_role_id := (payload->>'role_id')::uuid;
        delete from public.category_permission_overrides
        where community_id = cid and category_id = cat_id and target_type = 'role' and role_id = tgt_role_id;
      else
        tgt_user_id := (payload->>'user_id')::uuid;
        delete from public.category_permission_overrides
        where community_id = cid and category_id = cat_id and target_type = 'member' and user_id = tgt_user_id;
      end if;
      return 'true';

    elsif action = 'set_category_override' then
      tgt_type := payload->>'target_type';
      perm_key := payload->>'permission';
      perm_state := payload->>'state';

      if perm_state not in ('allow', 'deny') then
        raise exception 'Invalid override state (must be allow or deny)';
      end if;

      if tgt_type = 'role' then
        tgt_role_id := (payload->>'role_id')::uuid;
        insert into public.category_permission_overrides (community_id, category_id, target_type, role_id, permission, state)
        values (cid, cat_id, 'role', tgt_role_id, perm_key, perm_state)
        on conflict (community_id, category_id, target_type, role_id, permission)
        do update set state = excluded.state;
      else
        tgt_user_id := (payload->>'user_id')::uuid;
        insert into public.category_permission_overrides (community_id, category_id, target_type, user_id, permission, state)
        values (cid, cat_id, 'member', tgt_user_id, perm_key, perm_state)
        on conflict (community_id, category_id, target_type, user_id, permission)
        do update set state = excluded.state;
      end if;

      return 'true';
    end if;

  elsif action in ('kick_member', 'ban_member', 'unban_member') then
    target := (payload->>'user_id')::uuid;
    if target = owner_uid or (uid <> owner_uid and target = uid) then
      raise exception 'Protected member' using errcode = '42501';
    end if;

    if action = 'kick_member' then
      if not (private.community_permission(cid, 'kick_members') or private.community_permission(cid, 'manage_members') or private.community_permission(cid, 'moderate_members')) then
        raise exception 'Permission denied' using errcode = '42501';
      end if;
      update public.community_members set left_at = now() where community_id = cid and user_id = target;
      return 'true';

    elsif action = 'ban_member' then
      if not (private.community_permission(cid, 'ban_members') or private.community_permission(cid, 'manage_members') or private.community_permission(cid, 'moderate_members')) then
        raise exception 'Permission denied' using errcode = '42501';
      end if;
      insert into public.community_bans (community_id, user_id, reason, banned_by)
      values (cid, target, coalesce(payload->>'reason', 'Banido pela moderação'), uid)
      on conflict (community_id, user_id) do update set reason = excluded.reason;
      update public.community_members set left_at = now() where community_id = cid and user_id = target;
      return 'true';

    elsif action = 'unban_member' then
      if not (private.community_permission(cid, 'ban_members') or private.community_permission(cid, 'manage_members') or private.community_permission(cid, 'moderate_members')) then
        raise exception 'Permission denied' using errcode = '42501';
      end if;
      delete from public.community_bans where community_id = cid and user_id = target;
      return 'true';
    end if;

  elsif action = 'leave' then
    if uid = owner_uid then
      raise exception 'Proprietário não pode sair da comunidade' using errcode = '42501';
    end if;
    update public.community_members set left_at = now() where community_id = cid and user_id = uid;
    delete from public.community_member_roles where community_id = cid and user_id = uid;
    return 'true';

  elsif action = 'transfer_ownership' then
    if uid <> owner_uid then
      raise exception 'Only the owner can transfer ownership' using errcode = '42501';
    end if;
    target := (payload->>'user_id')::uuid;
    if target = uid then
      raise exception 'Cannot transfer to self';
    end if;
    if not exists(select 1 from public.community_members where community_id = cid and user_id = target and left_at is null) then
      raise exception 'Target is not an active member';
    end if;
    if payload->>'confirm_name' is distinct from (select name from public.communities where id = cid) then
      raise exception 'Nome da comunidade não confere';
    end if;

    update public.communities set owner_id = target where id = cid;
    return 'true';

  else
    raise exception 'Ação não reconhecida: %', action using errcode = '42883';
  end if;

  return 'true';
end;
$$;

grant execute on function public.community_action(text, jsonb) to authenticated;
grant execute on function private.community_command(text, jsonb) to authenticated;

-- 3. Função pública segura para prévia de convites (permitida para todos os usuários)
create or replace function public.get_public_invite_preview(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.community_invites;
  comm_row public.communities;
  mem_count integer;
  caller_uid uuid := auth.uid();
  is_mem boolean := false;
  clean_code text := trim(invite_code);
begin
  if clean_code = '' or clean_code is null then
    return jsonb_build_object('status', 'invalid', 'error', 'Código de convite não fornecido.');
  end if;

  -- Normalizar se for o servidor oficial
  if lower(clean_code) = 'capychat-oficial' or lower(clean_code) = 'lyc-arena' then
    select * into comm_row from public.communities where is_official = true or id = 'd3f2173f-79f0-4362-b60a-ad079f724b54' limit 1;
    if not found then
      select * into comm_row from public.communities order by created_at asc limit 1;
    end if;

    if comm_row.id is not null then
      select count(*) into mem_count from public.community_members where community_id = comm_row.id and left_at is null;
      if caller_uid is not null then
        select exists(select 1 from public.community_members where community_id = comm_row.id and user_id = caller_uid and left_at is null) into is_mem;
      end if;

      return jsonb_build_object(
        'status', 'valid',
        'code', 'capychat-oficial',
        'community_id', comm_row.id,
        'community_name', coalesce(comm_row.name, 'CapyChat Oficial'),
        'image_url', comm_row.image_url,
        'is_official', true,
        'is_community', true,
        'created_at', comm_row.created_at,
        'member_count', greatest(coalesce(mem_count, 0), 1),
        'is_already_member', is_mem
      );
    end if;
  end if;

  select * into invitation from public.community_invites where code = clean_code;
  if not found then
    return jsonb_build_object('status', 'invalid', 'error', 'Convite não encontrado ou link inválido.');
  end if;

  if invitation.revoked_at is not null then
    return jsonb_build_object('status', 'revoked', 'error', 'Este convite foi revogado.');
  end if;

  if invitation.expires_at is not null and invitation.expires_at <= now() then
    return jsonb_build_object('status', 'expired', 'error', 'Este convite expirou.');
  end if;

  if invitation.max_uses is not null and invitation.uses >= invitation.max_uses then
    return jsonb_build_object('status', 'max_uses_reached', 'error', 'Este convite atingiu o limite máximo de utilizações.');
  end if;

  select * into comm_row from public.communities where id = invitation.community_id;
  if not found then
    return jsonb_build_object('status', 'invalid', 'error', 'Comunidade vinculada ao convite não foi encontrada.');
  end if;

  select count(*) into mem_count from public.community_members where community_id = comm_row.id and left_at is null;

  if caller_uid is not null then
    select exists(select 1 from public.community_members where community_id = comm_row.id and user_id = caller_uid and left_at is null) into is_mem;
  end if;

  return jsonb_build_object(
    'status', 'valid',
    'code', invitation.code,
    'community_id', comm_row.id,
    'community_name', comm_row.name,
    'image_url', comm_row.image_url,
    'is_official', coalesce(comm_row.is_official, false),
    'is_community', coalesce(comm_row.is_community, false),
    'created_at', comm_row.created_at,
    'member_count', coalesce(mem_count, 0),
    'is_already_member', is_mem,
    'expires_at', invitation.expires_at,
    'max_uses', invitation.max_uses,
    'uses', invitation.uses
  );
end;
$$;

grant execute on function public.get_public_invite_preview(text) to public, anon, authenticated;
