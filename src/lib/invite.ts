import { communityAction } from '../services/communities';
import { db } from './supabase';
import { useDiscord } from '../store/discordStore';

/**
 * CapyChat Oficial / Capy.ofc - Sistema de Identidade e Links de Convite
 * 
 * Marca oficial: Capy.ofc
 * Padrão de URL de convite: https://capy.ofc/invite/<codigo-ou-slug>
 */

export const CAPY_INVITE_DOMAIN = 'capy.ofc';
export const CAPY_INVITE_BASE = `https://${CAPY_INVITE_DOMAIN}/invite/`;
export const CAPY_OFFICIAL_SLUG = 'capychat-oficial';

export interface InvitePreviewData {
  status: 'valid' | 'expired' | 'revoked' | 'max_uses_reached' | 'invalid';
  code: string;
  community_id?: string;
  community_name?: string;
  image_url?: string | null;
  is_official?: boolean;
  is_community?: boolean;
  created_at?: string;
  member_count?: number;
  online_count?: number;
  boost_count?: number;
  is_already_member?: boolean;
  error?: string;
}

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
    trimmed.toLowerCase() === 'lyc-arena' ||
    trimmed === 'd3f2173f-79f0-4362-b60a-ad079f724b54'
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
    .replace(/^https?:\/\/[^/]+\/(?:invite\/)?/i, '')
    .trim();

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

  // Tratamento para URL web: https://capy.ofc/invite/<code> ou legado discord.gg/invite/<code>
  const urlInviteMatch = trimmed.match(/(?:https?:\/\/)?[^/]+(?:\/)+invite\/([a-zA-Z0-9_-]+)/i);
  if (urlInviteMatch && urlInviteMatch[1]) {
    return urlInviteMatch[1];
  }

  // Tratamento para URL direta do Discord: discord.gg/<code>
  const discordMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?discord\.gg\/([a-zA-Z0-9_-]+)/i);
  if (discordMatch && discordMatch[1]) {
    return discordMatch[1];
  }

  // Se contiver caminho com barra
  if (trimmed.includes('/')) {
    const segments = trimmed.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) return last;
  }

  return trimmed;
}

/**
 * Verifica se um texto ou URL é um link ou código de convite reconhecido.
 */
export function isInviteUrlOrCode(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  if (trimmed.startsWith('capychat://invite/')) return true;
  if (/https?:\/\/(?:[a-zA-Z0-9.-]+\/invite\/|discord\.gg\/)/i.test(trimmed)) return true;
  if (trimmed.toLowerCase() === CAPY_OFFICIAL_SLUG || trimmed.toLowerCase() === 'lyc-arena') return true;
  return false;
}

/**
 * Extrai todos os códigos e URLs de convite presentes em um texto de mensagem.
 */
export function extractInviteCodes(text: string): { code: string; rawUrl: string }[] {
  if (!text) return [];
  const results: { code: string; rawUrl: string }[] = [];
  const seen = new Set<string>();

  // Padrão de busca para URLs com https://capy.ofc/invite/, discord.gg/, capychat://invite/
  const regex = /(https?:\/\/(?:[a-zA-Z0-9.-]+\/invite\/|discord\.gg\/)[a-zA-Z0-9_-]+|capychat:\/\/invite\/[a-zA-Z0-9_-]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const rawUrl = match[1];
    const code = parseCapyInviteCode(rawUrl);
    if (code && !seen.has(code)) {
      seen.add(code);
      results.push({ code, rawUrl });
    }
  }

  return results;
}

/**
 * Obtém a prévia completa e segura de um convite sem exigir entrada imediata na comunidade.
 */
export async function getInvitePreview(code: string, currentUserId?: string): Promise<InvitePreviewData> {
  const cleanCode = parseCapyInviteCode(code);
  if (!cleanCode) {
    return {
      status: 'invalid',
      code: '',
      error: 'Código de convite inválido ou ausente.',
    };
  }

  // 1. Verificar servidores locais na store do cliente
  try {
    const storeState = useDiscord.getState();
    const curUserId = currentUserId || storeState.currentUser?.id;

    // Servidor oficial CapyChat
    if (
      cleanCode.toLowerCase() === CAPY_OFFICIAL_SLUG ||
      cleanCode.toLowerCase() === 'lyc-arena' ||
      cleanCode === 'server-lyc' ||
      cleanCode === 'd3f2173f-79f0-4362-b60a-ad079f724b54'
    ) {
      const officialServer = storeState.servers.find(
        (s) => s.id === 'server-lyc' || s.communityId === 'd3f2173f-79f0-4362-b60a-ad079f724b54'
      ) || storeState.servers[0];

      return {
        status: 'valid',
        code: CAPY_OFFICIAL_SLUG,
        community_id: officialServer?.id || 'server-lyc',
        community_name: officialServer?.name || 'CapyChat Oficial',
        image_url: officialServer?.icon || null,
        is_official: true,
        is_community: true,
        created_at: '2025-08-01T00:00:00Z',
        member_count: officialServer?.memberCount || officialServer?.memberIds?.length || 125,
        online_count: officialServer?.onlineCount || 21,
        boost_count: officialServer?.boostCount || 337,
        is_already_member: true,
      };
    }

    // Servidor local já carregado na lista do usuário
    const localMatch = storeState.servers.find(
      (s) =>
        s.id === cleanCode ||
        s.communityId === cleanCode ||
        s.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === cleanCode.toLowerCase()
    );

    if (localMatch) {
      const isMember = curUserId ? (localMatch.memberIds?.includes(curUserId) || true) : true;
      return {
        status: 'valid',
        code: cleanCode,
        community_id: localMatch.id,
        community_name: localMatch.name,
        image_url: localMatch.icon || null,
        is_official: Boolean(localMatch.isVerified),
        is_community: Boolean(localMatch.isCommunity),
        member_count: localMatch.memberCount || localMatch.memberIds?.length || 1,
        online_count: localMatch.onlineCount || 1,
        boost_count: localMatch.boostCount || 0,
        is_already_member: isMember,
      };
    }
  } catch (err) {
    console.warn('[invite] Local preview resolution warning:', err);
  }

  // 2. Consulta segura ao backend Supabase
  try {
    const client = db();

    // Tentativa 1: RPC público get_public_invite_preview
    const { data: rpcData, error: rpcErr } = await client.rpc('get_public_invite_preview', {
      invite_code: cleanCode,
    });

    if (!rpcErr && rpcData) {
      const data = rpcData as any;
      if (data.status === 'valid') {
        return {
          status: 'valid',
          code: cleanCode,
          community_id: data.community_id,
          community_name: data.community_name,
          image_url: data.image_url,
          is_official: data.is_official,
          is_community: data.is_community,
          created_at: data.created_at,
          member_count: data.member_count || 1,
          online_count: Math.max(1, Math.round((data.member_count || 1) * 0.2)),
          boost_count: 0,
          is_already_member: Boolean(data.is_already_member),
        };
      } else {
        return {
          status: data.status || 'invalid',
          code: cleanCode,
          error: data.error || 'Convite inválido ou expirado.',
        };
      }
    }

    // Tentativa 2: Consulta via community_action preview_invite
    try {
      const actionRes = await communityAction<any>('preview_invite', { code: cleanCode });
      if (actionRes && actionRes.status === 'valid') {
        return {
          status: 'valid',
          code: cleanCode,
          community_id: actionRes.community_id,
          community_name: actionRes.community_name,
          image_url: actionRes.image_url,
          is_official: actionRes.is_official,
          is_community: actionRes.is_community,
          created_at: actionRes.created_at,
          member_count: actionRes.member_count || 1,
          online_count: Math.max(1, Math.round((actionRes.member_count || 1) * 0.2)),
          boost_count: 0,
          is_already_member: Boolean(actionRes.is_already_member),
        };
      }
    } catch {
      // Ignora erro e cai na verificação direta
    }

    // Tentativa 3: Consulta direta à tabela community_invites
    const { data: invRow, error: invErr } = await client
      .from('community_invites')
      .select('code, community_id, expires_at, max_uses, uses, revoked_at')
      .eq('code', cleanCode)
      .maybeSingle();

    if (invErr || !invRow) {
      return {
        status: 'invalid',
        code: cleanCode,
        error: 'Convite não encontrado ou link inexistente.',
      };
    }

    if (invRow.revoked_at) {
      return { status: 'revoked', code: cleanCode, error: 'Este convite foi revogado.' };
    }
    if (invRow.expires_at && new Date(invRow.expires_at).getTime() <= Date.now()) {
      return { status: 'expired', code: cleanCode, error: 'Este convite expirou.' };
    }
    if (invRow.max_uses && invRow.uses >= invRow.max_uses) {
      return { status: 'max_uses_reached', code: cleanCode, error: 'Este convite atingiu o número máximo de usos.' };
    }

    // Buscar dados públicos da comunidade
    const { data: commRow } = await client
      .from('communities')
      .select('id, name, image_url, is_official, is_community, created_at')
      .eq('id', invRow.community_id)
      .maybeSingle();

    const storeState = useDiscord.getState();
    const curUserId = currentUserId || storeState.currentUser?.id;
    const isMember = curUserId
      ? storeState.servers.some((s) => s.id === invRow.community_id || s.communityId === invRow.community_id)
      : false;

    return {
      status: 'valid',
      code: cleanCode,
      community_id: invRow.community_id,
      community_name: commRow?.name || 'Comunidade CapyChat',
      image_url: commRow?.image_url || null,
      is_official: Boolean(commRow?.is_official),
      is_community: Boolean(commRow?.is_community),
      created_at: commRow?.created_at,
      member_count: 1,
      online_count: 1,
      boost_count: 0,
      is_already_member: isMember,
    };
  } catch (err: any) {
    console.error('[invite] Failed to fetch preview:', err);
    return {
      status: 'invalid',
      code: cleanCode,
      error: 'Não foi possível carregar as informações do convite.',
    };
  }
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

  // 1. Se for o slug do servidor oficial CapyChat
  if (
    code.toLowerCase() === CAPY_OFFICIAL_SLUG ||
    code.toLowerCase() === 'lyc-arena' ||
    code === 'd3f2173f-79f0-4362-b60a-ad079f724b54'
  ) {
    return { success: true, communityId: 'server-lyc' };
  }

  // 2. Se o usuário já está no servidor localmente
  const storeState = useDiscord.getState();
  const existingLocal = storeState.servers.find(
    (s) =>
      s.id === code ||
      s.communityId === code ||
      s.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === code.toLowerCase()
  );
  if (existingLocal) {
    return { success: true, communityId: existingLocal.id };
  }

  // 3. Chamada transacional e atômica à RPC Supabase
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
    if (message.includes('banido') || message.includes('ban')) {
      return { success: false, error: 'Você não tem permissão para entrar neste servidor.' };
    }
    return { success: false, error: message || 'Não foi possível validar o convite.' };
  }
}
