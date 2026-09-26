-- Social layer: pair uniqueness, RPC-only writes, participant-scoped reads.
create table public.friendships(
 user_low uuid not null references public.profiles, user_high uuid not null references public.profiles,
 requester_id uuid not null references public.profiles,
 state text not null check(state in ('pending','accepted','declined','cancelled','removed')),
 updated_at timestamptz not null default now(), primary key(user_low,user_high),
 check(user_low<user_high),check(requester_id in (user_low,user_high))
);
create index friendships_high on public.friendships(user_high);
create index friendships_requester on public.friendships(requester_id);
create table public.user_blocks(
 user_id uuid not null references public.profiles,blocked_id uuid not null references public.profiles,
 active boolean not null default true,updated_at timestamptz not null default now(),
 primary key(user_id,blocked_id),check(user_id<>blocked_id)
);
create index blocks_target on public.user_blocks(blocked_id,user_id) where active;
create table public.dm_conversations(
 id uuid primary key default gen_random_uuid(),user_low uuid not null references public.profiles,user_high uuid not null references public.profiles,
 last_seq bigint not null default 0,updated_at timestamptz not null default now(),
 unique(user_low,user_high),check(user_low<user_high)
);
create index dm_conversations_high on public.dm_conversations(user_high);
create table public.dm_messages(
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.dm_conversations,
 author_id uuid not null references public.profiles,seq bigint not null,content text not null,
 reply_to uuid,created_at timestamptz not null default now(),edited_at timestamptz,deleted_at timestamptz,
 unique(conversation_id,seq),unique(id,conversation_id),
 foreign key(reply_to,conversation_id) references public.dm_messages(id,conversation_id),
 check((deleted_at is null and length(trim(content)) between 1 and 4000) or (deleted_at is not null and content=''))
);
create index dm_messages_author on public.dm_messages(author_id);
create index dm_messages_reply on public.dm_messages(reply_to,conversation_id);
create table public.dm_reads(
 conversation_id uuid not null references public.dm_conversations,user_id uuid not null references public.profiles,
 last_read_seq bigint not null default 0 check(last_read_seq>=0),primary key(conversation_id,user_id)
);
create index dm_reads_user on public.dm_reads(user_id);
-- Per-user invalidation avoids leaking private messages on broad broadcasts.
create table public.social_inbox(user_id uuid primary key references public.profiles,revision bigint not null default 0);
create table private.presence_preferences(user_id uuid primary key references public.profiles,status text not null default 'online' check(status in ('online','away','busy','invisible','offline')));
create table private.presence_sessions(user_id uuid not null references public.profiles,session_id uuid not null,expires_at timestamptz not null,primary key(user_id,session_id));
create table public.user_presence(user_id uuid primary key references public.profiles,status text not null default 'offline' check(status in ('online','away','busy','offline')),expires_at timestamptz);

create function private.social_seed() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.social_inbox(user_id) values(new.id);
 insert into public.user_presence(user_id) values(new.id);
 insert into private.presence_preferences(user_id,status) values(new.id,new.status);
 return new;end $$;
create trigger social_profile_seed after insert on public.profiles for each row execute function private.social_seed();
insert into public.social_inbox(user_id) select id from public.profiles;
insert into public.user_presence(user_id) select id from public.profiles;
insert into private.presence_preferences(user_id,status) select id,status from public.profiles;

create function private.social_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_blocks where active and ((user_id=a and blocked_id=b) or (user_id=b and blocked_id=a)))
$$;
create function private.dm_participant(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_user() and exists(select 1 from public.dm_conversations where id=cid and auth.uid() in (user_low,user_high))
$$;
create function private.social_touch(a uuid,b uuid) returns void language sql security definer set search_path='' as $$
 update public.social_inbox set revision=revision+1 where user_id in (a,b)
$$;

do $$declare t text;begin foreach t in array array['friendships','user_blocks','dm_conversations','dm_messages','dm_reads','social_inbox','user_presence'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
end loop;end $$;
alter table private.presence_preferences enable row level security;
alter table private.presence_sessions enable row level security;
revoke all on private.presence_preferences,private.presence_sessions from public,anon,authenticated;
create policy friendships_read on public.friendships for select to authenticated using(private.active_user() and (select auth.uid()) in (user_low,user_high));
create policy blocks_read on public.user_blocks for select to authenticated using(private.active_user() and user_id=(select auth.uid()));
create policy dm_conversations_read on public.dm_conversations for select to authenticated using(private.active_user() and (select auth.uid()) in (user_low,user_high));
create policy dm_messages_read on public.dm_messages for select to authenticated using(private.dm_participant(conversation_id));
create policy dm_reads_read on public.dm_reads for select to authenticated using(user_id=(select auth.uid()) and private.dm_participant(conversation_id));
create policy social_inbox_read on public.social_inbox for select to authenticated using(private.active_user() and user_id=(select auth.uid()));
create policy user_presence_read on public.user_presence for select to authenticated using(private.active_user() and (user_id=(select auth.uid()) or not private.social_blocked((select auth.uid()),user_id)));

create function private.social_command(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); target uuid; lo uuid; hi uuid; cid uuid; mid uuid; f public.friendships; c public.dm_conversations; m public.dm_messages; n bigint; requested bigint;
begin
 if uid is null or not private.active_user() then raise exception 'Authentication required' using errcode='42501';end if;
 if action in ('send_dm','edit_dm','delete_dm','read_dm') then
  cid=(payload->>'conversation_id')::uuid;
  select * into c from public.dm_conversations where id=cid;
  if not found or uid not in (c.user_low,c.user_high) then raise exception 'Private conversation access denied' using errcode='42501';end if;
  target=case when uid=c.user_low then c.user_high else c.user_low end;
 else target=(payload->>'user_id')::uuid;end if;
 if target is null or target=uid or not exists(select 1 from public.profiles where id=target) then raise exception 'Usuário inválido';end if;
 lo=least(uid,target);hi=greatest(uid,target);
 -- Every pair mutation, including block and message send, shares one lock.
 perform pg_advisory_xact_lock(hashtextextended(lo::text||hi::text,0));
 if action='block' then
  insert into public.user_blocks(user_id,blocked_id) values(uid,target) on conflict(user_id,blocked_id) do update set active=true,updated_at=now();
  update public.friendships set state='removed',updated_at=now() where user_low=lo and user_high=hi;
 elsif action='unblock' then
  update public.user_blocks set active=false,updated_at=now() where user_id=uid and blocked_id=target;
 elsif action in ('request_friend','accept_friend','decline_friend','cancel_friend','remove_friend') then
  if private.social_blocked(uid,target) then raise exception 'Interação privada indisponível' using errcode='42501';end if;
  select * into f from public.friendships where user_low=lo and user_high=hi;
  if action='request_friend' then
   if f.state in ('pending','accepted') then raise exception 'Já existe amizade ou solicitação pendente';end if;
   insert into public.friendships(user_low,user_high,requester_id,state) values(lo,hi,uid,'pending') on conflict(user_low,user_high) do update set requester_id=uid,state='pending',updated_at=now();
  elsif action='accept_friend' or action='decline_friend' then
   if f.state is distinct from 'pending' or f.requester_id=uid then raise exception 'Somente o destinatário pode responder' using errcode='42501';end if;
   update public.friendships set state=case when action='accept_friend' then 'accepted' else 'declined' end,updated_at=now() where user_low=lo and user_high=hi;
  elsif action='cancel_friend' then
   if f.state is distinct from 'pending' or f.requester_id<>uid then raise exception 'Somente o remetente pode cancelar' using errcode='42501';end if;
   update public.friendships set state='cancelled',updated_at=now() where user_low=lo and user_high=hi;
  else
   if f.state is distinct from 'accepted' then raise exception 'Amizade não encontrada';end if;
   update public.friendships set state='removed',updated_at=now() where user_low=lo and user_high=hi;
  end if;
 elsif action='open_dm' then
  if private.social_blocked(uid,target) then raise exception 'Interação privada indisponível' using errcode='42501';end if;
  insert into public.dm_conversations(user_low,user_high) values(lo,hi) on conflict(user_low,user_high) do update set user_low=excluded.user_low returning id into cid;
  insert into public.dm_reads(conversation_id,user_id) values(cid,uid),(cid,target) on conflict do nothing;
 elsif action='read_dm' then
  requested=(payload->>'through_seq')::bigint;
  if requested is null or requested<0 or requested>(select last_seq from public.dm_conversations where id=cid) then raise exception 'Marcador de leitura inválido';end if;
  insert into public.dm_reads(conversation_id,user_id,last_read_seq) values(cid,uid,requested) on conflict(conversation_id,user_id) do update set last_read_seq=greatest(public.dm_reads.last_read_seq,excluded.last_read_seq);
 elsif action in ('send_dm','edit_dm','delete_dm') then
  if action<>'delete_dm' and private.social_blocked(uid,target) then raise exception 'Interação privada indisponível' using errcode='42501';end if;
  if action='send_dm' then
   if nullif(payload->>'reply_to','') is not null and not exists(select 1 from public.dm_messages where id=(payload->>'reply_to')::uuid and conversation_id=cid and deleted_at is null) then raise exception 'Resposta inválida';end if;
   update public.dm_conversations set last_seq=last_seq+1,updated_at=clock_timestamp() where id=cid returning last_seq into n;
   insert into public.dm_messages(conversation_id,author_id,seq,content,reply_to) values(cid,uid,n,trim(payload->>'content'),nullif(payload->>'reply_to','')::uuid) returning id into mid;
  else
   mid=(payload->>'message_id')::uuid;
   select * into m from public.dm_messages where id=mid and conversation_id=cid;
   if not found or m.author_id<>uid then raise exception 'Somente o autor pode alterar a mensagem' using errcode='42501';end if;
   if m.deleted_at is not null then raise exception 'Mensagem já excluída';end if;
   if action='edit_dm' then update public.dm_messages set content=trim(payload->>'content'),edited_at=clock_timestamp() where id=mid;
   else update public.dm_messages set content='',deleted_at=clock_timestamp() where id=mid;end if;
  end if;
 else raise exception 'Unknown social action';end if;
 perform private.social_touch(uid,target);
 return case when mid is not null then to_jsonb(mid) when cid is not null then to_jsonb(cid) else 'true'::jsonb end;
end $$;
create function public.social_action(action text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.social_command(action,payload)$$;

create function private.presence_command(action text,p_session_id uuid,preference text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();pref text;expiry timestamptz;effective text;begin
 if uid is null or not private.active_user() then raise exception 'Authentication required' using errcode='42501';end if;
 -- Lock the preference row to combine independent desktop sessions safely.
 select status into pref from private.presence_preferences where user_id=uid for update;
 if action='set' then
  update private.presence_preferences set status=preference where user_id=uid returning status into pref;
 elsif action='heartbeat' then
  insert into private.presence_sessions(user_id,session_id,expires_at) values(uid,p_session_id,clock_timestamp()+interval '75 seconds') on conflict(user_id,session_id) do update set expires_at=excluded.expires_at;
 elsif action='leave' then delete from private.presence_sessions where user_id=uid and presence_sessions.session_id=p_session_id;
 elsif action<>'get' then raise exception 'Invalid presence action';end if;
 delete from private.presence_sessions where user_id=uid and expires_at<=clock_timestamp();
 select max(expires_at) into expiry from private.presence_sessions where user_id=uid;
 effective=case when expiry is null or pref in ('invisible','offline') then 'offline' else pref end;
 if effective='offline' then expiry=null;end if;
 update public.user_presence set status=effective,expires_at=expiry where user_id=uid and (status is distinct from effective or expires_at is distinct from expiry);
 if action='set' then perform private.social_touch(uid,uid);end if;
 return jsonb_build_object('preference',pref,'status',effective);
end $$;
create function public.presence_action(action text,session_id uuid,preference text default null) returns jsonb language sql security invoker set search_path='' as $$select private.presence_command(action,session_id,preference)$$;

-- Functions in private require explicit authenticated checks; internal helpers are not API endpoints.
revoke all on function private.social_seed(),private.social_blocked(uuid,uuid),private.dm_participant(uuid),private.social_touch(uuid,uuid),private.social_command(text,jsonb),public.social_action(text,jsonb),private.presence_command(text,uuid,text),public.presence_action(text,uuid,text) from public,anon,authenticated;
grant execute on function private.social_blocked(uuid,uuid),private.dm_participant(uuid),private.social_command(text,jsonb),public.social_action(text,jsonb),private.presence_command(text,uuid,text),public.presence_action(text,uuid,text) to authenticated;
alter publication supabase_realtime add table public.social_inbox,public.user_presence;

create function public.dm_inbox() returns table(id uuid,peer_id uuid,last_seq bigint,last_read_seq bigint,unread_count bigint,updated_at timestamptz) language sql stable security invoker set search_path='' as $$
 select c.id,case when c.user_low=auth.uid() then c.user_high else c.user_low end,c.last_seq,coalesce(r.last_read_seq,0),
 (select count(*) from public.dm_messages m where m.conversation_id=c.id and m.seq>coalesce(r.last_read_seq,0) and m.author_id<>auth.uid() and m.deleted_at is null),c.updated_at
 from public.dm_conversations c left join public.dm_reads r on r.conversation_id=c.id and r.user_id=auth.uid() order by c.updated_at desc,c.id
$$;
revoke all on function public.dm_inbox() from public,anon;
grant execute on function public.dm_inbox() to authenticated;
