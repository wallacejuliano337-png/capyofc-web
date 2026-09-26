-- Additive community model. Before applying, set arena.owner_username to the
-- unique username explicitly approved as owner of the official community.
create table public.communities (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 60),
 image_url text check(image_url is null or image_url like 'https://%'),
 owner_id uuid not null references public.profiles(id), is_official boolean not null default false,
 created_at timestamptz not null default now()
);
create unique index one_official_community on public.communities(is_official) where is_official;
create index communities_owner on public.communities(owner_id);
create table public.permissions(name text primary key);
insert into public.permissions values ('manage_community'),('manage_channels'),('manage_roles'),('manage_members'),('create_invites'),('send_messages'),('connect_voice'),('speak'),('share_screen'),('moderate_members');
create table public.community_roles(
 id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities,
 name text not null check(length(trim(name)) between 1 and 40), base_role text references public.roles(name), position integer not null default 0,
 unique(community_id,id),unique(community_id,name),unique(community_id,base_role)
);
create table public.community_role_permissions(
 community_id uuid not null,role_id uuid not null,permission text not null references public.permissions,
 primary key(community_id,role_id,permission), foreign key(community_id,role_id) references public.community_roles(community_id,id)
);
create table public.community_members(
 community_id uuid not null references public.communities,user_id uuid not null references public.profiles,
 role_id uuid not null,joined_at timestamptz not null default now(),left_at timestamptz,
 primary key(community_id,user_id), foreign key(community_id,role_id) references public.community_roles(community_id,id)
);
create index community_members_user on public.community_members(user_id,community_id) where left_at is null;
create index community_members_role on public.community_members(community_id,role_id);
create table public.channel_categories(
 id uuid primary key default gen_random_uuid(),community_id uuid not null references public.communities,
 name text not null check(length(trim(name)) between 1 and 60),position integer not null default 0,deleted_at timestamptz,
 unique(community_id,id)
);
create unique index active_category_name on public.channel_categories(community_id,name) where deleted_at is null;
create table public.community_invites(
 code text primary key default replace(gen_random_uuid()::text,'-',''),community_id uuid not null references public.communities,
 created_by uuid not null references public.profiles,expires_at timestamptz,max_uses integer check(max_uses is null or max_uses>0),
 uses integer not null default 0 check(uses>=0),revoked_at timestamptz,created_at timestamptz not null default now()
);
create index community_invites_community on public.community_invites(community_id);
create index community_invites_creator on public.community_invites(created_by);
-- Saved definitions support the guarded, data-preserving rollback script.
create table private.community_upgrade_backup(key text primary key,value jsonb not null);
insert into private.community_upgrade_backup values('channels', (select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.channels c));
insert into private.community_upgrade_backup select p.oid::regprocedure::text,to_jsonb(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('can_read_channel','can_write_channel');
insert into private.community_upgrade_backup select 'policy:'||policyname,jsonb_build_object('table',tablename,'cmd',cmd,'qual',qual,'with_check',with_check,'schema',schemaname) from pg_policies where (schemaname='public' and policyname in ('channels_admin','messages_delete','membership_admin')) or (schemaname='realtime' and policyname in ('arena_realtime_read','arena_realtime_write'));

create function private.seed_community() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.community_roles(community_id,name,base_role,position) values
 (new.id,'Proprietário','OWNER',100),(new.id,'Administrador','ADMIN',90),(new.id,'Moderador','MODERATOR',50),(new.id,'Membro','MEMBER',0);
 insert into public.community_role_permissions(community_id,role_id,permission)
 select new.id,r.id,p.name from public.community_roles r cross join public.permissions p where r.community_id=new.id and
 (r.base_role in ('OWNER','ADMIN') or (r.base_role='MODERATOR' and p.name in ('send_messages','connect_voice','speak','share_screen','create_invites','moderate_members')) or (r.base_role='MEMBER' and p.name in ('send_messages','connect_voice','speak','share_screen')));
 insert into public.community_members(community_id,user_id,role_id) select new.id,new.owner_id,id from public.community_roles where community_id=new.id and base_role='OWNER';
 return new;
end $$;
create trigger community_seed after insert on public.communities for each row execute function private.seed_community();

do $$ declare owner_uid uuid; cid uuid; begin
 select id into owner_uid from public.profiles where username=current_setting('arena.owner_username',true);
 if owner_uid is null then raise exception 'Set arena.owner_username to the approved existing owner before applying'; end if;
 insert into public.communities(name,owner_id,is_official) values('Comunidade LYC',owner_uid,true) returning id into cid;
 insert into public.community_members(community_id,user_id,role_id)
 select cid,p.id,r.id from public.profiles p join public.community_roles r on r.community_id=cid and r.base_role='MEMBER'
 where p.id<>owner_uid;
 insert into public.channel_categories(community_id,name,position) select cid,category,min(position) from public.channels group by category;
end $$;
create function private.official_community() returns uuid language sql stable security definer set search_path='' as $$select id from public.communities where is_official$$;
alter table public.channels add column community_id uuid not null default private.official_community() references public.communities;
alter table public.channels add column category_id uuid;
alter table public.channels add column deleted_at timestamptz;
update public.channels c set category_id=k.id from public.channel_categories k where k.community_id=c.community_id and k.name=c.category;
alter table public.channels add constraint channels_community_category_fkey foreign key(community_id,category_id) references public.channel_categories(community_id,id);
create index channels_community_position on public.channels(community_id,position) where deleted_at is null;
create index channels_category_id on public.channels(community_id,category_id);

create function private.is_community_member(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.active_user() and exists(select 1 from public.community_members m where m.community_id=cid and m.user_id=auth.uid() and m.left_at is null);
$$;
create function private.community_permission(cid uuid, perm text) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_community_member(cid) and (exists(select 1 from public.communities where id=cid and owner_id=auth.uid()) or exists(select 1 from public.community_members m join public.community_role_permissions p on p.community_id=m.community_id and p.role_id=m.role_id where m.community_id=cid and m.user_id=auth.uid() and m.left_at is null and p.permission=perm));
$$;
create or replace function private.can_read_channel(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_user() and not exists(select 1 from public.moderation_actions where user_id=auth.uid() and channel_id=cid and kind='REMOVE_CHANNEL' and (expires_at is null or expires_at>now())) and exists(
 select 1 from public.channels c where c.id=cid and c.deleted_at is null and private.is_community_member(c.community_id) and (
 private.community_permission(c.community_id,'manage_channels') or
 (c.team_id is null and not c.is_private) or
 (c.team_id is not null and exists(select 1 from public.team_members m where m.team_id=c.team_id and m.user_id=auth.uid())) or
 (c.team_id is null and exists(select 1 from public.channel_members m where m.channel_id=c.id and m.user_id=auth.uid()))
 ));
$$;
create or replace function private.can_write_channel(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.can_read_channel(cid) and exists(select 1 from public.channels where id=cid and private.community_permission(community_id,case when kind='voice' then 'connect_voice' else 'send_messages' end))
 and not exists(select 1 from public.moderation_actions where user_id=auth.uid() and kind='MUTE' and (channel_id is null or channel_id=cid) and (expires_at is null or expires_at>now()));
$$;
-- Automatically provision new real profiles in the official community; leaving is explicit.
create function private.community_new_member() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.community_members(community_id,user_id,role_id) select community_id,new.id,id from public.community_roles where community_id=private.official_community() and base_role='MEMBER';return new;end $$;
create trigger community_profile_member after insert on public.profiles for each row execute function private.community_new_member();
-- Preserve the legacy category label for old clients and team-created channels.
create function private.channel_category_sync() returns trigger language plpgsql security definer set search_path='' as $$
declare label text;begin
 if new.category_id is null then
  select id into new.category_id from public.channel_categories where community_id=new.community_id and name=new.category and deleted_at is null;
  if new.category_id is null then
   if new.team_id is null then raise exception 'A valid category is required'; end if;
   insert into public.channel_categories(community_id,name,position) values(new.community_id,new.category,100) returning id into new.category_id;
  end if;
 end if;
 select name into label from public.channel_categories where id=new.category_id and community_id=new.community_id and deleted_at is null;
 if label is null then raise exception 'Invalid community category'; end if;
 new.category=label;return new;end $$;
create trigger channel_category_sync before insert or update of category_id on public.channels for each row execute function private.channel_category_sync();

do $$declare t text;begin foreach t in array array['communities','permissions','community_roles','community_role_permissions','community_members','channel_categories','community_invites'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
end loop;end $$;
create policy communities_read on public.communities for select to authenticated using(private.is_community_member(id));
create policy permissions_read on public.permissions for select to authenticated using(private.active_user());
create policy community_roles_read on public.community_roles for select to authenticated using(private.is_community_member(community_id));
create policy community_role_permissions_read on public.community_role_permissions for select to authenticated using(private.is_community_member(community_id));
create policy community_members_read on public.community_members for select to authenticated using(user_id=(select auth.uid()) or private.is_community_member(community_id));
create policy categories_read on public.channel_categories for select to authenticated using(private.is_community_member(community_id));
create policy invites_read on public.community_invites for select to authenticated using(private.community_permission(community_id,'create_invites'));
drop policy channels_admin on public.channels;
revoke insert,update,delete on public.channels from authenticated;
-- Expose only safe column updates. No client can move a channel across communities or change its identity/kind/team.
grant insert(name,category_id,category,kind,description,community_id,position) on public.channels to authenticated;
grant update(name,category_id,description,position,deleted_at) on public.channels to authenticated;
create policy channels_create on public.channels for insert to authenticated with check(private.community_permission(community_id,'manage_channels') and team_id is null and deleted_at is null);
create policy channels_edit on public.channels for update to authenticated using(private.community_permission(community_id,'manage_channels')) with check(private.community_permission(community_id,'manage_channels'));
drop policy membership_admin on public.channel_members;
create policy membership_admin on public.channel_members for all to authenticated using(exists(select 1 from public.channels c where c.id=channel_id and private.community_permission(c.community_id,'manage_members'))) with check(exists(select 1 from public.channels c where c.id=channel_id and private.community_permission(c.community_id,'manage_members')));
drop policy messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated using(private.can_read_channel(channel_id) and (author_id=(select auth.uid()) or exists(select 1 from public.channels c where c.id=channel_id and private.community_permission(c.community_id,'moderate_members'))));

-- All sensitive multi-row operations run atomically with explicit actor checks.
create function private.community_command(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; rid uuid; item uuid; target uuid; invitation public.community_invites; result jsonb; owner_uid uuid; label text;
begin
 if uid is null or not private.active_user() then raise exception 'Authentication required' using errcode='42501'; end if;
 if action='create' then
  insert into public.communities(name,image_url,owner_id) values(trim(payload->>'name'),nullif(payload->>'image_url',''),uid) returning id into cid;
  insert into public.channel_categories(community_id,name) values(cid,'Canais');
  return to_jsonb(cid);
 end if;
 if action='join' then
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
  target=(payload->>'user_id')::uuid;
  if target=uid or not exists(select 1 from public.community_members where community_id=cid and user_id=target and left_at is null) then raise exception 'Invalid successor';end if;
  update public.community_members set role_id=(select id from public.community_roles where community_id=cid and base_role='ADMIN') where community_id=cid and user_id=uid;
  update public.community_members set role_id=(select id from public.community_roles where community_id=cid and base_role='OWNER') where community_id=cid and user_id=target;
  update public.communities set owner_id=target where id=cid;
 elsif action='assign_role' then
  -- Only the owner can grant authority in this first release. Global roles never grant this power.
  if uid<>owner_uid then raise exception 'Only the community owner can assign roles' using errcode='42501';end if;
  rid=(payload->>'role_id')::uuid;target=(payload->>'user_id')::uuid;
  if target=owner_uid or not exists(select 1 from public.community_roles where id=rid and community_id=cid and base_role is distinct from 'OWNER') then raise exception 'Invalid role assignment';end if;
  update public.community_members set role_id=rid where community_id=cid and user_id=target and left_at is null;
  if not found then raise exception 'Member not found';end if;
 elsif action in ('create_category','edit_category','delete_category','create_channel','edit_channel','delete_channel') then
  if not private.community_permission(cid,'manage_channels') then raise exception 'Permission denied' using errcode='42501';end if;
  item=(payload->>'id')::uuid;
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
create function public.community_action(action text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.community_command(action,payload)$$;
create function public.my_community_permissions(community_id uuid) returns setof text language sql stable security invoker set search_path='' as $$select name from public.permissions where private.community_permission(community_id,name)$$;
create function public.voice_channel_permissions(channel_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('connect',public.can_join_voice(channel_id),'speak',private.community_permission(c.community_id,'speak'),'share_screen',private.community_permission(c.community_id,'share_screen')) from public.channels c where c.id=channel_id and c.kind='voice';
$$;
-- New functions never inherit PUBLIC execution permissions.
do $$declare f record;begin for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='private' and p.proname in ('seed_community','official_community','is_community_member','community_permission','community_new_member','channel_category_sync','community_command')) or (n.nspname='public' and p.proname in ('community_action','my_community_permissions','voice_channel_permissions')) loop execute format('revoke all on function %s from public,anon,authenticated',f.sig);end loop;end $$;
grant execute on function private.official_community(),private.is_community_member(uuid),private.community_permission(uuid,text),private.community_command(text,jsonb),public.community_action(text,jsonb),public.my_community_permissions(uuid),public.voice_channel_permissions(uuid) to authenticated;

-- Community presence is informational; authorization always uses database membership.
drop policy arena_realtime_read on realtime.messages;
drop policy arena_realtime_write on realtime.messages;
create policy arena_realtime_read on realtime.messages for select to authenticated using(extension in ('broadcast','presence') and case
 when realtime.topic() ~ '^(room|presence):[0-9a-f-]{36}$' then private.can_read_channel(split_part(realtime.topic(),':',2)::uuid)
 when realtime.topic() ~ '^community:[0-9a-f-]{36}$' then private.is_community_member(split_part(realtime.topic(),':',2)::uuid) else false end);
create policy arena_realtime_write on realtime.messages for insert to authenticated with check(extension in ('broadcast','presence') and case
 when realtime.topic() ~ '^(room|presence):[0-9a-f-]{36}$' then private.can_write_channel(split_part(realtime.topic(),':',2)::uuid)
 when realtime.topic() ~ '^community:[0-9a-f-]{36}$' then private.is_community_member(split_part(realtime.topic(),':',2)::uuid) else false end);
alter publication supabase_realtime add table public.communities,public.community_members,public.community_roles,public.community_role_permissions,public.channel_categories,public.channels;
-- A community revision invalidates client caches even when a channel becomes
-- invisible under RLS (archival, membership changes). No message data is broadcast.
alter table public.communities add column revision bigint not null default 0;
create function private.community_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.communities set revision=revision+1 where id=coalesce(new.community_id,old.community_id);return coalesce(new,old);end $$;
revoke all on function private.community_revision() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['channels','channel_categories','community_members','community_roles','community_role_permissions','community_invites'] loop execute format('create trigger community_revision after insert or update or delete on public.%I for each row execute function private.community_revision()',t);end loop;end $$;
revoke all on private.community_upgrade_backup from public,anon,authenticated;
