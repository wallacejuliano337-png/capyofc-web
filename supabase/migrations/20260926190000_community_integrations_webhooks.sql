-- Migration: 20260926190000_community_integrations_webhooks.sql
-- Description: Community integrations, webhooks, secure tokens, and webhook messages support

-- 1. Community Webhooks Table
create table if not exists public.community_webhooks (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 64),
  avatar_url text,
  token text not null unique check (length(token) >= 20) default ('lyc_wh_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists community_webhooks_community_idx on public.community_webhooks(community_id);
create index if not exists community_webhooks_channel_idx on public.community_webhooks(channel_id);
create index if not exists community_webhooks_token_idx on public.community_webhooks(token);

-- 2. Community Integrations Table
create table if not exists public.community_integrations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 64),
  icon_url text,
  description text not null default '',
  status text not null default 'Conectado' check (status in ('Conectado', 'Desativado', 'Erro')),
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  connected_by uuid not null references public.profiles(id),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_integrations_community_idx on public.community_integrations(community_id);

-- 3. Messages table webhook attribution columns
alter table public.messages add column if not exists webhook_id uuid references public.community_webhooks(id) on delete set null;
alter table public.messages add column if not exists webhook_name text;
alter table public.messages add column if not exists webhook_avatar_url text;
create index if not exists messages_webhook_idx on public.messages(webhook_id) where webhook_id is not null;

-- 4. Row Level Security for Webhooks
alter table public.community_webhooks enable row level security;

-- Read webhooks: ONLY community owner or members with manage_community permission
create policy community_webhooks_read on public.community_webhooks
  for select to authenticated
  using (
    exists (
      select 1 from public.communities c
      where c.id = community_webhooks.community_id
        and c.owner_id = auth.uid()
    )
    or private.community_permission(community_webhooks.community_id, 'manage_community')
  );

-- Insert/Update/Delete webhooks: ONLY community owner or members with manage_community
create policy community_webhooks_write on public.community_webhooks
  for all to authenticated
  using (
    exists (
      select 1 from public.communities c
      where c.id = community_webhooks.community_id
        and c.owner_id = auth.uid()
    )
    or private.community_permission(community_webhooks.community_id, 'manage_community')
  )
  with check (
    exists (
      select 1 from public.communities c
      where c.id = community_webhooks.community_id
        and c.owner_id = auth.uid()
    )
    or private.community_permission(community_webhooks.community_id, 'manage_community')
  );

-- 5. Row Level Security for Integrations
alter table public.community_integrations enable row level security;

create policy community_integrations_read on public.community_integrations
  for select to authenticated
  using (
    exists (
      select 1 from public.community_members m
      where m.community_id = community_integrations.community_id
        and m.user_id = auth.uid()
        and m.left_at is null
    )
    or exists (
      select 1 from public.communities c
      where c.id = community_integrations.community_id
        and c.owner_id = auth.uid()
    )
  );

create policy community_integrations_write on public.community_integrations
  for all to authenticated
  using (
    exists (
      select 1 from public.communities c
      where c.id = community_integrations.community_id
        and c.owner_id = auth.uid()
    )
    or private.community_permission(community_integrations.community_id, 'manage_community')
  )
  with check (
    exists (
      select 1 from public.communities c
      where c.id = community_integrations.community_id
        and c.owner_id = auth.uid()
    )
    or private.community_permission(community_integrations.community_id, 'manage_community')
  );

-- 6. RPC: Regenerate Webhook Token
create or replace function public.regenerate_community_webhook_token(
  p_webhook_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  wh public.community_webhooks;
  new_token text;
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Autenticação necessária' using errcode='42501';
  end if;

  select * into wh from public.community_webhooks where id = p_webhook_id;
  if not found then
    raise exception 'Webhook não encontrado' using errcode='42501';
  end if;

  if not (
    exists (
      select 1 from public.communities c
      where c.id = wh.community_id and c.owner_id = caller_id
    )
    or private.community_permission(wh.community_id, 'manage_community')
  ) then
    raise exception 'Permissão negada' using errcode='42501';
  end if;

  new_token := 'lyc_wh_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  update public.community_webhooks
  set token = new_token, updated_at = now()
  where id = wh.id;

  return jsonb_build_object(
    'id', wh.id,
    'token', new_token
  );
end $$;

grant execute on function public.regenerate_community_webhook_token(uuid) to authenticated;

-- 7. RPC: Execute Webhook Message Delivery
create or replace function public.execute_community_webhook(
  p_webhook_id uuid,
  p_token text,
  p_content text,
  p_override_name text default null,
  p_override_avatar text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  wh public.community_webhooks;
  ch public.channels;
  clean_msg text;
  msg_id uuid;
  final_name text;
  final_avatar text;
begin
  if p_webhook_id is null or p_token is null or length(trim(p_token)) < 20 then
    raise exception 'Credenciais de webhook inválidas' using errcode='42501';
  end if;

  select * into wh from public.community_webhooks where id = p_webhook_id;
  if not found or wh.token <> p_token then
    raise exception 'Webhook não encontrado ou token inválido' using errcode='42501';
  end if;

  if not wh.is_active then
    raise exception 'Este webhook está desativado' using errcode='42501';
  end if;

  select * into ch from public.channels where id = wh.channel_id;
  if not found or ch.deleted_at is not null or ch.kind <> 'text' then
    raise exception 'Canal de destino inválido ou excluído' using errcode='22023';
  end if;

  clean_msg := trim(p_content);
  if length(clean_msg) < 1 or length(clean_msg) > 4000 then
    raise exception 'Conteúdo da mensagem deve ter entre 1 e 4000 caracteres' using errcode='22023';
  end if;

  final_name := coalesce(nullif(trim(p_override_name), ''), wh.name);
  final_avatar := coalesce(nullif(trim(p_override_avatar), ''), wh.avatar_url);

  insert into public.messages (
    channel_id,
    author_id,
    content,
    webhook_id,
    webhook_name,
    webhook_avatar_url
  ) values (
    wh.channel_id,
    wh.created_by,
    clean_msg,
    wh.id,
    final_name,
    final_avatar
  ) returning id into msg_id;

  update public.community_webhooks
  set last_used_at = now()
  where id = wh.id;

  return jsonb_build_object(
    'success', true,
    'message_id', msg_id,
    'channel_id', wh.channel_id,
    'community_id', wh.community_id,
    'webhook_name', final_name
  );
end $$;

grant execute on function public.execute_community_webhook(uuid, text, text, text, text) to authenticated, anon;
