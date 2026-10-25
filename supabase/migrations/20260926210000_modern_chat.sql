-- LYC Arena: Modern Chat Enhancements (Reactions, Replies, Attachments, Storage)

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb
);

create or replace function storage.foldername(name text)
returns text[] language plpgsql as $$
begin
  return string_to_array(name, '/');
end;
$$;

-- 1. Storage bucket for chat attachments
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain'];

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'attachments_read') then
    create policy attachments_read on storage.objects for select to authenticated
      using (bucket_id = 'attachments' and private.active_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'attachments_insert_own') then
    create policy attachments_insert_own on storage.objects for insert to authenticated
      with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text and private.active_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'attachments_delete_own') then
    create policy attachments_delete_own on storage.objects for delete to authenticated
      using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text and private.active_user());
  end if;
end $$;

-- 2. Alter public.messages to support attachments and soft delete
alter table public.messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.messages add column if not exists deleted_at timestamptz;

alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check
  check (
    (deleted_at is null and (length(trim(content)) between 1 and 4000 or jsonb_array_length(attachments) > 0))
    or (deleted_at is not null and content = '')
  );

-- 3. Alter public.dm_messages to support attachments
alter table public.dm_messages add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.dm_messages drop constraint if exists dm_messages_check;
alter table public.dm_messages add constraint dm_messages_check
  check (
    (deleted_at is null and (length(trim(content)) between 1 and 4000 or jsonb_array_length(attachments) > 0))
    or (deleted_at is not null and content = '')
  );

-- 4. Extend emoji length constraint on message_reactions for custom emojis
alter table public.message_reactions drop constraint if exists message_reactions_emoji_check;
alter table public.message_reactions add constraint message_reactions_emoji_check check(length(emoji) between 1 and 64);

-- 5. DM message reactions table
create table if not exists public.dm_message_reactions (
  message_id uuid not null references public.dm_messages(id) on delete cascade,
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check(length(emoji) between 1 and 64),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists dm_reactions_conv_msg on public.dm_message_reactions(conversation_id, message_id);
create index if not exists dm_reactions_user on public.dm_message_reactions(user_id);

grant select, insert, delete on public.dm_message_reactions to authenticated;
alter table public.dm_message_reactions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dm_message_reactions' and policyname = 'dm_reactions_select') then
    create policy dm_reactions_select on public.dm_message_reactions for select to authenticated
      using (
        exists (
          select 1 from public.dm_conversations c
          where c.id = conversation_id and (select auth.uid()) in (c.user_low, c.user_high)
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dm_message_reactions' and policyname = 'dm_reactions_insert') then
    create policy dm_reactions_insert on public.dm_message_reactions for insert to authenticated
      with check (
        user_id = (select auth.uid())
        and exists (
          select 1 from public.dm_conversations c
          where c.id = conversation_id and (select auth.uid()) in (c.user_low, c.user_high)
          and not private.social_blocked(c.user_low, c.user_high)
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dm_message_reactions' and policyname = 'dm_reactions_delete') then
    create policy dm_reactions_delete on public.dm_message_reactions for delete to authenticated
      using (
        user_id = (select auth.uid())
        and exists (
          select 1 from public.dm_conversations c
          where c.id = conversation_id and (select auth.uid()) in (c.user_low, c.user_high)
        )
      );
  end if;
end $$;

alter publication supabase_realtime add table public.dm_message_reactions;

-- 6. Update private.social_command to support attachments and react_dm
create or replace function private.social_command(action text, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  target uuid;
  lo uuid;
  hi uuid;
  cid uuid;
  mid uuid;
  f public.friendships;
  c public.dm_conversations;
  m public.dm_messages;
  n bigint;
  requested bigint;
  em text;
  ex boolean;
  res_payload jsonb;
begin
  if uid is null or not private.active_user() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if action in ('send_dm', 'edit_dm', 'delete_dm', 'read_dm', 'react_dm') then
    cid := (payload->>'conversation_id')::uuid;
    select * into c from public.dm_conversations where id = cid;
    if not found or uid not in (c.user_low, c.user_high) then
      raise exception 'Private conversation access denied' using errcode = '42501';
    end if;
    target := case when uid = c.user_low then c.user_high else c.user_low end;
  else
    target := (payload->>'user_id')::uuid;
  end if;

  if target is null or target = uid or not exists(select 1 from public.profiles where id = target) then
    raise exception 'Usuário inválido';
  end if;

  lo := least(uid, target);
  hi := greatest(uid, target);

  perform pg_advisory_xact_lock(hashtextextended(lo::text || hi::text, 0));

  if action = 'block' then
    insert into public.user_blocks(user_id, blocked_id)
      values (uid, target)
      on conflict (user_id, blocked_id) do update set active = true, updated_at = now();
    update public.friendships set state = 'removed', updated_at = now()
      where user_low = lo and user_high = hi;

  elsif action = 'unblock' then
    update public.user_blocks set active = false, updated_at = now()
      where user_id = uid and blocked_id = target;

  elsif action in ('request_friend', 'accept_friend', 'decline_friend', 'cancel_friend', 'remove_friend') then
    if private.social_blocked(uid, target) then
      raise exception 'Interação privada indisponível' using errcode = '42501';
    end if;

    select * into f from public.friendships where user_low = lo and user_high = hi;

    if action = 'request_friend' then
      if f.state in ('pending', 'accepted') then
        raise exception 'Já existe amizade ou solicitação pendente';
      end if;
      insert into public.friendships(user_low, user_high, requester_id, state)
        values (lo, hi, uid, 'pending')
        on conflict (user_low, user_high) do update set requester_id = uid, state = 'pending', updated_at = now();

    elsif action = 'accept_friend' or action = 'decline_friend' then
      if f.state is distinct from 'pending' or f.requester_id = uid then
        raise exception 'Somente o destinatário pode responder' using errcode = '42501';
      end if;
      update public.friendships set
        state = case when action = 'accept_friend' then 'accepted' else 'declined' end,
        updated_at = now()
        where user_low = lo and user_high = hi;

    elsif action = 'cancel_friend' then
      if f.state is distinct from 'pending' or f.requester_id <> uid then
        raise exception 'Somente o remetente pode cancelar' using errcode = '42501';
      end if;
      update public.friendships set state = 'cancelled', updated_at = now()
        where user_low = lo and user_high = hi;

    else
      if f.state is distinct from 'accepted' then
        raise exception 'Amizade não encontrada';
      end if;
      update public.friendships set state = 'removed', updated_at = now()
        where user_low = lo and user_high = hi;
    end if;

  elsif action = 'open_dm' then
    if private.social_blocked(uid, target) then
      raise exception 'Interação privada indisponível' using errcode = '42501';
    end if;
    insert into public.dm_conversations(user_low, user_high)
      values (lo, hi)
      on conflict (user_low, user_high) do update set user_low = excluded.user_low
      returning id into cid;
    insert into public.dm_reads(conversation_id, user_id)
      values (cid, uid), (cid, target)
      on conflict do nothing;

  elsif action = 'read_dm' then
    requested := (payload->>'through_seq')::bigint;
    if requested is null or requested < 0 or requested > (select last_seq from public.dm_conversations where id = cid) then
      raise exception 'Marcador de leitura inválido';
    end if;
    insert into public.dm_reads(conversation_id, user_id, last_read_seq)
      values (cid, uid, requested)
      on conflict (conversation_id, user_id) do update set
        last_read_seq = greatest(public.dm_reads.last_read_seq, excluded.last_read_seq);

  elsif action in ('send_dm', 'edit_dm', 'delete_dm') then
    if action <> 'delete_dm' and private.social_blocked(uid, target) then
      raise exception 'Interação privada indisponível' using errcode = '42501';
    end if;

    if action = 'send_dm' then
      if nullif(payload->>'reply_to', '') is not null and not exists(
        select 1 from public.dm_messages where id = (payload->>'reply_to')::uuid and conversation_id = cid and deleted_at is null
      ) then
        raise exception 'Resposta inválida';
      end if;

      update public.dm_conversations set
        last_seq = last_seq + 1,
        updated_at = clock_timestamp()
      where id = cid
      returning last_seq into n;

      insert into public.dm_messages (
        conversation_id, author_id, seq, content, reply_to, attachments
      ) values (
        cid,
        uid,
        n,
        coalesce(trim(payload->>'content'), ''),
        nullif(payload->>'reply_to', '')::uuid,
        coalesce(payload->'attachments', '[]'::jsonb)
      ) returning id into mid;

    else
      mid := (payload->>'message_id')::uuid;
      select * into m from public.dm_messages where id = mid and conversation_id = cid;
      if not found or m.author_id <> uid then
        raise exception 'Somente o autor pode alterar a mensagem' using errcode = '42501';
      end if;
      if m.deleted_at is not null then
        raise exception 'Mensagem já excluída';
      end if;

      if action = 'edit_dm' then
        update public.dm_messages set
          content = coalesce(trim(payload->>'content'), ''),
          edited_at = clock_timestamp()
        where id = mid;
      else
        update public.dm_messages set
          content = '',
          deleted_at = clock_timestamp()
        where id = mid;
      end if;
    end if;

  elsif action = 'react_dm' then
    if private.social_blocked(uid, target) then
      raise exception 'Interação privada indisponível' using errcode = '42501';
    end if;

    mid := (payload->>'message_id')::uuid;
    select * into m from public.dm_messages where id = mid and conversation_id = cid;
    if not found or m.deleted_at is not null then
      raise exception 'Mensagem não encontrada';
    end if;

    em := trim(payload->>'emoji');
    if em is null or length(em) < 1 or length(em) > 64 then
      raise exception 'Emoji inválido';
    end if;

    select exists(
      select 1 from public.dm_message_reactions
      where message_id = mid and user_id = uid and emoji = em
    ) into ex;

    if ex then
      delete from public.dm_message_reactions
      where message_id = mid and user_id = uid and emoji = em;
      res_payload := jsonb_build_object('added', false, 'emoji', em, 'message_id', mid);
    else
      insert into public.dm_message_reactions(message_id, conversation_id, user_id, emoji)
        values (mid, cid, uid, em);
      res_payload := jsonb_build_object('added', true, 'emoji', em, 'message_id', mid);
    end if;

  else
    raise exception 'Unknown social action';
  end if;

  perform private.social_touch(uid, target);

  return case
    when res_payload is not null then res_payload
    when mid is not null then to_jsonb(mid)
    when cid is not null then to_jsonb(cid)
    else 'true'::jsonb
  end;
end $$;
