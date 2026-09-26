-- Guarded inverse for communities_permissions. Do NOT run as a normal migration.
-- New community metadata is archived, not deleted. Refuse a rollback that could
-- expose newly-created community channels through the legacy authorization model.
-- First restore the pre-community frontend and livekit-token deployment.
begin;
lock table public.communities,public.channels in access exclusive mode;
do $$ begin
 if exists(select 1 from public.communities where not is_official)
 or exists(select 1 from public.channels c where not exists(select 1 from jsonb_array_elements((select value from private.community_upgrade_backup where key='channels')) b where b->>'id'=c.id::text))
 then raise exception 'Rollback refused: new communities/channels exist. Preserve data and use a forward correction.'; end if;
end $$;
create schema arena_community_archive;
revoke all on schema arena_community_archive from public,anon,authenticated;
create table arena_community_archive.channel_mapping as select id,community_id,category_id,deleted_at from public.channels;
-- The original function definitions were captured before the upgrade.
do $$declare r record;begin for r in select value #>> '{}' definition from private.community_upgrade_backup where key not like 'policy:%' and key<>'channels' loop execute r.definition;end loop;end $$;
drop policy channels_create on public.channels;
drop policy channels_edit on public.channels;
drop policy membership_admin on public.channel_members;
drop policy messages_delete on public.messages;
drop policy arena_realtime_read on realtime.messages;
drop policy arena_realtime_write on realtime.messages;
do $$declare r record; q text;begin for r in select substr(key,8) name,value v from private.community_upgrade_backup where key like 'policy:%' loop
 q=format('create policy %I on %I.%I for %s to authenticated',r.name,r.v->>'schema',r.v->>'table',r.v->>'cmd');
 if r.v->>'qual' is not null then q=q||' using ('||(r.v->>'qual')||')';end if;
 if r.v->>'with_check' is not null then q=q||' with check ('||(r.v->>'with_check')||')';end if;
 execute q;
end loop;end $$;
drop trigger channel_category_sync on public.channels;
drop trigger community_profile_member on public.profiles;
drop trigger community_seed on public.communities;
do $$declare t text;begin foreach t in array array['channels','channel_categories','community_members','community_roles','community_role_permissions','community_invites'] loop execute format('drop trigger community_revision on public.%I',t);end loop;end $$;
alter publication supabase_realtime drop table public.communities,public.community_members,public.community_roles,public.community_role_permissions,public.channel_categories,public.channels;
alter table public.channels drop column category_id,drop column community_id,drop column deleted_at;
revoke insert(name,category,kind,description,position),update(name,description,position) on public.channels from authenticated;
grant insert,update,delete on public.channels to authenticated;
drop function public.community_action(text,jsonb), public.my_community_permissions(uuid),public.voice_channel_permissions(uuid);
drop function private.community_command(text,jsonb),private.community_new_member(),private.channel_category_sync(),private.seed_community(),private.community_revision();
-- Policies on archived tables are removed together with their private helpers.
drop function private.community_permission(uuid,text) cascade;
drop function private.is_community_member(uuid) cascade;
drop function private.official_community();
do $$declare t text;begin foreach t in array array['communities','permissions','community_roles','community_role_permissions','community_members','channel_categories','community_invites'] loop
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('alter table public.%I set schema arena_community_archive',t);
end loop;end $$;
alter table private.community_upgrade_backup set schema arena_community_archive;
commit;
