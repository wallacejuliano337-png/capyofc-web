alter table public.profiles
  add column banner_url text,
  add column bio text not null default '' check (char_length(bio) <= 500),
  add column profile_primary_color text not null default '#142744' check (profile_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column profile_secondary_color text not null default '#30204c' check (profile_secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column profile_accent_color text not null default '#7588f5' check (profile_accent_color ~ '^#[0-9A-Fa-f]{6}$');
grant update (banner_url, bio, profile_primary_color, profile_secondary_color, profile_accent_color) on public.profiles to authenticated;
grant select (banner_url, bio, profile_primary_color, profile_secondary_color, profile_accent_color) on public.profiles to authenticated;
update storage.buckets set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'] where id = 'avatars';
-- Existing profiles_edit and avatars_*_own policies continue to enforce ownership.
-- No existing profile values, files, policies or privileges are removed.
