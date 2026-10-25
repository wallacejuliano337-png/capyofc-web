import { communityAction } from '../services/communities';

/**
 * CapyChat Oficial / Capy.ofc - Sistema de Identidade e Links de Convite
 * 
 * Marca oficial: Capy.ofc
 * Padrão de URL de convite: https://capy.ofc/invite/<codigo-ou-slug>
 */

export const CAPY_INVITE_DOMAIN = 'capy.ofc';
export const CAPY_INVITE_BASE = `https://${CAPY_INVITE_DOMAIN}/invite/`;
export const CAPY_OFFICIAL_SLUG = 'capychat-oficial';

/**
 * Normaliza um identificador (ID, nome ou código) em uma URL de convite da marca Capy.ofc.
 */
export function getCapyInviteUrl(identifier?: string | null): string {
  if (!identifier) {
    return `${CAPY_INVITE_BASE}${CAPY_OFFICIAL_SLUG}`;
  }

  const trimmed = identifier.trim();

  // Servidor oficial CapyChat
  if (
    trimmed === 'server-lyc' ||
    trimmed.toLowerCase() === 'capychat' ||
    trimmed.toLowerCase() === 'capychat-oficial' ||
    trimmed.toLowerCase() === 'lyc-arena'
  ) {
    return `${CAPY_INVITE_BASE}${CAPY_OFFICIAL_SLUG}`;
  }

  // Se já for uma URL completa
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const code = parseCapyInviteCode(trimmed);
    return `${CAPY_INVITE_BASE}${code}`;
  }

  // Se for código ou slug
  const cleanSlug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `${CAPY_INVITE_BASE}${cleanSlug || CAPY_OFFICIAL_SLUG}`;
}

/**
 * Extrai o código ou slug limpo a partir de texto digitado, URL ou protocolo personalizado.
 */
export function parseCapyInviteCode(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // Tratamento para deep link customizado: capychat://invite/<code>
  const customProtocolMatch = trimmed.match(/^capychat:\/\/(?:invite\/)?([^/?#]+)/i);
  if (customProtocolMatch && customProtocolMatch[1]) {
    return customProtocolMatch[1];
  }

  // Tratamento para URL web: https://capy.ofc/invite/<code> ou legado discord.gg/<code>
  const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9.-]+\/)*(?:invite\/)?([a-zA-Z0-9_-]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  return trimmed;
}

/**
 * Valida e entra em uma comunidade utilizando o backend Supabase seguro.
 * Não concede privilégios de administrador (entra com papel de membro padrão).
 */
export async function joinByInviteCode(
  rawInput: string
): Promise<{ success: boolean; communityId?: string; error?: string }> {
  const code = parseCapyInviteCode(rawInput);
  if (!code) {
    return { success: false, error: 'Por favor, informe um código ou link de convite válido.' };
  }

  // Se for o slug do servidor oficial CapyChat
  if (code.toLowerCase() === CAPY_OFFICIAL_SLUG || code.toLowerCase() === 'lyc-arena') {
    return { success: true, communityId: 'server-lyc' };
  }

  try {
    const communityId = await communityAction<string>('join', { code });
    return { success: true, communityId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('inválido') || message.includes('expirado')) {
      return { success: false, error: 'Este convite é inválido ou já expirou.' };
    }
    if (message.includes('esgotado')) {
      return { success: false, error: 'Este convite atingiu o número máximo de usos.' };
    }
    return { success: false, error: message || 'Não foi possível validar o convite.' };
  }
}
