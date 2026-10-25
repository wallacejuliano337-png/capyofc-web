-- Migration: 20260926150000_community_audit_logs.sql
-- Description: Schema for community-scoped administrative audit logging

create table if not exists public.community_audit_logs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id),
  action_type text not null,
  target_type text not null,
  target_id text,
  target_name text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for efficient queries
create index if not exists idx_community_audit_logs_comm_created 
  on public.community_audit_logs(community_id, created_at desc);

create index if not exists idx_community_audit_logs_actor 
  on public.community_audit_logs(community_id, actor_user_id);

create index if not exists idx_community_audit_logs_action 
  on public.community_audit_logs(community_id, action_type);

-- Row Level Security
alter table public.community_audit_logs enable row level security;

-- Only community owners and authorized administrators/moderators can view audit logs
create policy community_audit_select on public.community_audit_logs
  for select to authenticated
  using (
    exists (
      select 1 from public.communities c
      where c.id = community_id and c.owner_id = auth.uid()
    )
    or private.community_permission(community_id, 'manage_community')
    or private.community_permission(community_id, 'manage_roles')
    or private.community_permission(community_id, 'manage_channels')
    or private.community_permission(community_id, 'moderate_members')
  );

-- Revoke all modifications from public/anon/authenticated: append-only through secure backend definer functions
revoke insert, update, delete on public.community_audit_logs from anon, authenticated;
