-- Extend existing administration without recreating tables, policies or data.
insert into private.community_upgrade_backup(key,value) values('administration:community_command',to_jsonb(pg_get_functiondef('private.community_command(text,jsonb)'::regprocedure)));
alter table public.community_roles add column deleted_at timestamptz;
alter table public.community_roles drop constraint community_roles_community_id_name_key;
create unique index community_roles_active_name on public.community_roles(community_id,name) where deleted_at is null;
create or replace function private.community_command(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; rid uuid; item uuid; target uuid; invitation public.community_invites; result jsonb; owner_uid uuid; label text; actor_role uuid; actor_position integer; subject public.community_roles; new_position integer; wanted text[]; ids uuid[]; expected integer;
begin
 if uid is null or not private.active_user() then raise exception 'Authentication required' using errcode='42501'; end if;
 if action='create' then
  insert into public.communities(name,image_url,owner_id) values(trim(payload->>'name'),nullif(payload->>'image_url',''),uid) returning id into cid;
  insert into public.channel_categories(community_id,name) values(cid,'Canais');
  return to_jsonb(cid);
 end if;
 if action='join' then
  -- Lock community before invite, matching administrative lock order.
  select community_id into cid from public.community_invites where code=payload->>'code';
  perform 1 from public.communities where id=cid for update;
  select * into invitation from public.community_invites where code=payload->>'code' for update;
  if not found or invitation.revoked_at is not null or (invitation.expires_at is not null and invitation.expires_at<=now()) then raise exception 'Convite inválido ou expirado'; end if;
  cid=invitation.community_id;
  if exists(select 1 from public.community_members where community_id=cid and user_id=uid and left_at is null) then return to_jsonb(cid); end if;
  if invitation.max_uses is not null and invitation.uses>=invitation.max_uses then raise exception 'Convite esgotado'; end if;
  select id into rid from public.community_roles where community_id=cid and base_role='MEMBER';
  insert into public.community_members(community_id,user_id,role_id) values(cid,uid,rid) on conflict(community_id,user_id) do update set role_id=excluded.role_id,joined_at=now(),left_at=null;
  update public.community_invites set uses=uses+1 where code=invitation.code;
  return to_jsonb(cid);
 end if;
 cid=(payload->>'community_id')::uuid;
 -- Serialize authority checks against role changes/transfers.
 perform 1 from public.communities where id=cid for update;
 if not private.is_community_member(cid) then raise exception 'Community access denied' using errcode='42501';end if;
 select owner_id into owner_uid from public.communities where id=cid;
 if action='leave' then
  if owner_uid=uid then raise exception 'O proprietário precisa transferir a comunidade antes de sair';end if;
  update public.community_members set left_at=now() where community_id=cid and user_id=uid;return 'true';
 elsif action='edit_community' then
  if not private.community_permission(cid,'manage_community') then raise exception 'Permission denied' using errcode='42501';end if;
  update public.communities set name=trim(payload->>'name'),image_url=nullif(payload->>'image_url','') where id=cid;
 elsif action='invite' then
  if not private.community_permission(cid,'create_invites') then raise exception 'Permission denied' using errcode='42501';end if;
  if (payload->>'expires_at')::timestamptz<=now() then raise exception 'Expiration must be in the future';end if;
  insert into public.community_invites(community_id,created_by,expires_at,max_uses) values(cid,uid,(payload->>'expires_at')::timestamptz,(payload->>'max_uses')::integer) returning to_jsonb(community_invites) into result;return result;
 elsif action='revoke_invite' then
  if not private.community_permission(cid,'create_invites') then raise exception 'Permission denied' using errcode='42501';end if;
  update public.community_invites set revoked_at=now() where community_id=cid and code=payload->>'code';
 elsif action='transfer_ownership' then
  select owner_id into owner_uid from public.communities where id=cid for update;
  if uid<>owner_uid then raise exception 'Only the owner can transfer ownership' using errcode='42501';end if;
  if payload->>'confirm_name' is distinct from (select name from public.communities where id=cid) then raise exception 'Confirme o nome da comunidade para transferir a propriedade';end if;
  target=(payload->>'user_id')::uuid;
  if target=uid or not exists(select 1 from public.community_members where community_id=cid and user_id=target and left_at is null) then raise exception 'Invalid successor';end if;
  update public.community_members set role_id=(select id from public.community_roles where community_id=cid and base_role='ADMIN') where community_id=cid and user_id=uid;
  update public.community_members set role_id=(select id from public.community_roles where community_id=cid and base_role='OWNER') where community_id=cid and user_id=target;
  update public.communities set owner_id=target where id=cid;

 elsif action in ('create_role','edit_role','delete_role','assign_role','remove_role') then
  if not private.community_permission(cid,'manage_roles') then raise exception 'Permission denied' using errcode='42501';end if;
  select r.id,r.position into actor_role,actor_position from public.community_members m join public.community_roles r on r.id=m.role_id where m.community_id=cid and m.user_id=uid and m.left_at is null;
  rid=nullif(payload->>'id','')::uuid;
  if action in ('assign_role','remove_role') then
   target=(payload->>'user_id')::uuid;
   if target=owner_uid or (uid<>owner_uid and target=uid) then raise exception 'Protected member' using errcode='42501';end if;
   select r.* into subject from public.community_members m join public.community_roles r on r.id=m.role_id where m.community_id=cid and m.user_id=target and m.left_at is null;
   if not found then raise exception 'Member not found';end if;
   if uid<>owner_uid and subject.position>=actor_position then raise exception 'Role hierarchy denied' using errcode='42501';end if;
   if action='remove_role' then
    if payload->>'role_id' is distinct from subject.id::text then raise exception 'Member role changed; reload';end if;
    select id into rid from public.community_roles where community_id=cid and base_role='MEMBER' and deleted_at is null;
   else rid=(payload->>'role_id')::uuid;end if;
  end if;
  if action<>'create_role' then
   select * into subject from public.community_roles where id=rid and community_id=cid and deleted_at is null;
   if not found then raise exception 'Role not found';end if;
   if subject.base_role='OWNER' then raise exception 'Owner role is protected' using errcode='42501';end if;
   if uid<>owner_uid and (subject.position>=actor_position or subject.id=actor_role) then raise exception 'Role hierarchy denied' using errcode='42501';end if;
  end if;
  if action in ('create_role','edit_role') then
   new_position=(payload->>'position')::integer;
   if new_position is null or new_position<0 or new_position>=100 or (action='edit_role' and subject.base_role='MEMBER' and new_position<>0) then raise exception 'Prioridade inválida (0–99; Membro permanece em 0)';end if;
   if uid<>owner_uid and new_position>=actor_position then raise exception 'Role hierarchy denied' using errcode='42501';end if;
   if jsonb_typeof(payload->'permissions') is distinct from 'array' then raise exception 'Permissions array required';end if;
   select coalesce(array_agg(distinct value),'{}') into wanted from jsonb_array_elements_text(payload->'permissions');
   if exists(select 1 from unnest(wanted) p where not exists(select 1 from public.permissions where name=p)) then raise exception 'Unknown permission';end if;
   if uid<>owner_uid and exists(select 1 from unnest(wanted) p where not private.community_permission(cid,p)) then raise exception 'Cannot grant permissions you do not have' using errcode='42501';end if;
   if action='create_role' then
    insert into public.community_roles(community_id,name,position) values(cid,trim(payload->>'name'),new_position) returning id into rid;
   else update public.community_roles set name=trim(payload->>'name'),position=new_position where id=rid;end if;
   delete from public.community_role_permissions where role_id=rid and community_id=cid;
   insert into public.community_role_permissions(community_id,role_id,permission) select cid,rid,p from unnest(wanted) p;
   return to_jsonb(rid);
  elsif action='delete_role' then
   if subject.base_role is not null then raise exception 'Os cargos padrão não podem ser excluídos';end if;
   if uid<>owner_uid and exists(select 1 from public.community_role_permissions p join public.community_roles r on r.id=p.role_id where r.community_id=cid and r.base_role='MEMBER' and not private.community_permission(cid,p.permission)) then raise exception 'Cannot grant default permissions you do not have' using errcode='42501';end if;
   -- Preserve role data; assigned members return to the default role.
   update public.community_members set role_id=(select id from public.community_roles where community_id=cid and base_role='MEMBER') where community_id=cid and role_id=rid;
   update public.community_roles set deleted_at=now() where id=rid;
  else
   if uid<>owner_uid and exists(select 1 from public.community_role_permissions where role_id=rid and not private.community_permission(cid,permission)) then raise exception 'Cannot grant permissions you do not have' using errcode='42501';end if;
   update public.community_members set role_id=rid where community_id=cid and user_id=target and left_at is null;
  end if;
 elsif action in ('reorder_categories','reorder_channels') then
  if not private.community_permission(cid,'manage_channels') then raise exception 'Permission denied' using errcode='42501';end if;
  if jsonb_typeof(payload->'ids') is distinct from 'array' then raise exception 'IDs array required';end if;
  select coalesce(array_agg(value::uuid),'{}') into ids from jsonb_array_elements_text(payload->'ids');
  if cardinality(ids)<>(select count(distinct v) from unnest(ids) v) then raise exception 'Duplicate IDs';end if;
  if action='reorder_categories' then
   select count(*) into expected from public.channel_categories where community_id=cid and deleted_at is null;
   if cardinality(ids)<>expected or exists(select 1 from unnest(ids) v where not exists(select 1 from public.channel_categories where id=v and community_id=cid and deleted_at is null)) then raise exception 'Categories changed; reload';end if;
   update public.channel_categories c set position=s.ordinality-1 from unnest(ids) with ordinality s(id,ordinality) where c.id=s.id and c.community_id=cid;
  else
   item=(payload->>'category_id')::uuid;
   if not exists(select 1 from public.channel_categories where id=item and community_id=cid and deleted_at is null) then raise exception 'Invalid category';end if;
   select count(*) into expected from public.channels where community_id=cid and category_id=item and deleted_at is null;
   if cardinality(ids)<>expected or exists(select 1 from unnest(ids) v where not exists(select 1 from public.channels where id=v and community_id=cid and category_id=item and deleted_at is null)) then raise exception 'Channels changed; reload';end if;
   update public.channels c set position=s.ordinality-1 from unnest(ids) with ordinality s(id,ordinality) where c.id=s.id and c.community_id=cid;
  end if;
 elsif action in ('create_category','edit_category','delete_category','create_channel','edit_channel','delete_channel') then
  if not private.community_permission(cid,'manage_channels') then raise exception 'Permission denied' using errcode='42501';end if;
  item=nullif(payload->>'id','')::uuid;
  if action='create_category' then
   insert into public.channel_categories(community_id,name,position) values(cid,trim(payload->>'name'),coalesce((payload->>'position')::integer,0)) returning id into item;
  elsif action='edit_category' then
   update public.channel_categories set name=trim(payload->>'name'),position=coalesce((payload->>'position')::integer,0) where id=item and community_id=cid and deleted_at is null;
   if not found then raise exception 'Category not found';end if;
   update public.channels set category=trim(payload->>'name') where category_id=item and community_id=cid;
  elsif action='delete_category' then
   if exists(select 1 from public.channels where category_id=item and community_id=cid and deleted_at is null) then raise exception 'Mova ou exclua os canais antes de excluir a categoria';end if;
   update public.channel_categories set deleted_at=now() where id=item and community_id=cid;
  elsif action='create_channel' then
   insert into public.channels(community_id,name,category,category_id,kind,description,position) values(cid,trim(payload->>'name'),'',(payload->>'category_id')::uuid,payload->>'kind',coalesce(payload->>'description',''),coalesce((payload->>'position')::integer,0)) returning id into item;
  elsif action='edit_channel' then
   update public.channels set name=trim(payload->>'name'),category_id=(payload->>'category_id')::uuid,description=coalesce(payload->>'description',''),position=coalesce((payload->>'position')::integer,0) where id=item and community_id=cid and deleted_at is null;
   if not found then raise exception 'Channel not found';end if;
  else
   update public.channels set deleted_at=now() where id=item and community_id=cid;
  end if;
  return to_jsonb(item);
 else raise exception 'Unknown community action';
 end if;
 return 'true';
end $$;

revoke all on function private.community_command(text,jsonb) from public,anon;
