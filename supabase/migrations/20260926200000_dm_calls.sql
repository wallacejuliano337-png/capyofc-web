-- Migration: 20260926200000_dm_calls.sql
-- DM 1:1 Private Calls (Voice, Video, Screen Share) with LiveKit & Realtime Signaling

create table if not exists public.dm_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  caller_id uuid not null references public.profiles(id),
  receiver_id uuid not null references public.profiles(id),
  call_type text not null check(call_type in ('voice', 'video')) default 'voice',
  status text not null check(status in ('calling', 'ringing', 'connected', 'declined', 'missed', 'ended', 'failed')) default 'calling',
  room_name text not null unique,
  duration_seconds integer not null default 0 check(duration_seconds >= 0),
  started_at timestamptz not null default now(),
  connected_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(caller_id <> receiver_id)
);

-- At most one active call per conversation at any time
create unique index if not exists dm_active_calls_idx on public.dm_calls(conversation_id)
  where status in ('calling', 'ringing', 'connected');

create index if not exists dm_calls_conv_idx on public.dm_calls(conversation_id, created_at desc);
create index if not exists dm_calls_caller_idx on public.dm_calls(caller_id);
create index if not exists dm_calls_receiver_idx on public.dm_calls(receiver_id);

alter table public.dm_calls replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'dm_calls'
  ) then
    alter publication supabase_realtime add table public.dm_calls;
  end if;
end $$;

alter table public.dm_calls enable row level security;
revoke all on public.dm_calls from public, anon, authenticated;
grant select on public.dm_calls to authenticated;

-- RLS: Only call participants can select their calls
drop policy if exists dm_calls_select on public.dm_calls;
create policy dm_calls_select on public.dm_calls
  for select to authenticated
  using (
    private.active_user() and
    (select auth.uid()) in (caller_id, receiver_id)
  );

-- Backend check for Edge Function token generation
create or replace function public.can_join_dm_call(call_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.active_user() and exists (
    select 1 from public.dm_calls c
    where c.id = call_id
      and (select auth.uid()) in (c.caller_id, c.receiver_id)
      and c.status in ('calling', 'ringing', 'connected')
      and not private.social_blocked(c.caller_id, c.receiver_id)
  );
$$;

revoke all on function public.can_join_dm_call(uuid) from public, anon;
grant execute on function public.can_join_dm_call(uuid) to authenticated;

-- Unified Call RPC Action with transaction safety and participant scoping
create or replace function public.call_action(action text, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  call_rec public.dm_calls;
  conv public.dm_conversations;
  target uuid;
  c_type text;
  now_ts timestamptz := clock_timestamp();
  new_call_id uuid;
  new_room text;
  dur integer;
begin
  if uid is null or not private.active_user() then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if action = 'start_call' then
    cid := (payload->>'conversation_id')::uuid;
    select * into conv from public.dm_conversations where id = cid;
    if not found or uid not in (conv.user_low, conv.user_high) then
      raise exception 'Private conversation access denied' using errcode='42501';
    end if;

    target := case when uid = conv.user_low then conv.user_high else conv.user_low end;
    if private.social_blocked(uid, target) then
      raise exception 'Interação privada indisponível' using errcode='42501';
    end if;

    -- If there is already an active call in this conversation, reuse it
    select * into call_rec from public.dm_calls
      where conversation_id = cid and status in ('calling', 'ringing', 'connected')
      order by created_at desc limit 1;

    if found then
      return to_jsonb(call_rec);
    end if;

    c_type := coalesce(nullif(payload->>'call_type', ''), 'voice');
    if c_type not in ('voice', 'video') then
      c_type := 'voice';
    end if;

    new_call_id := gen_random_uuid();
    new_room := 'dm-' || new_call_id::text;

    insert into public.dm_calls (
      id, conversation_id, caller_id, receiver_id, call_type, status, room_name, started_at, created_at, updated_at
    ) values (
      new_call_id, cid, uid, target, c_type, 'calling', new_room, now_ts, now_ts, now_ts
    ) returning * into call_rec;

    perform private.social_touch(uid, target);
    return to_jsonb(call_rec);

  elsif action = 'answer_call' then
    new_call_id := (payload->>'call_id')::uuid;
    select * into call_rec from public.dm_calls where id = new_call_id;
    if not found or uid <> call_rec.receiver_id then
      raise exception 'Somente o destinatário pode atender a chamada' using errcode='42501';
    end if;

    if call_rec.status not in ('calling', 'ringing') then
      return to_jsonb(call_rec);
    end if;

    update public.dm_calls set
      status = 'connected',
      connected_at = now_ts,
      updated_at = now_ts
    where id = new_call_id
    returning * into call_rec;

    perform private.social_touch(call_rec.caller_id, call_rec.receiver_id);
    return to_jsonb(call_rec);

  elsif action = 'decline_call' then
    new_call_id := (payload->>'call_id')::uuid;
    select * into call_rec from public.dm_calls where id = new_call_id;
    if not found or uid <> call_rec.receiver_id then
      raise exception 'Somente o destinatário pode recusar a chamada' using errcode='42501';
    end if;

    if call_rec.status not in ('calling', 'ringing') then
      return to_jsonb(call_rec);
    end if;

    update public.dm_calls set
      status = 'declined',
      ended_at = now_ts,
      updated_at = now_ts
    where id = new_call_id
    returning * into call_rec;

    perform private.social_touch(call_rec.caller_id, call_rec.receiver_id);
    return to_jsonb(call_rec);

  elsif action = 'end_call' then
    new_call_id := (payload->>'call_id')::uuid;
    select * into call_rec from public.dm_calls where id = new_call_id;
    if not found or uid not in (call_rec.caller_id, call_rec.receiver_id) then
      raise exception 'Acesso não autorizado para encerrar a chamada' using errcode='42501';
    end if;

    if call_rec.status in ('ended', 'declined', 'missed', 'failed') then
      return to_jsonb(call_rec);
    end if;

    if call_rec.connected_at is not null then
      dur := greatest(0, round(extract(epoch from (now_ts - call_rec.connected_at))))::int;
    else
      dur := 0;
    end if;

    update public.dm_calls set
      status = 'ended',
      ended_at = now_ts,
      duration_seconds = dur,
      updated_at = now_ts
    where id = new_call_id
    returning * into call_rec;

    perform private.social_touch(call_rec.caller_id, call_rec.receiver_id);
    return to_jsonb(call_rec);

  elsif action = 'miss_call' then
    new_call_id := (payload->>'call_id')::uuid;
    select * into call_rec from public.dm_calls where id = new_call_id;
    if not found or uid not in (call_rec.caller_id, call_rec.receiver_id) then
      raise exception 'Acesso não autorizado' using errcode='42501';
    end if;

    if call_rec.status not in ('calling', 'ringing') then
      return to_jsonb(call_rec);
    end if;

    update public.dm_calls set
      status = 'missed',
      ended_at = now_ts,
      updated_at = now_ts
    where id = new_call_id
    returning * into call_rec;

    perform private.social_touch(call_rec.caller_id, call_rec.receiver_id);
    return to_jsonb(call_rec);

  elsif action = 'get_active_call' then
    select * into call_rec from public.dm_calls
      where (caller_id = uid or receiver_id = uid)
        and status in ('calling', 'ringing', 'connected')
      order by created_at desc limit 1;

    if not found then
      return 'null'::jsonb;
    end if;
    return to_jsonb(call_rec);

  else
    raise exception 'Ação de chamada desconhecida: %', action;
  end if;
end;
$$;

revoke all on function public.call_action(text, jsonb) from public, anon;
grant execute on function public.call_action(text, jsonb) to authenticated;

notify pgrst, 'reload schema';
