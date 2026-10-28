import { getAssetUrl, handleAvatarError } from './assets';

export const DEFAULT_AVATAR = '/assets/avatar-padrao-capychat.png';

/**
 * Retorna a URL do avatar do usuário.
 * Se o usuário não tiver avatar personalizado, ou se tiver o placeholder
 * antigo da LYC Arena (mascote-cabeca.png), retorna automaticamente a
 * mascote oficial do CapyChat enviada (avatar-padrao-capychat.png).
 * Avatares personalizados (Supabase Storage, links externos) são preservados intactos.
 */
export function getAvatarUrl(url?: string | null): string {
  if (!url || typeof url !== 'string' || url.trim() === '' || url.includes('mascote-cabeca.png')) {
    return DEFAULT_AVATAR;
  }
  return url;
}

export { handleAvatarError, getAssetUrl };
