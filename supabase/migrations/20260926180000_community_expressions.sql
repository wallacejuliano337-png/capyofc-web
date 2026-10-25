-- Community expressions: emojis, stickers and sounds
create table if not exists public.community_expressions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  kind text not null check (kind in ('emoji', 'sticker', 'sound')),
  name text not null check (length(trim(name)) between 2 and 32),
  file_url text not null,
  file_path text,
  description text not null default '',
  duration numeric(5,2),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(community_id, kind, name)
);

create index if not exists community_expressions_lookup on public.community_expressions(community_id, kind);
create index if not exists community_expressions_creator on public.community_expressions(created_by);

alter table public.community_expressions enable row level security;

create policy expressions_select on public.community_expressions
  for select to authenticated
  using (private.is_community_member(community_id));

create policy expressions_insert on public.community_expressions
  for insert to authenticated
  with check (
    exists (select 1 from public.communities where id = community_id and owner_id = auth.uid()) or
    private.community_permission(community_id, 'manage_community')
  );

create policy expressions_update on public.community_expressions
  for update to authenticated
  using (
    exists (select 1 from public.communities where id = community_id and owner_id = auth.uid()) or
    private.community_permission(community_id, 'manage_community')
  )
  with check (
    exists (select 1 from public.communities where id = community_id and owner_id = auth.uid()) or
    private.community_permission(community_id, 'manage_community')
  );

create policy expressions_delete on public.community_expressions
  for delete to authenticated
  using (
    exists (select 1 from public.communities where id = community_id and owner_id = auth.uid()) or
    private.community_permission(community_id, 'manage_community')
  );

-- Grant privileges
grant select, insert, update, delete on public.community_expressions to authenticated;
