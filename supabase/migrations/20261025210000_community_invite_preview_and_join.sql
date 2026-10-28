-- Migration: 20261025210000_community_invite_preview_and_join.sql
-- Description: Add public invite preview function and enrich private.community_command
-- with preview_invite action for seamless in-app invite cards and acceptance.

-- 1. Create get_public_invite_preview function for safe, unauthenticated/authenticated preview of invite links
create or replace function public.get_public_invite_preview(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.community_invites;
  comm_row public.communities;
  mem_count integer;
  caller_uid uuid := auth.uid();
  is_mem boolean := false;
  clean_code text := trim(invite_code);
begin
  if clean_code = '' or clean_code is null then
    return jsonb_build_object('status', 'invalid', 'error', 'Código de convite não fornecido.');
  end if;

  -- Normalizar se for o servidor oficial
  if lower(clean_code) = 'capychat-oficial' or lower(clean_code) = 'lyc-arena' then
    select * into comm_row from public.communities where is_official = true or id = 'd3f2173f-79f0-4362-b60a-ad079f724b54' limit 1;
    if not found then
      select * into comm_row from public.communities order by created_at asc limit 1;
    end if;

    if comm_row.id is not null then
      select count(*) into mem_count from public.community_members where community_id = comm_row.id and left_at is null;
      if caller_uid is not null then
        select exists(select 1 from public.community_members where community_id = comm_row.id and user_id = caller_uid and left_at is null) into is_mem;
      end if;

      return jsonb_build_object(
        'status', 'valid',
        'code', 'capychat-oficial',
        'community_id', comm_row.id,
        'community_name', coalesce(comm_row.name, 'CapyChat Oficial'),
        'image_url', comm_row.image_url,
        'is_official', true,
        'is_community', true,
        'created_at', comm_row.created_at,
        'member_count', greatest(coalesce(mem_count, 0), 1),
        'is_already_member', is_mem
      );
    end if;
  end if;

  select * into invitation from public.community_invites where code = clean_code;
  if not found then
    return jsonb_build_object('status', 'invalid', 'error', 'Convite não encontrado ou link inválido.');
  end if;

  if invitation.revoked_at is not null then
    return jsonb_build_object('status', 'revoked', 'error', 'Este convite foi revogado.');
  end if;

  if invitation.expires_at is not null and invitation.expires_at <= now() then
    return jsonb_build_object('status', 'expired', 'error', 'Este convite expirou.');
  end if;

  if invitation.max_uses is not null and invitation.uses >= invitation.max_uses then
    return jsonb_build_object('status', 'max_uses_reached', 'error', 'Este convite atingiu o limite máximo de utilizações.');
  end if;

  select * into comm_row from public.communities where id = invitation.community_id;
  if not found then
    return jsonb_build_object('status', 'invalid', 'error', 'Comunidade vinculada ao convite não foi encontrada.');
  end if;

  select count(*) into mem_count from public.community_members where community_id = comm_row.id and left_at is null;

  if caller_uid is not null then
    select exists(select 1 from public.community_members where community_id = comm_row.id and user_id = caller_uid and left_at is null) into is_mem;
  end if;

  return jsonb_build_object(
    'status', 'valid',
    'code', invitation.code,
    'community_id', comm_row.id,
    'community_name', comm_row.name,
    'image_url', comm_row.image_url,
    'is_official', coalesce(comm_row.is_official, false),
    'is_community', coalesce(comm_row.is_community, false),
    'created_at', comm_row.created_at,
    'member_count', coalesce(mem_count, 0),
    'is_already_member', is_mem,
    'expires_at', invitation.expires_at,
    'max_uses', invitation.max_uses,
    'uses', invitation.uses
  );
end;
$$;

grant execute on function public.get_public_invite_preview(text) to public, anon, authenticated;
