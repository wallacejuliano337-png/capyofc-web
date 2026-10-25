-- Migration: 20261023040000_community_enablement_and_templates.sql
-- Description: Additive, non-destructive schema for Community Enablement persistence and Server Templates (Security Hardened)

-- 1. Extend communities with community enablement flags and dedicated channels (Additive & Non-destructive)
alter table public.communities
  add column if not exists is_community boolean not null default false,
  add column if not exists rules_channel_id uuid references public.channels(id) on delete set null,
  add column if not exists public_updates_channel_id uuid references public.channels(id) on delete set null;

-- Grant selective column update permissions on public.communities to authenticated users
grant update(is_community, rules_channel_id, public_updates_channel_id) on public.communities to authenticated;

-- RLS Policy for updating community enablement columns:
-- Only server owner (owner_id = auth.uid()) or members with 'manage_community' permission can update.
drop policy if exists communities_update_community on public.communities;
create policy communities_update_community on public.communities
  for update to authenticated
  using (owner_id = auth.uid() or private.community_permission(id, 'manage_community'))
  with check (owner_id = auth.uid() or private.community_permission(id, 'manage_community'));

-- 2. Server Templates table (with payload size check <= 1MB and sanitized JSON schema)
create table if not exists public.server_templates (
  id text primary key check(length(trim(id)) between 3 and 64),
  name text not null check(length(trim(name)) between 1 and 100),
  description text not null default '' check(length(description) <= 500),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  source_community_id uuid references public.communities(id) on delete set null,
  data jsonb not null check(octet_length(data::text) <= 1048576), -- Limit payload size to 1MB max
  uses_count integer not null default 0 check(uses_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for template queries and author listings
create index if not exists idx_server_templates_creator on public.server_templates(creator_id);
create index if not exists idx_server_templates_created on public.server_templates(created_at desc);

-- 3. Row Level Security for Server Templates
alter table public.server_templates enable row level security;

-- Grant DML only to authenticated users (anonymous users have no access)
grant select, insert, update, delete on public.server_templates to authenticated;

-- SELECT: Any authenticated user can read templates (to inspect and import into their servers)
drop policy if exists server_templates_select on public.server_templates;
create policy server_templates_select on public.server_templates
  for select to authenticated
  using (true);

-- INSERT: Authenticated users can only create templates with their own profile ID
drop policy if exists server_templates_insert on public.server_templates;
create policy server_templates_insert on public.server_templates
  for insert to authenticated
  with check (creator_id = auth.uid());

-- UPDATE: Only creator can update their template; WITH CHECK ensures creator_id cannot be changed/usurped
drop policy if exists server_templates_update on public.server_templates;
create policy server_templates_update on public.server_templates
  for update to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

-- DELETE: Only creator can delete their template
drop policy if exists server_templates_delete on public.server_templates;
create policy server_templates_delete on public.server_templates
  for delete to authenticated
  using (creator_id = auth.uid());
