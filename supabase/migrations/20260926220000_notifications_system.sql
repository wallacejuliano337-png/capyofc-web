-- LYC Arena: Real Notifications System (Unreads, Mentions, Read States, Preferences)

-- 1. Channel Reads table (stores O(1) last read marker per user per channel)
create table if not exists public.channel_reads (
  channel_id uuid not null references public.channels on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  last_read_message_id uuid references public.messages on delete set null,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists channel_reads_user on public.channel_reads (user_id);

alter table public.channel_reads enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'channel_reads' and policyname = 'channel_reads_select') then
    create policy channel_reads_select on public.channel_reads
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'channel_reads' and policyname = 'channel_reads_insert') then
    create policy channel_reads_insert on public.channel_reads
      for insert to authenticated
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'channel_reads' and policyname = 'channel_reads_update') then
    create policy channel_reads_update on public.channel_reads
      for update to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

alter publication supabase_realtime add table public.channel_reads;

-- 2. User Notification Settings (Desktop, Sounds, DMs, Mentions, Calls)
create table if not exists public.user_notification_settings (
  user_id uuid primary key references public.profiles on delete cascade,
  desktop_enabled boolean not null default true,
  sounds_enabled boolean not null default true,
  dms_enabled boolean not null default true,
  mentions_enabled boolean not null default true,
  calls_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_notification_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_notification_settings' and policyname = 'user_notif_select') then
    create policy user_notif_select on public.user_notification_settings
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_notification_settings' and policyname = 'user_notif_insert') then
    create policy user_notif_insert on public.user_notification_settings
      for insert to authenticated
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_notification_settings' and policyname = 'user_notif_update') then
    create policy user_notif_update on public.user_notification_settings
      for update to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

-- 3. Community Notification Settings ('all', 'mentions', 'nothing')
create table if not exists public.community_notification_settings (
  community_id uuid not null references public.communities on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  level text not null default 'all' check (level in ('all', 'mentions', 'nothing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.community_notification_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_notification_settings' and policyname = 'comm_notif_select') then
    create policy comm_notif_select on public.community_notification_settings
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_notification_settings' and policyname = 'comm_notif_insert') then
    create policy comm_notif_insert on public.community_notification_settings
      for insert to authenticated
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_notification_settings' and policyname = 'comm_notif_update') then
    create policy comm_notif_update on public.community_notification_settings
      for update to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

-- 4. Channel Notification Settings ('default', 'all', 'mentions', 'nothing')
create table if not exists public.channel_notification_settings (
  channel_id uuid not null references public.channels on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  level text not null default 'default' check (level in ('default', 'all', 'mentions', 'nothing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

alter table public.channel_notification_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'channel_notification_settings' and policyname = 'chan_notif_select') then
    create policy chan_notif_select on public.channel_notification_settings
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'channel_notification_settings' and policyname = 'chan_notif_insert') then
    create policy chan_notif_insert on public.channel_notification_settings
      for insert to authenticated
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'channel_notification_settings' and policyname = 'chan_notif_update') then
    create policy chan_notif_update on public.channel_notification_settings
      for update to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

-- 5. RPC to mark channel as read
create or replace function public.mark_channel_read(
  p_channel_id uuid,
  p_message_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  msg_time timestamptz;
  target_msg_id uuid := p_message_id;
begin
  if uid is null or not private.active_user() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not private.can_read_channel(p_channel_id) then
    raise exception 'Acesso negado ao canal' using errcode = '42501';
  end if;

  if target_msg_id is not null then
    select created_at into msg_time from public.messages where id = target_msg_id and channel_id = p_channel_id;
  else
    select id, created_at into target_msg_id, msg_time from public.messages where channel_id = p_channel_id order by created_at desc limit 1;
  end if;
  msg_time := coalesce(msg_time, clock_timestamp());

  insert into public.channel_reads (channel_id, user_id, last_read_message_id, last_read_at)
  values (p_channel_id, uid, target_msg_id, msg_time)
  on conflict (channel_id, user_id) do update set
    last_read_message_id = coalesce(excluded.last_read_message_id, public.channel_reads.last_read_message_id),
    last_read_at = greatest(public.channel_reads.last_read_at, excluded.last_read_at);

  return jsonb_build_object('success', true, 'channel_id', p_channel_id, 'last_read_at', msg_time);
end;
$$;
grant execute on function public.mark_channel_read(uuid, uuid) to authenticated;

-- 6. RPC to get channel unreads & mentions for a community (avoids N+1 queries)
create or replace function public.get_community_unreads(p_community_id uuid)
returns table (
  channel_id uuid,
  unread_count bigint,
  mention_count bigint,
  last_message_id uuid,
  last_read_message_id uuid,
  last_read_at timestamptz
) language sql stable security invoker set search_path = '' as $$
  with my_reads as (
    select cr.channel_id, cr.last_read_message_id, cr.last_read_at
    from public.channel_reads cr
    where cr.user_id = auth.uid()
  ),
  my_profile as (
    select username from public.profiles where id = auth.uid()
  )
  select
    c.id as channel_id,
    count(m.id) filter (
      where m.created_at > coalesce(r.last_read_at, '1970-01-01'::timestamptz)
      and m.author_id <> auth.uid()
      and m.deleted_at is null
    ) as unread_count,
    count(m.id) filter (
      where m.created_at > coalesce(r.last_read_at, '1970-01-01'::timestamptz)
      and m.author_id <> auth.uid()
      and m.deleted_at is null
      and (
        m.content ilike '%@' || coalesce((select username from my_profile), '') || '%'
        or m.content ~* '\m@(everyone|here)\M'
      )
    ) as mention_count,
    (select m2.id from public.messages m2 where m2.channel_id = c.id order by m2.created_at desc limit 1) as last_message_id,
    r.last_read_message_id,
    r.last_read_at
  from public.channels c
  left join my_reads r on r.channel_id = c.id
  left join public.messages m on m.channel_id = c.id
  where c.community_id = p_community_id
    and private.can_read_channel(c.id)
  group by c.id, r.last_read_message_id, r.last_read_at;
$$;
grant execute on function public.get_community_unreads(uuid) to authenticated;

-- 7. RPC to get unread summary for all communities (for server rail badges)
create or replace function public.get_all_communities_unreads()
returns table (
  community_id uuid,
  has_unreads boolean,
  mention_count bigint
) language sql stable security invoker set search_path = '' as $$
  with my_reads as (
    select cr.channel_id, cr.last_read_at
    from public.channel_reads cr
    where cr.user_id = auth.uid()
  ),
  my_profile as (
    select username from public.profiles where id = auth.uid()
  )
  select
    c.community_id,
    bool_or(m.created_at > coalesce(r.last_read_at, '1970-01-01'::timestamptz) and m.author_id <> auth.uid() and m.deleted_at is null) as has_unreads,
    count(m.id) filter (
      where m.created_at > coalesce(r.last_read_at, '1970-01-01'::timestamptz)
      and m.author_id <> auth.uid()
      and m.deleted_at is null
      and (
        m.content ilike '%@' || coalesce((select username from my_profile), '') || '%'
        or m.content ~* '\m@(everyone|here)\M'
      )
    ) as mention_count
  from public.channels c
  left join my_reads r on r.channel_id = c.id
  left join public.messages m on m.channel_id = c.id
  where c.community_id is not null
    and private.can_read_channel(c.id)
  group by c.community_id;
$$;
grant execute on function public.get_all_communities_unreads() to authenticated;
