export const OFFICIAL_COMMUNITY_ID = 'd3f2173f-79f0-4362-b60a-ad079f724b54';
export const OFFICIAL_SERVER_ID = 'server-lyc';

/**
 * Verifica de forma estrita e segura se uma comunidade/servidor é a comunidade oficial CapyChat,
 * utilizando exclusivamente seus identificadores estáveis (nunca nomes ou rótulos).
 */
export function isOfficialCommunity(serverOrId?: { id?: string; communityId?: string } | string | null): boolean {
  if (!serverOrId) return false;
  if (typeof serverOrId === 'string') {
    return serverOrId === OFFICIAL_SERVER_ID || serverOrId === OFFICIAL_COMMUNITY_ID;
  }
  return (
    serverOrId.id === OFFICIAL_SERVER_ID ||
    serverOrId.id === OFFICIAL_COMMUNITY_ID ||
    serverOrId.communityId === OFFICIAL_COMMUNITY_ID
  );
}

export type CommunityBoostLevel = 0 | 1 | 2 | 3;

export interface CommunityMedalConfig {
  level: CommunityBoostLevel;
  name: 'Bronze' | 'Prata' | 'Ouro' | 'Esmeralda';
  medalUrl: string;
  label: string;
  minBoosts: number;
  color: string;
}

export const COMMUNITY_LEVEL_MEDALS: Record<CommunityBoostLevel, CommunityMedalConfig> = {
  0: {
    level: 0,
    name: 'Bronze',
    medalUrl: '/assets/impulso/parte3/bronze.png',
    label: 'Sem Nível',
    minBoosts: 0,
    color: '#cd7f32',
  },
  1: {
    level: 1,
    name: 'Prata',
    medalUrl: '/assets/impulso/parte3/prata.png',
    label: 'Nível 1',
    minBoosts: 2,
    color: '#c0c0c0',
  },
  2: {
    level: 2,
    name: 'Ouro',
    medalUrl: '/assets/impulso/parte3/ouro.png',
    label: 'Nível 2',
    minBoosts: 7,
    color: '#ffd700',
  },
  3: {
    level: 3,
    name: 'Esmeralda',
    medalUrl: '/assets/impulso/parte3/esmeralda.png',
    label: 'Nível 3 • Máximo',
    minBoosts: 14,
    color: '#57f287',
  },
};

/**
 * Retorna o nível oficial da comunidade (0, 1, 2 ou 3)
 * Respeitando a fonte de dados do servidor (boostLevel) e a regra de progressão oficial.
 */
export function getCommunityBoostLevel(
  server?: { boostLevel?: number; boostCount?: number } | null
): CommunityBoostLevel {
  if (!server) return 0;
  if (typeof server.boostLevel === 'number' && server.boostLevel >= 0 && server.boostLevel <= 3) {
    return server.boostLevel as CommunityBoostLevel;
  }
  const count = server.boostCount ?? 0;
  if (count >= 14) return 3;
  if (count >= 7) return 2;
  if (count >= 2) return 1;
  return 0;
}

/**
 * Retorna as informações e caminho da medalha oficial da comunidade para o nível ou servidor fornecido.
 */
export function getCommunityLevelMedal(
  serverOrLevel?: { boostLevel?: number; boostCount?: number } | CommunityBoostLevel | null
): CommunityMedalConfig {
  const level =
    typeof serverOrLevel === 'number'
      ? (Math.max(0, Math.min(3, serverOrLevel)) as CommunityBoostLevel)
      : getCommunityBoostLevel(serverOrLevel);
  return COMMUNITY_LEVEL_MEDALS[level];
}
