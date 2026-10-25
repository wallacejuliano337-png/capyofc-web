import { User } from './discord';

export type BadgeCategory = 'fundador' | 'equipe' | 'moderador' | 'comunidade' | 'eventos' | 'apoiador';

export interface CapyBadge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  categoryLabel: string;
  color: string;
  glowColor: string;
  iconType: 'founder' | 'staff' | 'moderator' | 'community' | 'events' | 'supporter';
  unlockRequirement: string;
}

export const CAPY_BADGES: CapyBadge[] = [
  {
    id: 'capy_founder',
    name: 'Fundador Oficial',
    description: 'Criador pioneiro que deu vida ao ecossistema oficial do CapyChat.',
    category: 'fundador',
    categoryLabel: 'Fundador',
    color: '#f1c40f',
    glowColor: 'rgba(241, 196, 15, 0.35)',
    iconType: 'founder',
    unlockRequirement: 'Concedida exclusivamente ao criador e proprietário da plataforma CapyChat.',
  },
  {
    id: 'capy_staff',
    name: 'Equipe CapyChat',
    description: 'Membro oficial da equipe de desenvolvimento e operação da plataforma.',
    category: 'equipe',
    categoryLabel: 'Equipe',
    color: '#5865f2',
    glowColor: 'rgba(88, 101, 242, 0.35)',
    iconType: 'staff',
    unlockRequirement: 'Atribuída a membros ativos da equipe oficial de engenharia, design e operações.',
  },
  {
    id: 'capy_moderator',
    name: 'Guardião da Comunidade',
    description: 'Moderador ativo responsável pela segurança e harmonia das comunidades.',
    category: 'moderador',
    categoryLabel: 'Moderação',
    color: '#2ecc71',
    glowColor: 'rgba(46, 204, 113, 0.35)',
    iconType: 'moderator',
    unlockRequirement: 'Cargo de Moderador atribuído em servidores verificados ou na rede oficial.',
  },
  {
    id: 'capy_supporter',
    name: 'Apoiador Pioneiro',
    description: 'Usuário que apoiou o CapyChat desde os primeiros passos da plataforma.',
    category: 'apoiador',
    categoryLabel: 'Apoiador',
    color: '#eb459e',
    glowColor: 'rgba(235, 69, 158, 0.35)',
    iconType: 'supporter',
    unlockRequirement: 'Assinantes do Ultra Pass ou pioneiros que apoiaram no período de lançamento inicial.',
  },
  {
    id: 'capy_community',
    name: 'Espírito Capivara',
    description: 'Membro engajado e acolhedor participante das comunidades do CapyChat.',
    category: 'comunidade',
    categoryLabel: 'Comunidade',
    color: '#3498db',
    glowColor: 'rgba(52, 152, 219, 0.35)',
    iconType: 'community',
    unlockRequirement: 'Disponível para todos os membros ativos cadastrados na rede CapyChat.',
  },
  {
    id: 'capy_events',
    name: 'Veterano de Torneios',
    description: 'Participou ou conquistou pódios em eventos e torneios oficiais da arena.',
    category: 'eventos',
    categoryLabel: 'Eventos',
    color: '#e67e22',
    glowColor: 'rgba(230, 126, 34, 0.35)',
    iconType: 'events',
    unlockRequirement: 'Participar ou obter classificação de destaque em eventos e torneios oficiais.',
  },
];

export const BADGE_MAP: Record<string, CapyBadge> = Object.fromEntries(
  CAPY_BADGES.map((b) => [b.id, b])
);

/**
 * Returns the list of badge IDs that the user has genuinely unlocked based on backend profile and role data.
 * A regular member cannot grant themselves privileged badges.
 */
export function getUserUnlockedBadgeIds(user?: Partial<User> & { role?: string } | null): string[] {
  if (!user || !user.id) return [];

  const unlocked: string[] = [];
  const role = (user.role || '').toUpperCase();

  // 1. Fundador
  const isFounder =
    role === 'OWNER' ||
    user.id === 'f8fcd139-cf43-4873-bd7d-a807ecd73567' ||
    user.id === 'user-ares';
  if (isFounder) {
    unlocked.push('capy_founder');
  }

  // 2. Equipe
  const isStaff = isFounder || role === 'ADMIN' || role === 'STAFF';
  if (isStaff) {
    unlocked.push('capy_staff');
  }

  // 3. Moderador
  const isMod = isStaff || role === 'MODERATOR';
  if (isMod) {
    unlocked.push('capy_moderator');
  }

  // 4. Apoiador Pioneiro
  const isSupporter =
    isStaff ||
    user.id === '53f5007d-a0ba-4cac-92ee-cf57992168f9' ||
    (Array.isArray(user.badges) &&
      (user.badges.includes('early-supporter') ||
        user.badges.includes('supporter') ||
        user.badges.includes('nitro-booster')));
  if (isSupporter) {
    unlocked.push('capy_supporter');
  }

  // 5. Comunidade (Membro Ativo)
  unlocked.push('capy_community');

  // 6. Eventos
  if (isFounder || (Array.isArray(user.badges) && user.badges.includes('events'))) {
    unlocked.push('capy_events');
  }

  return unlocked;
}

/**
 * Resolves which badges should actually be publicly visible.
 * Ensures strict security: even if userPreferences contains a badge ID,
 * it will only be returned if the user actually unlocked it.
 */
export function getDisplayedBadgeIds(
  unlockedBadgeIds: string[],
  userPreferences?: string[] | null
): string[] {
  if (!userPreferences) {
    return unlockedBadgeIds;
  }
  return unlockedBadgeIds.filter((id) => userPreferences.includes(id));
}
