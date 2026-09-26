create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.roles(name text primary key);
insert into public.roles values ('OWNER'),('ADMIN'),('MODERATOR'),('STAFF'),('CAPTAIN'),('PLAYER'),('MEMBER');
create table public.profiles(
 id uuid primary key references auth.users on delete cascade,
 username text not null unique check(username ~ '^[a-z0-9_]{3,30}$'),
 display_name text not null check(length(display_name) between 1 and 40),
 avatar_url text check(avatar_url is null or avatar_url like 'https://%'),
 status text not null default 'online' check(status in ('online','away','busy')),
 role text not null default 'MEMBER' references public.roles,
 created_at timestamptz not null default now()
);
create table public.teams(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 60),tag text not null unique check(tag ~ '^[A-Z0-9]{2,6}$'),logo_url text,captain_id uuid not null references public.profiles,created_at timestamptz not null default now());
create table public.team_members(team_id uuid references public.teams on delete cascade,user_id uuid references public.profiles on delete cascade,slot text not null default 'PLAYER' check(slot in ('CAPTAIN','PLAYER','RESERVE')),primary key(team_id,user_id));
create index team_members_user on public.team_members(user_id);
create table public.channels(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 60),category text not null,kind text not null check(kind in ('text','voice')),description text not null default '',team_id uuid references public.teams on delete cascade,is_private boolean not null default false,position integer not null default 0,created_at timestamptz not null default now());
create index channels_team on public.channels(team_id);
create table public.channel_members(channel_id uuid references public.channels on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(channel_id,user_id));
create index channel_members_user on public.channel_members(user_id);
create table public.moderation_actions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,channel_id uuid references public.channels on delete cascade,kind text not null check(kind in ('BAN','MUTE','REMOVE_CHANNEL')),reason text not null,expires_at timestamptz,created_at timestamptz not null default now());
create index moderation_user on public.moderation_actions(user_id,kind);
create table public.messages(id uuid primary key default gen_random_uuid(),channel_id uuid not null references public.channels on delete cascade,author_id uuid not null references public.profiles,content text not null check(length(trim(content)) between 1 and 4000),reply_to uuid references public.messages on delete set null,created_at timestamptz not null default now(),edited_at timestamptz);
create index messages_history on public.messages(channel_id,created_at desc,id);
create index messages_author on public.messages(author_id);
create index messages_reply on public.messages(reply_to);
create table public.message_reactions(message_id uuid references public.messages on delete cascade,user_id uuid references public.profiles on delete cascade,emoji text not null check(length(emoji) between 1 and 16),primary key(message_id,user_id,emoji));
create index reactions_user on public.message_reactions(user_id);
create table public.tickets(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,subject text not null check(length(trim(subject)) between 1 and 120),description text not null check(length(trim(description)) between 1 and 4000),category text not null check(category in ('Dúvida','Competição','Denúncia','Problema técnico')),status text not null default 'ABERTO' check(status in ('ABERTO','EM_ATENDIMENTO','FECHADO')),assigned_to uuid references public.profiles,created_at timestamptz not null default now());
create index tickets_user on public.tickets(user_id,created_at);
create index tickets_assigned on public.tickets(assigned_to);
create table public.ticket_messages(id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.tickets on delete cascade,author_id uuid not null references public.profiles,content text not null check(length(trim(content)) between 1 and 4000),created_at timestamptz not null default now());
create index ticket_messages_history on public.ticket_messages(ticket_id,created_at);
create index ticket_messages_author on public.ticket_messages(author_id);
create table public.ticket_history(id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.tickets on delete cascade,actor_id uuid references public.profiles,detail text not null,created_at timestamptz not null default now());
create index ticket_history_ticket on public.ticket_history(ticket_id,created_at);
create table public.seasons(id uuid primary key default gen_random_uuid(),name text not null,status text not null default 'DRAFT',scoring_rules jsonb not null default '{}',external_system_id text,created_at timestamptz not null default now());
create table public.groups(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons on delete cascade,name text not null,unique(season_id,name));
create table public.season_teams(season_id uuid references public.seasons on delete cascade,team_id uuid references public.teams on delete cascade,group_id uuid references public.groups,primary key(season_id,team_id));
create index season_teams_team on public.season_teams(team_id);
create table public.rounds(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons on delete cascade,name text not null,starts_at timestamptz,status text not null default 'SCHEDULED');
create index rounds_season on public.rounds(season_id);
create table public.matches(id uuid primary key default gen_random_uuid(),round_id uuid not null references public.rounds on delete cascade,sequence integer not null,map text,starts_at timestamptz,unique(round_id,sequence));
create table public.match_results(match_id uuid references public.matches on delete cascade,team_id uuid references public.teams,placement integer check(placement>0),kills integer check(kills>=0),points numeric,external_payload jsonb,primary key(match_id,team_id));
create table public.audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid,action text not null,entity text not null,entity_id text,created_at timestamptz not null default now());

-- Authorization reads authoritative database records; user metadata never assigns a role.
create function private.active_user() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not exists(select 1 from public.moderation_actions where user_id=auth.uid() and kind='BAN' and (expires_at is null or expires_at>now()));
$$;
create function private.has_role(allowed text[]) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.active_user() and exists(select 1 from public.profiles where id=auth.uid() and role=any(allowed));
$$;
create function private.can_read_channel(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.active_user() and not exists(select 1 from public.moderation_actions where user_id=auth.uid() and channel_id=cid and kind='REMOVE_CHANNEL' and (expires_at is null or expires_at>now())) and exists(
 select 1 from public.channels c where c.id=cid and (
 private.has_role(array['OWNER','ADMIN']) or
 (c.team_id is null and not c.is_private) or
 (c.team_id is not null and exists(select 1 from public.team_members m where m.team_id=c.team_id and m.user_id=auth.uid())) or
 (c.team_id is null and exists(select 1 from public.channel_members m where m.channel_id=c.id and m.user_id=auth.uid()))
 ));
$$;
create function private.can_write_channel(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.can_read_channel(cid) and not exists(select 1 from public.moderation_actions where user_id=auth.uid() and kind='MUTE' and (channel_id is null or channel_id=cid) and (expires_at is null or expires_at>now()));
$$;
create function private.team_captain(tid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.active_user() and exists(select 1 from public.teams where id=tid and captain_id=auth.uid());
$$;
create function private.can_read_ticket(tid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.active_user() and exists(select 1 from public.tickets where id=tid and (user_id=auth.uid() or private.has_role(array['OWNER','ADMIN','MODERATOR','STAFF'])));
$$;
-- Only the Auth trigger can provision profiles. Metadata is display-only.
create function private.new_profile() returns trigger language plpgsql security definer set search_path='' as $$
 begin insert into public.profiles(id,username,display_name) values(new.id,'u_'||substr(replace(new.id::text,'-',''),1,24),left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Membro'),40)); return new; end;
$$;
create trigger on_user_created after insert on auth.users for each row execute function private.new_profile();
create function private.team_created() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is null or new.captain_id<>auth.uid() then raise exception 'Unauthorized team creation'; end if;
 insert into public.team_members(team_id,user_id,slot) values(new.id,new.captain_id,'CAPTAIN');
 insert into public.channels(name,category,kind,description,team_id,is_private) values(lower(new.tag)||'-privado','MINHA EQUIPE','text','Canal exclusivo do elenco.',new.id,true),(lower(new.tag)||'-voz','MINHA EQUIPE','voice','Sala exclusiva do elenco.',new.id,true);
 return new;end;
$$;
create trigger on_team_created after insert on public.teams for each row execute function private.team_created();
create function public.create_team(team_name text,team_tag text) returns uuid language plpgsql security invoker set search_path='' as $$
 declare tid uuid;begin insert into public.teams(name,tag,captain_id) values(trim(team_name),upper(trim(team_tag)),auth.uid()) returning id into tid;return tid;end;
$$;
create function private.ticket_changed() returns trigger language plpgsql security definer set search_path='' as $$
 begin if auth.uid() is null then raise exception 'Authentication required';end if;
 insert into public.ticket_history(ticket_id,actor_id,detail) values(new.id,auth.uid(),case when TG_OP='INSERT' then 'Ticket aberto' else old.status||' → '||new.status||coalesce(' · responsável '||new.assigned_to::text,'') end);
 return new;end;
$$;
create trigger on_ticket_changed after insert or update on public.tickets for each row execute function private.ticket_changed();
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
 begin if auth.uid() is not null then insert into public.audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id'));end if;return coalesce(new,old);end;
$$;
create trigger audit_channels after insert or update or delete on public.channels for each row execute function private.audit_change();
create trigger audit_roles after update of role on public.profiles for each row execute function private.audit_change();
create trigger audit_moderation after insert or update or delete on public.moderation_actions for each row execute function private.audit_change();
create trigger audit_seasons after insert or update or delete on public.seasons for each row execute function private.audit_change();

-- Supabase projects may have permissive default grants. Reset only Arena tables.
revoke all on public.roles,public.profiles,public.teams,public.team_members,public.channels,public.channel_members,public.moderation_actions,public.messages,public.message_reactions,public.tickets,public.ticket_messages,public.ticket_history,public.seasons,public.groups,public.season_teams,public.rounds,public.matches,public.match_results,public.audit_logs from anon,authenticated;
-- Explicit grants; mutations to immutable or privileged columns are impossible for clients.
grant select on public.roles,public.profiles,public.teams,public.team_members,public.channels,public.channel_members,public.moderation_actions,public.messages,public.message_reactions,public.tickets,public.ticket_messages,public.ticket_history,public.seasons,public.groups,public.season_teams,public.rounds,public.matches,public.match_results,public.audit_logs to authenticated;
grant insert,delete on public.messages,public.message_reactions,public.team_members,public.channels to authenticated;
grant insert on public.teams,public.tickets,public.ticket_messages to authenticated;
grant update(display_name,username,avatar_url,status) on public.profiles to authenticated;
grant update(content,edited_at) on public.messages to authenticated;
grant update(status,assigned_to) on public.tickets to authenticated;
grant update(name,tag,logo_url) on public.teams to authenticated;
grant update(slot) on public.team_members to authenticated;
grant update on public.channels to authenticated;
grant insert,update,delete on public.seasons,public.groups,public.season_teams,public.rounds,public.matches,public.match_results,public.moderation_actions,public.channel_members to authenticated;

do $$ declare t text;begin foreach t in array array['roles','profiles','teams','team_members','channels','channel_members','moderation_actions','messages','message_reactions','tickets','ticket_messages','ticket_history','seasons','groups','season_teams','rounds','matches','match_results','audit_logs'] loop execute format('alter table public.%I enable row level security',t);end loop;end $$;
create policy roles_read on public.roles for select to authenticated using(private.active_user());
create policy profiles_read on public.profiles for select to authenticated using(private.active_user());
create policy profiles_edit on public.profiles for update to authenticated using(id=(select auth.uid()) and private.active_user()) with check(id=(select auth.uid()) and private.active_user());
create policy teams_read on public.teams for select to authenticated using(private.active_user());
create policy teams_insert on public.teams for insert to authenticated with check(captain_id=(select auth.uid()) and private.active_user());
create policy teams_edit on public.teams for update to authenticated using(private.team_captain(id) or private.has_role(array['OWNER','ADMIN'])) with check(private.team_captain(id) or private.has_role(array['OWNER','ADMIN']));
create policy roster_read on public.team_members for select to authenticated using(private.active_user());
create policy roster_insert on public.team_members for insert to authenticated with check(slot<>'CAPTAIN' and (private.team_captain(team_id) or private.has_role(array['OWNER','ADMIN'])));
create policy roster_update on public.team_members for update to authenticated using(slot<>'CAPTAIN' and (private.team_captain(team_id) or private.has_role(array['OWNER','ADMIN']))) with check(slot<>'CAPTAIN' and (private.team_captain(team_id) or private.has_role(array['OWNER','ADMIN'])));
create policy roster_delete on public.team_members for delete to authenticated using(slot<>'CAPTAIN' and (private.team_captain(team_id) or private.has_role(array['OWNER','ADMIN'])));
create policy channels_read on public.channels for select to authenticated using(private.can_read_channel(id));
create policy channels_admin on public.channels for all to authenticated using(private.has_role(array['OWNER','ADMIN'])) with check(private.has_role(array['OWNER','ADMIN']));
create policy membership_admin on public.channel_members for all to authenticated using(private.has_role(array['OWNER','ADMIN'])) with check(private.has_role(array['OWNER','ADMIN']));
create policy moderation_admin on public.moderation_actions for all to authenticated using(private.has_role(array['OWNER','ADMIN'])) with check(private.has_role(array['OWNER','ADMIN']));
create policy messages_read on public.messages for select to authenticated using(private.can_read_channel(channel_id));
create policy messages_insert on public.messages for insert to authenticated with check(author_id=(select auth.uid()) and private.can_write_channel(channel_id) and exists(select 1 from public.channels where id=channel_id and kind='text') and (reply_to is null or exists(select 1 from public.messages parent where parent.id=reply_to and parent.channel_id=messages.channel_id)));
create policy messages_edit on public.messages for update to authenticated using(author_id=(select auth.uid()) and private.can_write_channel(channel_id)) with check(author_id=(select auth.uid()) and private.can_write_channel(channel_id));
create policy messages_delete on public.messages for delete to authenticated using(private.can_read_channel(channel_id) and (author_id=(select auth.uid()) or private.has_role(array['OWNER','ADMIN','MODERATOR','STAFF'])));
create policy reactions_read on public.message_reactions for select to authenticated using(exists(select 1 from public.messages where id=message_id));
create policy reactions_insert on public.message_reactions for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.messages where id=message_id and private.can_write_channel(channel_id)));
create policy reactions_delete on public.message_reactions for delete to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.messages where id=message_id));
create policy tickets_read on public.tickets for select to authenticated using(private.active_user() and (user_id=(select auth.uid()) or private.has_role(array['OWNER','ADMIN','MODERATOR','STAFF'])));
create policy tickets_insert on public.tickets for insert to authenticated with check(user_id=(select auth.uid()) and status='ABERTO' and assigned_to is null and private.active_user());
create policy tickets_staff on public.tickets for update to authenticated using(private.has_role(array['OWNER','ADMIN','MODERATOR','STAFF'])) with check(private.has_role(array['OWNER','ADMIN','MODERATOR','STAFF']) and (assigned_to is null or assigned_to=(select auth.uid())));
create policy ticket_messages_read on public.ticket_messages for select to authenticated using(private.can_read_ticket(ticket_id));
create policy ticket_messages_insert on public.ticket_messages for insert to authenticated with check(author_id=(select auth.uid()) and private.can_read_ticket(ticket_id) and exists(select 1 from public.tickets where id=ticket_id and status<>'FECHADO'));
create policy ticket_history_read on public.ticket_history for select to authenticated using(private.can_read_ticket(ticket_id));
create policy audit_admin on public.audit_logs for select to authenticated using(private.has_role(array['OWNER','ADMIN']));
do $$ declare t text;begin foreach t in array array['seasons','groups','season_teams','rounds','matches','match_results'] loop
 execute format('create policy league_read on public.%I for select to authenticated using(private.active_user())',t);
 execute format('create policy league_admin on public.%I for all to authenticated using(private.has_role(array[''OWNER'',''ADMIN''])) with check(private.has_role(array[''OWNER'',''ADMIN'']))',t);
end loop;end $$;
revoke all on all functions in schema private from public,anon;
grant execute on function private.active_user(),private.has_role(text[]),private.can_read_channel(uuid),private.can_write_channel(uuid),private.team_captain(uuid),private.can_read_ticket(uuid) to authenticated;
revoke all on function public.create_team(text,text) from public,anon;
grant execute on function public.create_team(text,text) to authenticated;
-- Voice authorization is checked using the caller JWT, under the same RLS.
create function public.can_join_voice(channel_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.channels where id=channel_id and kind='voice' and private.can_write_channel(id));
$$;
revoke all on function public.can_join_voice(uuid) from public,anon;
grant execute on function public.can_join_voice(uuid) to authenticated;

insert into public.channels(name,category,kind,description,position) values
('geral','COMUNIDADE','text','O ponto de encontro da nossa comunidade.',1),
('avisos','COMUNIDADE','text','Comunicados oficiais da LYC.',2),
('resultados','COMUNIDADE','text','Cada partida conta uma história.',3),
('procurar-time','COMUNIDADE','text','Encontre seu próximo squad.',4),
('lobby','SALAS DE VOZ','voice','Conecte sua voz à comunidade.',5),
('treino','SALAS DE VOZ','voice','Prepare seu squad.',6),
('informações','DARKNESS LEAGUE','text','Tudo sobre a competição.',7),
('calendário','DARKNESS LEAGUE','text','Próximas rodadas.',8),
('classificação','DARKNESS LEAGUE','text','Acompanhe a temporada.',9),
('rodada-atual','DARKNESS LEAGUE','text','Central da rodada.',10);
-- Realtime topics must be private; public clients cannot join private team presence.
create policy arena_realtime_read on realtime.messages for select to authenticated using(
 extension in ('broadcast','presence') and
 case when realtime.topic() ~ '^(room|presence):[0-9a-f-]{36}$' then private.can_read_channel(split_part(realtime.topic(),':',2)::uuid) else false end
);
create policy arena_realtime_write on realtime.messages for insert to authenticated with check(
 extension in ('broadcast','presence') and
 case when realtime.topic() ~ '^(room|presence):[0-9a-f-]{36}$' then private.can_write_channel(split_part(realtime.topic(),':',2)::uuid) else false end
);
alter publication supabase_realtime add table public.messages,public.message_reactions,public.tickets,public.ticket_messages;
