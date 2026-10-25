-- Community profile customization: banner and description
alter table public.communities
  add column if not exists banner_url text check (banner_url is null or banner_url like 'https://%'),
  add column if not exists description text not null default '' check (char_length(description) <= 300);

-- Update private.community_command for edit_community to support banner_url and description
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
 perform 1 from public.communities where id=cid for update;
 if not private.is_community_member(cid) then raise exception 'Community access denied' using errcode='42501';end if;
 select owner_id into owner_uid from public.communities where id=cid;
 if action='leave' then
  if owner_uid=uid then raise exception 'O proprietário precisa transferir a comunidade antes de sair';end if;
  update public.community_members set left_at=now() where community_id=cid and user_id=uid;return 'true';
 elsif action='edit_community' then
  if not private.community_permission(cid,'manage_community') then raise exception 'Permission denied' using errcode='42501';end if;
  update public.communities set
    name = trim(payload->>'name'),
    image_url = nullif(payload->>'image_url',''),
    banner_url = nullif(payload->>'banner_url',''),
    description = coalesce(payload->>'description', '')
  where id = cid;
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
   if uid<>owner_uid and subject.position>=actor_position then raise exception 'Hierarchy violation' using errcode='42501';end if;
   if action='assign_role' then
    select * into subject from public.community_roles where community_id=cid and id=rid and deleted_at is null;
    if not found or (uid<>owner_uid and subject.position>=actor_position) or subject.base_role='OWNER' then raise exception 'Cannot assign role' using errcode='42501';end if;
    update public.community_members set role_id=rid where community_id=cid and user_id=target;
   else
    select id into rid from public.community_roles where community_id=cid and base_role='MEMBER';
    update public.community_members set role_id=rid where community_id=cid and user_id=target;
   end if;
  elsif action='create_role' then
   select coalesce(max(position),0)+1 into new_position from public.community_roles where community_id=cid and deleted_at is null and base_role<>'OWNER';
   insert into public.community_roles(community_id,name,position) values(cid,trim(payload->>'name'),new_position) returning id into rid;
   wanted=coalesce((select array_agg(value::text) from jsonb_array_elements_text(payload->'permissions')),array[]::text[]);
   insert into public.community_role_permissions(community_id,role_id,permission) select cid,rid,name from public.permissions where name=any(wanted);
   return to_jsonb(rid);
  elsif action='delete_role' then
   select * into subject from public.community_roles where community_id=cid and id=rid and deleted_at is null;
   if not found or subject.base_role is not null or (uid<>owner_uid and subject.position>=actor_position) then raise exception 'Role cannot be deleted' using errcode='42501';end if;
   select id into item from public.community_roles where community_id=cid and base_role='MEMBER';
   update public.community_members set role_id=item where community_id=cid and role_id=rid;
   update public.community_roles set deleted_at=now() where community_id=cid and id=rid;
  elsif action='edit_role' then
   select * into subject from public.community_roles where community_id=cid and id=rid and deleted_at is null;
   if not found or (uid<>owner_uid and subject.position>=actor_position) then raise exception 'Role cannot be edited' using errcode='42501';end if;
   if payload ? 'name' then
    if subject.base_role='OWNER' then raise exception 'O cargo de proprietário não pode ser renomeado';end if;
    update public.community_roles set name=trim(payload->>'name') where community_id=cid and id=rid;
   end if;
   if payload ? 'permissions' then
    if subject.base_role='OWNER' then raise exception 'As permissões do proprietário não podem ser alteradas';end if;
    wanted=coalesce((select array_agg(value::text) from jsonb_array_elements_text(payload->'permissions')),array[]::text[]);
    delete from public.community_role_permissions where community_id=cid and role_id=rid;
    insert into public.community_role_permissions(community_id,role_id,permission) select cid,rid,name from public.permissions where name=any(wanted);
   end if;
  end if;
 end if;
 return 'true';
end $$;
