import { create } from 'zustand';
import { useThemeStore, ThemeMode } from './themeStore';
import { supabase, db } from '../lib/supabase';
import { socialAction } from '../services/social';
import { communityAction, isPresenceOnline } from '../services/communities';
import { isOfficialCommunity } from '../services/communityLevel';
import { ServerTemplateData, buildServerFromTemplate } from '../services/server-templates';
import { DEFAULT_AVATAR, getAvatarUrl } from '../utils/avatar';
import { getAssetUrl } from '../utils/assets';
import { getUserUnlockedBadgeIds } from '../types/badges';
import {
  User,
  SavedAccount,
  Server,
  ServerFolder,
  Message,
  VoiceConnectionState,
  VoiceParticipant,
  ShopItem,
  Mission,
  Channel,
  ChannelCategory,
  ChannelType,
  Role,
  RolePermissions,
  PERMISSION_KEY_MAP,
  DEFAULT_MEMBER_PERMISSIONS,
  FriendRequest,
  AuditLogEntry,
} from '../types/discord';
import { playNotificationSound } from '../services/notification-sounds';
import { voiceService } from '../services/voiceService';
import { presenceService } from '../services/presenceService';

export const defaultFriendRequests: FriendRequest[] = [
  {
    id: 'req-1',
    user: {
      id: 'user-luna',
      name: 'Luna_Star',
      displayName: 'Luna ✨',
      tag: '4455',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
      status: 'online',
    },
    type: 'incoming',
    timestamp: 'Ontem às 18:42',
  },
  {
    id: 'req-2',
    user: {
      id: 'user-shadow',
      name: 'ShadowGhost',
      displayName: 'ShadowGhost',
      tag: '9999',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
      status: 'offline',
    },
    type: 'outgoing',
    timestamp: 'Há 3 dias',
  },
];

export const defaultRoles: Role[] = [
  {
    id: 'role-admin',
    name: 'Admin Fundador',
    color: '#f1c40f',
    hoist: true,
    position: 1,
    memberCount: 1,
    permissions: {
      viewChannels: true,
      manageChannels: true,
      manageRoles: true,
      kickMembers: true,
      banMembers: true,
      connectVoice: true,
      streamScreen: true,
      administrator: true,
    },
  },
  {
    id: 'role-mod',
    name: 'Moderador Geral',
    color: '#5865f2',
    hoist: true,
    position: 2,
    memberCount: 1,
    permissions: {
      viewChannels: true,
      manageChannels: true,
      manageRoles: false,
      kickMembers: true,
      banMembers: true,
      connectVoice: true,
      streamScreen: true,
      administrator: false,
    },
  },
  {
    id: 'role-competitor',
    name: 'Competidor Pro',
    color: '#2ecc71',
    hoist: true,
    position: 3,
    memberCount: 2,
    permissions: {
      viewChannels: true,
      manageChannels: false,
      manageRoles: false,
      kickMembers: false,
      banMembers: false,
      connectVoice: true,
      streamScreen: true,
      administrator: false,
    },
  },
  {
    id: 'role-vip',
    name: 'Streamer / VIP',
    color: '#9b59b6',
    hoist: true,
    position: 4,
    memberCount: 1,
    permissions: {
      viewChannels: true,
      manageChannels: false,
      manageRoles: false,
      kickMembers: false,
      banMembers: false,
      connectVoice: true,
      streamScreen: true,
      administrator: false,
    },
  },
  {
    id: 'role-everyone',
    name: '@everyone',
    color: '#99aab5',
    hoist: false,
    position: 5,
    memberCount: 125,
    permissions: {
      viewChannels: true,
      manageChannels: false,
      manageRoles: false,
      kickMembers: false,
      banMembers: false,
      connectVoice: true,
      streamScreen: true,
      administrator: false,
    },
  },
];

export const defaultUserRoleMap: Record<string, string[]> = {
  'user-ares': ['role-admin'],
  'user-valkyrie': ['role-mod'],
  'user-samurai': ['role-competitor'],
  'user-me': ['role-competitor'],
  'user-neon': ['role-vip'],
  'user-bot': ['role-mod'],
  'user-luna': ['role-everyone'],
  'user-shadow': ['role-everyone'],
};

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
export const getStorage = (): Storage | null => {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
};

export const defaultEveryoneRole: Role = {
  id: 'role-everyone',
  name: '@everyone',
  color: '#99aab5',
  hoist: false,
  position: 1,
  memberCount: 1,
  permissions: {
    viewChannels: true,
    manageChannels: false,
    manageRoles: false,
    kickMembers: false,
    banMembers: false,
    connectVoice: true,
    streamScreen: true,
    administrator: false,
  },
};

export const loadInitialServerRolesMap = (): Record<string, Role[]> => {
  const defaultMap: Record<string, Role[]> = {
    'server-lyc': defaultRoles,
  };
  if (!isBrowser) return defaultMap;
  try {
    const saved = window.localStorage.getItem('lyc_server_roles_map');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return { ...defaultMap, ...parsed };
      }
    }
  } catch {}
  return defaultMap;
};

export const saveServerRolesMapToStorage = (map: Record<string, Role[]>) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem('lyc_server_roles_map', JSON.stringify(map));
  } catch {}
};

export const loadInitialAuditLogsByServer = (): Record<string, AuditLogEntry[]> => {
  const defaultLogs: Record<string, AuditLogEntry[]> = {
    'server-lyc': [
      {
        id: '1',
        user: 'Ares_Admin',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        actionType: 'create_role',
        action: 'criou o cargo',
        target: 'Competidor Pro',
        time: 'Hoje às 14:48:21 (Há 12 min)',
        color: '#2ecc71',
        details: 'Cor: #2ecc71 • Permissões: Conectar Voz, Transmitir Tela',
      },
      {
        id: '2',
        user: 'Ares_Admin',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        actionType: 'create_channel',
        action: 'criou o canal',
        target: '#geral-2',
        time: 'Hoje às 14:32:05 (Há 28 min)',
        color: '#5865f2',
        details: 'Tipo: Canal de Texto • Categoria: CANAIS DE TEXTO',
      },
    ],
  };
  if (!isBrowser) return defaultLogs;
  try {
    const saved = window.localStorage.getItem('lyc_audit_logs_by_server');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return { ...defaultLogs, ...parsed };
      }
    }
  } catch {}
  return defaultLogs;
};

export const saveAuditLogsByServerToStorage = (map: Record<string, AuditLogEntry[]>) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem('lyc_audit_logs_by_server', JSON.stringify(map));
  } catch {}
};

export const loadInitialRoles = (): Role[] => {
  if (!isBrowser) return defaultRoles;
  try {
    const saved = window.localStorage.getItem('lyc_server_roles');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return defaultRoles;
};

export const saveRolesToStorage = (roles: Role[]) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem('lyc_server_roles', JSON.stringify(roles));
  } catch {}
};

export const loadInitialUserRoleMap = (): Record<string, string[]> => {
  if (!isBrowser) return defaultUserRoleMap;
  try {
    const saved = window.localStorage.getItem('lyc_user_roles_map');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return { ...defaultUserRoleMap, ...parsed };
      }
    }
  } catch {}
  return defaultUserRoleMap;
};

export const saveUserRoleMapToStorage = (map: Record<string, string[]>) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem('lyc_user_roles_map', JSON.stringify(map));
  } catch {}
};

const _savedName =
  (isBrowser && window.localStorage.getItem('lycDisplayName')) || 'LycUser';
const _savedAvatar = getAvatarUrl(
  (isBrowser && window.localStorage.getItem('lycUserAvatar')) || DEFAULT_AVATAR
);
const _savedBannerColor =
  (isBrowser && window.localStorage.getItem('lycUserBannerColor')) || '#5865f2';
const _savedBannerImage =
  (isBrowser && window.localStorage.getItem('lycUserBannerImage')) || undefined;
const _savedAboutMe =
  (isBrowser && window.localStorage.getItem('lycAboutMe')) ||
  'Desenvolvedor & Membro Fundador da LYC Arena. Explorando a nova interface WebRTC.';
const _savedNameFont = (isBrowser && window.localStorage.getItem('lyc_nameFont')) || undefined;
const _savedNameEffect = ((isBrowser && window.localStorage.getItem('lyc_nameEffect')) as any) || undefined;
const _savedNameColor = (isBrowser && window.localStorage.getItem('lyc_nameColor')) || undefined;
const _savedThemePrimary = (isBrowser && window.localStorage.getItem('lyc_themePrimaryColor')) || undefined;
const _savedThemeSecondary = (isBrowser && window.localStorage.getItem('lyc_themeSecondaryColor')) || undefined;

export const currentUser: User = {
  id: 'user-me',
  name: _savedName,
  displayName: _savedName,
  tag: '0001',
  avatar: _savedAvatar,
  bannerColor: _savedBannerColor,
  bannerImage: _savedBannerImage || undefined,
  status: 'online',
  customStatus: 'Jogando LYC Arena Oficial',
  aboutMe: _savedAboutMe,
  badges: ['nitro-booster', 'early-supporter'],
  joinedDate: '15 de Janeiro de 2024',
  nameFont: _savedNameFont,
  nameEffect: _savedNameEffect,
  nameColor: _savedNameColor,
  themePrimaryColor: _savedThemePrimary,
  themeSecondaryColor: _savedThemeSecondary,
  activity: {
    type: 'PLAYING',
    name: 'LYC Arena - Ranked',
    details: 'Competitivo 5v5',
    state: 'Em partida (42 min)',
  },
};

export const mockUsers: User[] = [
  currentUser,
  {
    id: 'user-ares',
    name: 'Ares_Admin',
    displayName: 'Ares 👑',
    tag: '1337',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    bannerColor: '#f1c40f',
    status: 'online',
    aboutMe: 'Criador e Administrador da LYC Arena. Dúvidas sobre o sistema? Só chamar.',
    badges: ['staff', 'nitro', 'active-developer'],
    joinedDate: '01 de Dezembro de 2023',
    activity: {
      type: 'PLAYING',
      name: 'Visual Studio Code',
      details: 'Desenvolvendo LYC Arena Desktop',
      state: 'Workspace: lyc-arena',
    },
  },
  {
    id: 'user-valkyrie',
    name: 'Valkyrie',
    displayName: 'Valkyrie ⚡',
    tag: '4040',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    bannerColor: '#6d28d9',
    status: 'online',
    aboutMe: 'Líder dos Moderadores da Comunidade. Jogando e transmitindo diariamente.',
    badges: ['nitro-booster'],
    joinedDate: '12 de Fevereiro de 2024',
    activity: {
      type: 'STREAMING',
      name: 'LYC Championship 2026',
      details: 'Transmissão Ao Vivo (1080p 60fps)',
    },
  },
  {
    id: 'user-samurai',
    name: 'CyberSamurai',
    displayName: 'CyberSamurai ⚔️',
    tag: '7721',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
    bannerColor: '#06b6d4',
    status: 'idle',
    aboutMe: 'Synthwave & Cyberpunk enthusiast. WebRTC stream tester.',
    badges: ['nitro', 'bug-hunter'],
    joinedDate: '20 de Março de 2024',
    activity: {
      type: 'LISTENING',
      name: 'Spotify',
      details: 'Lorn - Acid Rain',
      state: 'Álbum: The Maze to Nowhere',
    },
  },
  {
    id: 'user-neon',
    name: 'NeonRider',
    displayName: 'Neon Rider',
    tag: '2024',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    bannerColor: '#f43f5e',
    status: 'dnd',
    customStatus: 'Não perturbe | Gravando gameplay',
    aboutMe: 'Criador de conteúdo da LYC Arena.',
    badges: [],
    joinedDate: '05 de Abril de 2024',
  },
  {
    id: 'user-luna',
    name: 'Luna_Star',
    displayName: 'Luna ✨',
    tag: '8888',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&auto=format&fit=crop&q=80',
    bannerColor: '#ec4899',
    status: 'online',
    badges: ['nitro-booster'],
    joinedDate: '18 de Junho de 2024',
    activity: {
      type: 'PLAYING',
      name: 'Valorant',
      details: 'Partida Competitiva',
      state: 'Placar: 11 - 9',
    },
  },
  {
    id: 'user-bot',
    name: 'LYC Bot',
    displayName: 'LYC Arena BOT',
    tag: '0000',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
    bannerColor: '#5865f2',
    status: 'online',
    isBot: true,
    aboutMe: 'Bot oficial de automação, torneios e gerenciamento da LYC Arena.',
  },
  {
    id: 'user-shadow',
    name: 'ShadowGhost',
    tag: '9999',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
    status: 'offline',
  },
  {
    id: 'user-pixel',
    name: 'PixelKnight',
    tag: '1010',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    status: 'offline',
  },
];

export const mockServers: Server[] = [
  {
    id: 'server-lyc',
    name: 'CapyChat Oficial',
    initials: 'CAPY',
    icon: getAssetUrl('assets/logo-circular.png'),
    ownerId: 'f8fcd139-cf43-4873-bd7d-a807ecd73567',
    unreadBadge: 3,
    mentionCount: 2,
    bannerColor: 'blurple-purple',
    bannerImage: null,
    description: 'Comunidade Oficial do CapyChat. Notícias, torneios e transmissões.',
    memberCount: 7,
    onlineCount: 0,
    createdAtDaysAgo: 60,
    isVerified: true,
    verifiedBadgeStyle: 'blue',
    showBoostProgressBar: true,
    boostCount: 24,
    boostLevel: 3,
    categories: [
      {
        id: 'cat-info',
        name: 'INFORMAÇÕES & REGRAS',
        channels: [
          { id: 'ch-boas-vindas', name: 'boas-vindas', type: 'text', topic: 'Boas-vindas ao servidor oficial do CapyChat!' },
          { id: 'ch-regras', name: 'regras-e-diretrizes', type: 'text', topic: 'Diretrizes de respeito e convivência na comunidade.' },
          { id: 'ch-anuncios', name: 'anúncios-oficiais', type: 'announcement', topic: 'Fique atento a novidades e patches do CapyChat.', unread: true },
          { id: 'ch-novidades', name: '✨・novidades', type: 'announcement', topic: 'Fique atento a novidades, atualizações e prévias do CapyChat.', unread: true },
          { id: 'ch-forum-dev', name: 'forum-comunidade', type: 'forum', topic: 'Tópicos de discussão aberta da comunidade.' },
        ],
      },
      {
        id: 'cat-text',
        name: 'CANAIS DE TEXTO',
        channels: [
          { id: 'ch-geral', name: '💬・geral', type: 'text', topic: 'Bate-papo principal da comunidade e boas-vindas a novos membros.' },
          { id: 'ch-clips', name: 'jogadas-e-clips', type: 'text', topic: 'Vídeos de gameplay e melhores lances.' },
          { id: 'ch-dev-tech', name: 'desenvolvimento-e-webrtc', type: 'text', topic: 'Discussões de código, Next.js, Electron e streaming.', unread: true, mentionCount: 2 },
          { id: 'ch-bot-comandos', name: 'comandos-bot', type: 'text', topic: 'Use comandos com prefixo ! ou / aqui.' },
        ],
      },
      {
        id: 'cat-sugestoes',
        name: 'SUGESTÕES & COMUNIDADE',
        channels: [
          { id: 'ch-ideias', name: '💡・ideias', type: 'text', topic: 'Compartilhe suas ideias e sugestões para melhorar o CapyChat.' },
          { id: 'ch-molduras', name: '🖼️・molduras', type: 'text', topic: 'Sugestões, conceitos e criações de molduras para avatares.' },
          { id: 'ch-banners', name: '🎨・banners', type: 'text', topic: 'Sugestões e artes de faixas e banners de comunidade.' },
          { id: 'ch-mascotes', name: '🤖・mascotes', type: 'text', topic: 'Sugestões de temas, acessórios e novos estilos para os mascotes.' },
        ],
      },
      {
        id: 'cat-voice',
        name: 'CANAIS DE VOZ & VÍDEO',
        channels: [
          { id: 'ch-voice-1', name: 'Lobby de Voz #1', type: 'voice' },
          { id: 'ch-voice-arena', name: 'Arena Competitiva [HQ]', type: 'voice' },
          { id: 'ch-voice-stream', name: 'Transmissão Ao Vivo (1080p)', type: 'voice' },
        ],
      },
    ],
  },
  {
    id: 'server-testes',
    name: 'Servidor de Testes',
    initials: 'TEST',
    icon: '',
    unreadBadge: 0,
    mentionCount: 0,
    bannerColor: 'matte-black',
    bannerImage: null,
    description: 'Servidor de testes sem impulsos. Ideal para testar bloqueios de recursos, slots limitados de figurinhas e avisos de upgrade.',
    memberCount: 3,
    createdAtDaysAgo: 1,
    isVerified: false,
    verifiedBadgeStyle: 'blue',
    showBoostProgressBar: false,
    boostCount: 0,
    boostLevel: 0,
    categories: [
      {
        id: 'cat-test-text',
        name: 'CANAIS DE TEXTO',
        channels: [
          { id: 'ch-test-geral', name: 'chat-geral', type: 'text', topic: 'Canal de testes do servidor sem boost.' },
          { id: 'ch-test-comandos', name: 'comandos', type: 'text', topic: 'Área de testes de permissões e comandos.' },
        ],
      },
      {
        id: 'cat-test-voice',
        name: 'CANAIS DE VOZ',
        channels: [
          { id: 'ch-test-voice', name: 'Geral (Voz)', type: 'voice' },
        ],
      },
    ],
  },
];

export const mockFolders: ServerFolder[] = [];

export const initialMessages: Record<string, Message[]> = {
  'ch-geral': [
    {
      id: 'msg-1',
      channelId: 'ch-geral',
      author: mockUsers[1], // Ares_Admin
      content: 'Boas-vindas a todos à nova interface completa do CapyChat Oficial!',
      timestamp: 'Hoje às 14:15',
      embed: {
        title: '🚀 CapyChat Oficial 2.0',
        description: 'Toda a experiência moderna de chat e voz agora está integrada ao CapyChat Oficial: tema escuro, chat em tempo real, canais de texto e voz com WebRTC em alta definição.',
        color: '#5865f2',
        author: {
          name: 'Ares_Admin (Desenvolvedor Chefe)',
          iconUrl: mockUsers[1].avatar,
        },
        fields: [
          { name: '✨ Cores Fiéis', value: '#1e1f22 • #2b2d31 • #313338 • #5865f2', inline: true },
          { name: '🎙️ Transmissão de Tela', value: '1080p 60fps via WebRTC', inline: true },
          { name: '🛍️ Vitrine & Loja', value: 'Decorações de Avatar & Ultra Pass', inline: true },
        ],
        footer: {
          text: 'CapyChat Oficial • Sistema de Comunicação • Hoje às 14:15',
          iconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=40&auto=format&fit=crop&q=80',
        },
      },
      reactions: [
        { emoji: '🔥', count: 12, me: true },
        { emoji: '🚀', count: 9, me: false },
        { emoji: '💜', count: 7, me: true },
      ],
    },
    {
      id: 'msg-2',
      channelId: 'ch-geral',
      author: mockUsers[2], // Valkyrie
      content: 'A sidebar de canais, categorias retráteis e o canal de voz com transmissão ao vivo estão idênticos. Basta clicar em "Transmissão Ao Vivo (1080p)" para testar a chamada.',
      timestamp: 'Hoje às 14:20',
      reactions: [{ emoji: '👀', count: 5, me: true }],
    },
    {
      id: 'msg-3',
      channelId: 'ch-geral',
      author: mockUsers[3], // CyberSamurai
      content: 'Estou transmitindo minha tela em 1080p 60fps no canal de voz. A barra flutuante de controles permite mutar o microfone, ligar a câmera ou parar a transmissão!',
      timestamp: 'Hoje às 14:24',
      reactions: [{ emoji: '⚡', count: 8, me: false }],
    },
  ],
  'ch-dev-tech': [
    {
      id: 'msg-dev-1',
      channelId: 'ch-dev-tech',
      author: mockUsers[1],
      content: 'A stack inteira foi migrada com TypeScript e Tailwind CSS v4. O player de vídeo utiliza referências diretas preparadas para injeção de streams WebRTC.',
      timestamp: 'Hoje às 11:30',
    },
  ],
  'ch-test-geral': [
    {
      id: 'msg-test-1',
      channelId: 'ch-test-geral',
      author: mockUsers[1],
      content: 'Bem-vindo ao Servidor de Testes! Este servidor possui 0 impulsos ativos para testar os limites de upload, slots básicos de figurinhas e avisos de upgrade.',
      timestamp: 'Hoje às 12:00',
    },
  ],
  'ch-novidades': [
    {
      id: 'msg-nov-1',
      channelId: 'ch-novidades',
      author: mockUsers[1],
      content: '✨ Sejam bem-vindos ao canal oficial de novidades e atualizações do CapyChat!',
      timestamp: 'Hoje às 12:00',
    },
  ],
  'ch-ideias': [
    {
      id: 'msg-ideias-1',
      channelId: 'ch-ideias',
      author: mockUsers[1],
      content: '💡 Espaço aberto para compartilhar ideias e sugestões para a evolução da comunidade e da plataforma.',
      timestamp: 'Hoje às 12:05',
    },
  ],
};

export const mockShopItems: ShopItem[] = [
  {
    id: 'shop-1',
    title: 'Cyberpunk Neon Visor',
    collection: 'Cyberpunk Futurista',
    type: 'avatar-decoration',
    previewUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80',
    price: 'R$ 24,90',
    isNew: true,
  },
  {
    id: 'shop-2',
    title: 'Chamas Roxas de Energia',
    collection: 'Fogo Místico',
    type: 'profile-effect',
    previewUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=300&auto=format&fit=crop&q=80',
    price: 'R$ 39,90',
    isExclusive: true,
  },
  {
    id: 'shop-3',
    title: 'Aura Holográfica LYC',
    collection: 'LYC Especial',
    type: 'avatar-decoration',
    previewUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300&auto=format&fit=crop&q=80',
    price: 'R$ 29,90',
    isNew: true,
  },
  {
    id: 'shop-4',
    title: 'Galáxia Infinita',
    collection: 'Espaço Sideral',
    type: 'banner',
    previewUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80',
    price: 'R$ 19,90',
  },
  {
    id: 'shop-5',
    title: 'Asas de Dragão Noturno',
    collection: 'Lendas Antigas',
    type: 'avatar-decoration',
    previewUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80',
    price: 'R$ 34,90',
  },
  {
    id: 'shop-6',
    title: 'Matrix Digital Glitch',
    collection: 'Hacker Elite',
    type: 'profile-effect',
    previewUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300&auto=format&fit=crop&q=80',
    price: 'R$ 39,90',
  },
];

export const mockMissions: Mission[] = [
  {
    id: 'mission-1',
    title: 'Transmitir LYC Arena por 15 minutos',
    description: 'Entre em um canal de voz com amigos e compartilhe sua tela com gameplay da LYC Arena.',
    game: 'LYC Arena Ranked',
    reward: 'Badge Exclusiva de Transmissor + 1 Mês de Nitro Básico',
    rewardIcon: '🎯',
    progress: 10,
    maxProgress: 15,
    expiresIn: 'Termina em 3 dias',
  },
  {
    id: 'mission-2',
    title: 'Vencer 3 partidas competitivas na Arena',
    description: 'Participe dos torneios semanais da comunidade LYC e conquiste vitórias.',
    game: 'Torneios LYC Series',
    reward: 'Borda Dourada de Campeão + Moldura de Avatar',
    rewardIcon: '🏆',
    progress: 2,
    maxProgress: 3,
    expiresIn: 'Termina em 5 dias',
  },
];

export type SettingsTab =
  | 'my-account'
  | 'profiles'
  | 'insignias'
  | 'privacy-safety'
  | 'authorized-apps'
  | 'connections'
  | 'nitro'
  | 'ultra-pass'
  | 'server-boost'
  | 'subscriptions'
  | 'appearance'
  | 'accessibility'
  | 'voice-video'
  | 'notifications'
  | 'keybinds'
  | 'language'
  | 'about';

export interface DiscordStore {
  // Navigation
  activeServerId: string;
  activeChannelId: string;
  activeHomeTab: 'friends' | 'nitro' | 'ultra-pass' | 'shop' | 'missions';
  friendsFilter: 'online' | 'all' | 'pending' | 'blocked' | 'add';
  activeView: 'chat' | 'voice-stage';
  
  // Right sidebar & popouts
  isMemberListOpen: boolean;
  selectedMemberForPopout: User | null;
  popoutPosition: { top: number; right: number } | null;
  
  // Modals
  isSettingsModalOpen: boolean;
  activeSettingsTab: SettingsTab;
  isUserProfileModalOpen: boolean;
  userProfileModalTarget: User | null;

  // Theme
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  
  // Audio / Video
  isMicMuted: boolean;
  isDeafened: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  
  // Server folders collapse
  folderStates: Record<string, boolean>;
  collapsedCategories: Record<string, boolean>;

  // Voice State
  voiceState: VoiceConnectionState;
  channelVoiceParticipants: Record<string, VoiceParticipant[]>;
  setChannelVoiceParticipants: (participants: Record<string, VoiceParticipant[]>) => void;
  focusedParticipantId: string | null;
  setFocusedParticipantId: (id: string | null) => void;
  
  // Messages
  messages: Record<string, Message[]>;

  // Servers, Categories & Channels state
  servers: Server[];
  isServerSettingsOpen: boolean;
  serverSettingsTab: string;
  isServerBoostModalOpen: boolean;
  openServerBoostModal: () => void;
  closeServerBoostModal: () => void;
  userBoostsAvailable: number;
  setUserBoostsAvailable: (count: number) => void;
  useBoostOnServer: (serverId: string) => boolean;
  isCreateChannelOpen: boolean;
  targetCategoryIdForNewChannel: string | null;
  isCreateCategoryOpen: boolean;

  // Roles & Permissions state
  roles: Role[];
  serverRolesMap: Record<string, Role[]>;
  getServerRoles: (serverId: string) => Role[];
  auditLogsByServer: Record<string, AuditLogEntry[]>;
  getAuditLogs: (serverId: string) => AuditLogEntry[];
  addAuditLogEntry: (serverId: string, entry: Omit<AuditLogEntry, 'id' | 'time'> & { time?: string }) => void;
  userRoleMap: Record<string, string[]>;
  addRole: (role: Role) => void;
  updateRole: (roleId: string, updates: Partial<Role>) => void;
  deleteRole: (roleId: string) => void;
  reorderRoles: (sourceRoleId: string, targetIndex: number) => void;
  moveRoleByIndex: (fromIndex: number, toIndex: number) => void;
  setRoles: (roles: Role[]) => void;
  getUserRoleColor: (userId: string) => string;
  getUserRole: (userId: string) => Role | undefined;
  setUserRoles: (userId: string, roleIds: string[], serverId?: string) => Promise<{ success: boolean; error?: string }> | void;

  // Current User & Auth
  currentUser: User;
  isAuthenticated: boolean;
  isLoggingOut: boolean;
  communityMembers: User[];
  serverMembersMap: Record<string, string[]>;
  getServerMembers: (serverId: string) => User[];
  addServerMember: (serverId: string, userId: string) => void;
  removeServerMember: (serverId: string, userId: string) => void;
  login: (userUpdates?: Partial<User>) => void;
  logout: (options?: { skipSupabaseSignOut?: boolean }) => Promise<void>;
  updateCurrentUser: (updates: Partial<User>) => void;
  syncProfileFromSupabase: (userId?: string) => Promise<void>;
  fetchCommunityMembers: (communityId?: string) => Promise<void>;
  startPresenceTracking: (communityId?: string) => void;
  stopPresenceTracking: () => void;
  realtimeOnlineIds: Set<string>;
  setRealtimeOnlineIds: (ids: Set<string>) => void;
  updatePresenceLease: (userId: string, expiresAt: string, status?: string) => void;
  leaveServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;
  updateDisplayedBadges: (badgeIds: string[]) => Promise<void>;
  savedAccounts: SavedAccount[];
  addSavedAccount: (account: SavedAccount) => void;
  removeSavedAccount: (accountId: string) => void;
  switchAccount: (targetAccountId: string) => Promise<{ success: boolean; requiresLogin?: boolean; error?: string }>;

  // Actions
  setActiveServer: (id: string) => void;
  setActiveChannel: (id: string) => void;
  setActiveHomeTab: (tab: 'friends' | 'nitro' | 'ultra-pass' | 'shop' | 'missions') => void;
  setFriendsFilter: (filter: 'online' | 'all' | 'pending' | 'blocked' | 'add') => void;
  setActiveView: (view: 'chat' | 'voice-stage') => void;
  toggleMemberList: () => void;
  openMemberPopout: (user: User, pos: { top: number; right: number }) => void;
  closeMemberPopout: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  openUserProfileModal: (user?: User) => void;
  closeUserProfileModal: () => void;
  setActiveSettingsTab: (tab: SettingsTab) => void;
  openServerSettings: (tab?: string) => void;
  closeServerSettings: () => void;
  setServerSettingsTab: (tab: string) => void;
  updateServer: (serverId: string, partial: Partial<Server>) => void;
  openCreateChannel: (categoryId?: string) => void;
  closeCreateChannel: () => void;
  addChannel: (serverId: string, categoryId: string, channel: { name: string; type: ChannelType; isPrivate?: boolean }) => void;
  openCreateCategory: () => void;
  closeCreateCategory: () => void;
  addCategory: (serverId: string, category: { name: string; isPrivate?: boolean }) => void;
  toggleFolder: (folderId: string) => void;
  toggleCategory: (catId: string) => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  connectToVoice: (channelId: string, channelName: string, serverId: string, serverName: string) => void;
  disconnectFromVoice: () => void;
  // Create Server Modal
  isCreateServerModalOpen: boolean;
  openCreateServerModal: () => void;
  closeCreateServerModal: () => void;
  // Quick Switcher Modal (Ctrl + K)
  isQuickSwitcherOpen: boolean;
  openQuickSwitcher: () => void;
  closeQuickSwitcher: () => void;
  toggleQuickSwitcher: () => void;
  addServer: (serverData: Partial<Server>) => void;
  createCommunityServer: (serverName: string, icon?: string) => Promise<{ success: boolean; serverId?: string; error?: string }>;
  // Server Folders & Rail Order
  folders: ServerFolder[];
  railOrder: string[];
  createFolder: (sourceServerId: string, targetServerId: string, folderName?: string) => void;
  addServerToFolder: (folderId: string, serverId: string) => void;
  removeServerFromFolder: (folderId: string, serverId: string, targetIndex?: number) => void;
  deleteFolder: (folderId: string) => void;
  moveRailItem: (sourceId: string, targetId: string, position?: 'above' | 'below') => void;
  getServerById: (id: string) => Server | undefined;

  deleteServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;
  enableCommunity: (serverId: string) => Promise<{
    success: boolean;
    error?: string;
    remoteSynced?: boolean;
    remoteStatus?: 'synced' | 'schema_missing' | 'permission_denied' | 'network_error' | 'local_only';
    remoteError?: string;
    createdChannels?: string[];
  }>;
  disableCommunity: (serverId: string) => Promise<{ success: boolean; error?: string }>;
  createServerFromTemplate: (template: ServerTemplateData, serverName: string, icon?: string) => Promise<{ success: boolean; serverId?: string; error?: string }>;
  joinCommunityServer: (communityId: string) => Promise<{ success: boolean; server?: Server; error?: string }>;
  reorderServers: (serverId: string, direction: 'up' | 'down') => void;
  moveServer: (sourceServerId: string, targetServerId: string, position?: 'above' | 'below') => void;
  markServerAsRead: (serverId: string) => void;
  toggleMuteServer: (serverId: string) => void;

  // Channels reorder & management
  reorderChannels: (serverId: string, categoryId: string, channelId: string, direction: 'up' | 'down') => void;
  reorderCategories: (serverId: string, categoryId: string, direction: 'up' | 'down') => void;
  moveChannel: (
    serverId: string,
    sourceCategoryId: string,
    targetCategoryId: string,
    channelId: string,
    targetIndex: number
  ) => void;
  moveCategory: (serverId: string, categoryId: string, targetIndex: number) => void;
  editChannel: (serverId: string, categoryId: string, channelId: string, updates: Partial<Channel>) => void;
  deleteChannel: (serverId: string, categoryId: string, channelId: string) => void;
  duplicateChannel: (serverId: string, categoryId: string, channelId: string) => void;
  markChannelAsRead: (serverId: string, categoryId: string, channelId: string) => void;
  markCategoryAsRead: (serverId: string, categoryId: string) => void;
  toggleMuteChannel: (serverId: string, categoryId: string, channelId: string) => void;
  toggleMuteCategory: (serverId: string, categoryId: string) => void;
  editCategory: (serverId: string, categoryId: string, updates: Partial<ChannelCategory>) => void;
  deleteCategory: (serverId: string, categoryId: string) => void;

  // Messages management
  sendMessage: (
    channelId: string,
    content: string,
    attachments?: Message['attachments'],
    replyTo?: { id: string; author: string; content: string }
  ) => void;
  editMessage: (channelId: string, messageId: string, newContent: string) => void;
  deleteMessage: (channelId: string, messageId: string) => void;
  pinMessage: (channelId: string, messageId: string) => void;
  toggleReaction: (channelId: string, messageId: string, emoji: string) => void;

  // Friend Requests
  friendRequests: FriendRequest[];
  sendFriendRequest: (username: string) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  acceptFriendRequest: (requestId: string) => Promise<void> | void;
  rejectFriendRequest: (requestId: string) => Promise<void> | void;

  // Member Moderation & User Management
  kickMember: (serverId: string, userId: string) => Promise<{ success: boolean; message: string }>;
  banMember: (serverId: string, userId: string, reason?: string) => Promise<{ success: boolean; message: string }>;
  serverMuteUser: (userId: string, isMuted: boolean) => void;
  serverDeafenUser: (userId: string, isDeafened: boolean) => void;
  moveUserVoice: (userId: string, targetChannelId: string) => void;
  disconnectUserVoice: (userId: string) => void;
  setUserNickname: (userId: string, nickname: string) => void;
  setUserNote: (userId: string, note: string) => void;
  getUserNote: (userId: string) => string;
  removeFriend: (userId: string) => void;
  canUserModerate: (actorUserId: string, targetUserId?: string, serverId?: string) => { canKick: boolean; canBan: boolean; canManageRoles: boolean; isAdmin: boolean };
  hasServerPermission: (permission: keyof RolePermissions, serverId?: string, channelId?: string) => boolean;
}

export const KNOWN_LEGITIMATE_ACCOUNT_IDS = new Set([
  'f8fcd139-cf43-4873-bd7d-a807ecd73567', // Coronel (Fundador)
  '96dde735-f6d8-4aaf-abd7-0176e44888f2', // Naori
  '7a4901f2-d51f-4747-9c5a-6b3aa716ada6', // Kirito
  '73426b78-425e-486a-abb5-951bf7ca959d', // Everton
  '89ef8f98-37c5-4199-b598-88c90ae2db6e', // HERMAN BETA
  'eda43ba0-44ee-4565-a0e7-bad81800e715', // FOOX7
  '33e0a99f-c10b-4057-b23d-85cf5fc13ba9', // Moraex
]);

export const KNOWN_TEST_ACCOUNT_IDS = new Set([
  'f724e836-be35-4d53-9fd9-4dc97ba1acb9',
  '52f38d7d-666e-4f0f-99c2-7d150659bb39',
  '95dbc856-1489-40f5-914d-3cbc90cbb4e6',
  'a05e5ba0-f76a-4059-8d84-3721761ddd00',
  '929794e5-2a05-4fd3-a72d-618e59d7dc25',
  '53f5007d-a0ba-4cac-92ee-cf57992168f9',
  'f44e2be3-03cd-43e7-995a-719a49f9b012',
  '7b477a9a-8ab1-4ea5-9461-12efe1f67365',
  'd77517df-6a3c-401d-ad3b-6922faa5992f',
  'ed69d1a7-b06c-41f6-8c55-835a7ab28b0b',
  'c542a680-42b2-413a-bf9c-83f967493cac',
  '8a0274f6-731a-4da9-a97d-06343229dbf7',
  '39d81d53-8d89-4f57-a65d-442a72d5e4ad',
  'dc9adf11-5776-40f1-878e-abf05f472f06',
  '6c0f8eef-3549-4efe-9004-c7e321784383',
  '3cb43393-4cdc-4313-9ad5-79cb7605df2c',
  '610a5033-2d02-48c0-8477-e45fba6c4a84',
  '9b13a11b-0180-4f26-b665-23a28d58e387',
  '91738f64-fb1e-464b-abac-a9d0bf45bf33',
  '4cffba8e-9053-4147-8dde-05856a07c37f',
  '3e014270-244b-499b-aa6d-1607fcba4519',
  '2a4ae293-bb97-4e95-9f02-a44551f78fc4',
  'cae45643-956a-4f75-a8fa-d7c279cebf5f',
  'a58a003b-6df2-4dda-90f5-3f9c4dcd0043',
  '06f17e89-d088-46ed-a254-cfc79217480c',
  '3a607ed3-ec3c-49f4-89cd-2e37fc566bb9',
  '811408b4-31cf-4b76-ad0b-d800acc9f157',
  'caa4962e-b170-42ed-aafa-fa11544163de',
  '857daae0-274a-46b3-86b5-86ccb5590d1f',
  'd5f11ad9-d964-4ec7-9bc6-f38a3c9d5477',
  'cb149b42-f4ff-450e-854b-5ee6bb72a161',
  'ad9ffc6e-38a5-4ed3-a486-b6f6febd7a20',
  '88b43829-8bdb-4594-b52e-25d14c6d4754',
  '31022437-2bd6-43ec-9928-9c036d4c196d',
  '40982cea-dd0f-47d7-8a86-963bac7d4f09',
  '000fd306-9ad4-40dc-a04e-8e31dcdc77c2',
  '1f3fdac8-67b6-4661-8ffc-5cdd5db73cb0',
  '4ae28e23-67b8-4d11-8f73-bd6da4dd2c10',
  '9a01d454-06df-48fc-8b2d-614af3778d98',
  '5f9bbc35-e688-4e1f-b6c2-813dc3c4d14a',
  'b230b2b6-f2b2-44af-810d-2a8aa44142d6',
  '6df208d7-2872-434d-92c5-87124302269d',
  'e6bdce18-9987-483a-9168-3fdfd0f64942',
  '989cef9a-0649-4b21-b429-62d0c1716500',
  '0d080b14-b714-4193-abbe-4ea3fd8c0b52',
  'ff8fea75-591b-4b5b-ac5a-69990f4e07f4',
  'd9bb15ae-30fa-4922-8ee7-0dca01b84a34',
  '05063ba9-db4a-423e-8329-81701e8966ce',
  '583edf45-058f-4292-b93e-d7ae4a07805d',
  '4e0d30c0-bc2d-401f-8bbe-3f4bf1a66c7a',
  'ff997b21-8be6-4acb-a980-ac28d8f8bb3b',
  '82668c61-d66c-4160-84cf-6f59236a77b5',
  'f2e463e2-a983-4511-bd16-397af49462cd',
  'a8879b28-cca6-4a7b-b5c4-8e2741a0716a',
  'be75df30-9abd-45d9-91b9-f13524b4919d',
  '791164b0-1ca9-4e6b-9fa1-12040b1be515',
]);

export function isTestAccount(user: { id?: string; name?: string; displayName?: string; username?: string; display_name?: string } | null | undefined): boolean {
  if (!user) return false;
  const id = ((user.id || '') + '').toLowerCase();
  if (KNOWN_LEGITIMATE_ACCOUNT_IDS.has(id)) return false;
  if (KNOWN_TEST_ACCOUNT_IDS.has(id)) return true;

  const name = ((user.name || (user as any).username || '') + '').toLowerCase();
  const displayName = ((user.displayName || (user as any).display_name || '') + '').toLowerCase();

  // Preservar conta legítima Herman Beta
  if (name === 'hermanbeta' || displayName === 'herman beta') return false;

  // Preservar contas legítimas conhecidas pelo username
  if (['lycdev', 'naori', 'david', 'everton', 'foox7', 'moraex', 'kirito'].includes(name)) return false;

  // Test accounts used during registration/auth tests
  if (
    displayName.includes('alpha') ||
    displayName.includes('beta') ||
    displayName.includes('tester') ||
    displayName.includes('inspector') ||
    displayName.includes('checker') ||
    displayName.includes('rpc user') ||
    displayName.includes('amigo convidado') ||
    displayName.includes('capy amigo') ||
    displayName.includes('capy updated name') ||
    displayName.includes('user x') ||
    displayName.includes('user y') ||
    displayName.includes('user z') ||
    name.startsWith('capy_a_') ||
    name.startsWith('capy_b_') ||
    name.startsWith('capy_') ||
    name.startsWith('iso_x_') ||
    name.startsWith('iso_y_') ||
    name.startsWith('iso_z_') ||
    name.startsWith('user_x_') ||
    name.startsWith('user_y_') ||
    name.startsWith('user_z_') ||
    name.startsWith('amigo_') ||
    name.startsWith('tester_') ||
    name.startsWith('test_') ||
    name.startsWith('livekit_auditor') ||
    name.startsWith('check_policy') ||
    (/^u_[0-9a-f]{16,}$/i.test(name) && (!displayName || displayName === 'membro' || displayName.startsWith('u_'))) ||
    id.includes('test-user')
  ) {
    return true;
  }
  return false;
}

export const loadInitialServerMembersMap = (): Record<string, string[]> => {
  if (!isBrowser) return {};
  try {
    const raw = window.localStorage.getItem('lyc_server_members_map');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {};
};

export const loadInitialSavedAccounts = (): SavedAccount[] => {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem('capychat_saved_accounts');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
};

const LEGACY_SERVER_IDS = ['server-torneios', 'server-dev', 'server-cs2', 'server-val', 'server-testes'];

export const reconcileOfficialCategories = (defaultCategories: ChannelCategory[], savedCategories?: ChannelCategory[]): ChannelCategory[] => {
  if (!savedCategories || savedCategories.length === 0) {
    return defaultCategories;
  }

  const result: ChannelCategory[] = savedCategories.map(cat => ({
    ...cat,
    channels: [...cat.channels],
  }));

  for (const defCat of defaultCategories) {
    const existingCat = result.find(c => c.id === defCat.id);
    if (!existingCat) {
      result.push({ ...defCat, channels: [...defCat.channels] });
    } else {
      for (const defChannel of defCat.channels) {
        const chIndex = existingCat.channels.findIndex(ch => ch.id === defChannel.id);
        if (chIndex === -1) {
          existingCat.channels.push(defChannel);
        } else {
          if (defChannel.id === 'ch-geral') {
            existingCat.channels[chIndex] = {
              ...existingCat.channels[chIndex],
              name: defChannel.name,
              topic: defChannel.topic || existingCat.channels[chIndex].topic,
            };
          }
        }
      }
    }
  }

  return result;
};

export const loadInitialServers = (): Server[] => {
  if (!isBrowser) return mockServers;
  let allServers = [...mockServers];
  try {
    const savedState = window.localStorage.getItem('lyc_servers_state');
    const leftServers: string[] = JSON.parse(window.localStorage.getItem('lyc_left_servers') || '[]');

    if (savedState) {
      const parsed = JSON.parse(savedState) as Server[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Excluir servidores legados indesejados, de teste ou criados por scripts
        const filtered = parsed.filter((s) => {
          if (LEGACY_SERVER_IDS.includes(s.id)) return false;
          if (leftServers.includes(s.id)) return false;
          if (
            s.name.includes('Alpha') ||
            s.name.includes('Beta') ||
            s.name.includes('Modelo') ||
            (s.ownerId && KNOWN_TEST_ACCOUNT_IDS.has(s.ownerId))
          ) {
            return false;
          }
          return true;
        });
        const lycServer = leftServers.includes('server-lyc') ? null : filtered.find((s) => s.id === 'server-lyc');

        const baseServers: Server[] = [];
        if (!leftServers.includes('server-lyc')) {
          baseServers.push({
            ...mockServers[0],
            ...(lycServer || {}),
            name: 'CapyChat Oficial',
            categories: reconcileOfficialCategories(mockServers[0].categories, lycServer?.categories),
            icon: lycServer?.icon && !lycServer.icon.includes('mascote-cabeca') ? getAssetUrl(lycServer.icon) : getAssetUrl('assets/logo-circular.png'),
            isVerified: true,
            verifiedBadgeStyle: 'blue',
            memberCount: lycServer?.memberCount && lycServer.memberCount < 1000 ? lycServer.memberCount : 7,
            onlineCount: lycServer?.onlineCount || 0,
            createdAtDaysAgo: lycServer?.createdAtDaysAgo && lycServer.createdAtDaysAgo >= 30 ? lycServer.createdAtDaysAgo : 60,
            boostCount: 24,
            boostLevel: 3,
            showBoostProgressBar: true,
          });
        }

        allServers = [
          ...baseServers,
          ...filtered.filter((s) => s.id !== 'server-lyc' && s.id !== 'server-testes'),
        ];
      }
    } else {
      allServers = allServers.filter((s) => !leftServers.includes(s.id) && !LEGACY_SERVER_IDS.includes(s.id));
    }
  } catch {}

  let savedMembersMap: Record<string, string[]> = {};
  if (isBrowser) {
    try {
      savedMembersMap = JSON.parse(window.localStorage.getItem('lyc_server_members_map') || '{}');
    } catch {}
  }

  const mapped = allServers.map((s) => {
    const savedIcon = window.localStorage.getItem(`lyc_server_icon_${s.id}`);
    const savedBannerImage = window.localStorage.getItem(`lyc_server_bannerImage_${s.id}`);
    const savedBannerColor = window.localStorage.getItem(`lyc_server_bannerColor_${s.id}`);

    const isOfficial = s.id === 'server-lyc';
    const ownerId = s.ownerId || (isOfficial ? 'f8fcd139-cf43-4873-bd7d-a807ecd73567' : currentUser.id);
    let memberIds = s.memberIds && s.memberIds.length > 0 ? s.memberIds : savedMembersMap[s.id];
    if (!isOfficial && (!memberIds || memberIds.length === 0)) {
      memberIds = [ownerId || currentUser.id];
    }

    const isCommSaved = isBrowser && window.localStorage.getItem(`lyc_community_enabled_${s.id}`) === 'true';
    const isCommunity = Boolean(s.isCommunity || isCommSaved || isOfficial);
    const rulesChannelId = (isBrowser && window.localStorage.getItem(`lyc_community_rules_ch_${s.id}`)) || s.rulesChannelId;
    const publicUpdatesChannelId = (isBrowser && window.localStorage.getItem(`lyc_community_updates_ch_${s.id}`)) || s.publicUpdatesChannelId;

    return {
      ...s,
      isCommunity,
      rulesChannelId,
      publicUpdatesChannelId,
      ownerId,
      memberIds,
      memberCount: isOfficial ? (s.memberCount && s.memberCount < 1000 ? s.memberCount : 7) : (memberIds ? memberIds.length : 1),
      onlineCount: s.onlineCount,
      icon: savedIcon !== null && savedIcon !== '' ? savedIcon : s.icon,
      bannerImage: savedBannerImage !== null && savedBannerImage !== '' ? savedBannerImage : s.bannerImage,
      bannerColor: savedBannerColor !== null && savedBannerColor !== '' ? savedBannerColor : s.bannerColor,
    };
  });

  saveServersStateToStorage(mapped);
  return mapped;
};

const saveServersStateToStorage = (servers: Server[]) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem('lyc_servers_state', JSON.stringify(servers));
  } catch {}
};

export const loadInitialFolders = (): ServerFolder[] => {
  if (!isBrowser) return mockFolders;
  try {
    const saved = window.localStorage.getItem('lyc_server_folders');
    if (saved) {
      const parsed = JSON.parse(saved) as ServerFolder[];
      if (Array.isArray(parsed)) {
        // Filtrar servidores legados de dentro das pastas e remover pastas legadas
        const cleanedFolders = parsed
          .map((f) => ({
            ...f,
            servers: f.servers.filter((s) => !LEGACY_SERVER_IDS.includes(s.id)),
          }))
          .filter((f) => f.servers.length > 0 && f.id !== 'folder-games');
        saveFoldersStateToStorage(cleanedFolders);
        return cleanedFolders;
      }
    }
  } catch {}
  saveFoldersStateToStorage([]);
  return [];
};

export const saveFoldersStateToStorage = (folders: ServerFolder[]) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem('lyc_server_folders', JSON.stringify(folders));
  } catch {}
};

export const loadInitialRailOrder = (servers: Server[], folders: ServerFolder[]): string[] => {
  const fallback = [...servers.map((s) => s.id), ...folders.map((f) => f.id)];
  if (!isBrowser) return fallback;
  try {
    const saved = window.localStorage.getItem('lyc_rail_order');
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validIds = new Set([...servers.map((s) => s.id), ...folders.map((f) => f.id)]);
        const filtered = parsed.filter(
          (id) => !LEGACY_SERVER_IDS.includes(id) && id !== 'folder-games' && validIds.has(id)
        );
        for (const s of servers) {
          if (!filtered.includes(s.id)) filtered.push(s.id);
        }
        for (const f of folders) {
          if (!filtered.includes(f.id)) filtered.push(f.id);
        }
        saveRailOrderToStorage(filtered);
        return filtered;
      }
    }
  } catch {}
  saveRailOrderToStorage(fallback);
  return fallback;
};

export const saveRailOrderToStorage = (order: string[]) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem('lyc_rail_order', JSON.stringify(order));
  } catch {}
};

export const loadInitialMessages = (): Record<string, Message[]> => {
  if (!isBrowser) return initialMessages;
  try {
    const saved = window.localStorage.getItem('lyc_messages_history');
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, Message[]>;
      return { ...initialMessages, ...parsed };
    }
  } catch {}
  return initialMessages;
};

const saveMessagesToStorage = (messages: Record<string, Message[]>) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem('lyc_messages_history', JSON.stringify(messages));
  } catch {}
};

let presenceRealtimeChannel: any = null;
let presenceSweepInterval: any = null;
let presenceDebounceTimeout: any = null;
export const presenceLeaseCache: Map<string, string | null> = new Map();
let communityFetchSeq = 0;

export const useDiscord = create<DiscordStore>((set, get) => ({
  // Current User & Auth
  currentUser: { ...currentUser },
  isAuthenticated: isBrowser ? window.localStorage.getItem('capychat_is_authenticated') === 'true' : false,
  isLoggingOut: false,
  communityMembers: [],
  serverMembersMap: loadInitialServerMembersMap(),
  savedAccounts: loadInitialSavedAccounts(),
  realtimeOnlineIds: new Set<string>(),

  setRealtimeOnlineIds: (ids) => {
    set({ realtimeOnlineIds: ids });
    scheduleDebouncedMemberRefresh();
  },

  updatePresenceLease: (userId, expiresAt, status) => {
    presenceLeaseCache.set(userId, expiresAt);
    if (status === 'online') {
      const current = new Set(get().realtimeOnlineIds);
      current.add(userId);
      set({ realtimeOnlineIds: current });
    }
    scheduleDebouncedMemberRefresh();
  },

  addSavedAccount: (account) => {
    set((state) => {
      const filtered = state.savedAccounts.filter((a) => a.id !== account.id);
      const updated = [account, ...filtered];
      if (isBrowser) {
        window.localStorage.setItem('capychat_saved_accounts', JSON.stringify(updated));
      }
      return { savedAccounts: updated };
    });
  },

  removeSavedAccount: (accountId) => {
    set((state) => {
      const updated = state.savedAccounts.filter((a) => a.id !== accountId);
      if (isBrowser) {
        window.localStorage.setItem('capychat_saved_accounts', JSON.stringify(updated));
        window.localStorage.removeItem(`capychat_session_${accountId}`);
      }
      return { savedAccounts: updated };
    });
  },

  switchAccount: async (targetAccountId) => {
    const state = get();

    // 1. Unsubscribe and destroy all active Realtime channels of the current user
    state.stopPresenceTracking();
    try {
      if (supabase) {
        supabase.removeAllChannels();
      }
    } catch (e) {
      console.warn('[discordStore] Error clearing realtime channels on switch:', e);
    }

    // 2. Disconnect from voice and transient rooms
    try {
      state.disconnectFromVoice();
    } catch {}

    // 3. Keep current account in savedAccounts
    if (state.currentUser?.id) {
      state.addSavedAccount({
        id: state.currentUser.id,
        name: state.currentUser.name || 'Usuário',
        displayName: state.currentUser.displayName || state.currentUser.name,
        avatar: state.currentUser.avatar || DEFAULT_AVATAR,
        tag: state.currentUser.tag || '0001',
        lastActive: 'Agora mesmo',
      });
    }

    const target = state.savedAccounts.find((a) => a.id === targetAccountId);
    if (!target) return { success: false, error: 'Conta não encontrada no dispositivo.' };

    // 4. If Supabase is active, verify and switch the authentic session
    if (supabase && isBrowser) {
      const rawSession = window.localStorage.getItem(`capychat_session_${targetAccountId}`);
      if (rawSession) {
        try {
          const tokens = JSON.parse(rawSession);
          if (tokens?.access_token && tokens?.refresh_token) {
            const { data: setSessData, error: setSessErr } = await supabase.auth.setSession({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
            });

            if (!setSessErr && setSessData?.session?.user) {
              // Successfully switched session in Supabase backend!
              window.localStorage.setItem(
                `capychat_session_${targetAccountId}`,
                JSON.stringify({
                  access_token: setSessData.session.access_token,
                  refresh_token: setSessData.session.refresh_token,
                })
              );
              window.localStorage.setItem('capychat_is_authenticated', 'true');
              await state.syncProfileFromSupabase(setSessData.session.user.id);
              return { success: true };
            }
          }
        } catch (e) {
          console.warn('[discordStore] Error during setSession on switch:', e);
        }
      }

      // No valid session token exists: require re-authentication for this account
      return {
        success: false,
        requiresLogin: true,
        error: 'Sessão expirada para esta conta. Faça login novamente para alternar.',
      };
    }

    // Offline / Demo environment: switch local representation
    set((s) => ({
      currentUser: {
        ...s.currentUser,
        id: target.id,
        name: target.name,
        displayName: target.displayName || target.name,
        avatar: target.avatar,
        tag: target.tag || '0001',
      },
      isAuthenticated: true,
    }));

    if (isBrowser) {
      window.localStorage.setItem('capychat_is_authenticated', 'true');
      if (target.displayName) window.localStorage.setItem('lycDisplayName', target.displayName);
      if (target.avatar) window.localStorage.setItem('lycUserAvatar', target.avatar);
    }

    return { success: true };
  },

  login: (userUpdates) => {
    if (isBrowser) {
      window.localStorage.setItem('capychat_is_authenticated', 'true');
    }
    set((state) => {
      const nextUser = userUpdates ? { ...state.currentUser, ...userUpdates } : state.currentUser;
      if (nextUser.id) {
        const acc: SavedAccount = {
          id: nextUser.id,
          name: nextUser.name || 'Usuário',
          displayName: nextUser.displayName || nextUser.name,
          avatar: nextUser.avatar || DEFAULT_AVATAR,
          tag: nextUser.tag || '0001',
          lastActive: 'Agora mesmo',
        };
        const filtered = state.savedAccounts.filter((a) => a.id !== nextUser.id);
        const updatedAccounts = [acc, ...filtered];
        if (isBrowser) {
          window.localStorage.setItem('capychat_saved_accounts', JSON.stringify(updatedAccounts));
        }
        return {
          isAuthenticated: true,
          currentUser: nextUser,
          savedAccounts: updatedAccounts,
        };
      }
      return {
        isAuthenticated: true,
        currentUser: nextUser,
      };
    });
    void get().fetchCommunityMembers();
    get().startPresenceTracking();
  },

  logout: async (options?: { skipSupabaseSignOut?: boolean }) => {
    get().stopPresenceTracking();
    if (get().isLoggingOut) return;
    set({ isLoggingOut: true });

    try {
      // 1. Terminate Supabase session if not skipped (with safety timeout)
      if (supabase && !options?.skipSupabaseSignOut) {
        try {
          const signOutPromise = supabase.auth.signOut({ scope: 'local' });
          const timeoutPromise = new Promise<{ error: null }>((resolve) =>
            setTimeout(() => resolve({ error: null }), 3000)
          );
          await Promise.race([signOutPromise, timeoutPromise]);
        } catch (e) {
          console.warn('[discordStore] Error signing out from Supabase:', e);
        }
      }

      // 2. Unsubscribe and remove all active realtime channels
      try {
        if (supabase) {
          supabase.removeAllChannels();
        }
      } catch (e) {
        console.warn('[discordStore] Error removing realtime channels:', e);
      }

      // 3. Clear private auth and user cache in localStorage
      const storage = getStorage();
      if (storage) {
        storage.removeItem('capychat_is_authenticated');
        storage.removeItem('lyc_messages_history');
        storage.removeItem('lycDisplayName');
        storage.removeItem('lycUserAvatar');
        storage.removeItem('lycUserBannerColor');
        storage.removeItem('lycUserBannerImage');
        storage.removeItem('lycAboutMe');
        const curId = get().currentUser.id;
        if (curId) {
          storage.removeItem(`lyc_displayed_badges_${curId}`);
        }
      }

      // 4. Disconnect from voice and reset transient interaction states
      try {
        get().disconnectFromVoice();
      } catch {}

      // 5. Reset all private user and navigation states
      set({
        isAuthenticated: false,
        activeView: 'chat',
        isSettingsModalOpen: false,
        isUserProfileModalOpen: false,
        userProfileModalTarget: null,
        selectedMemberForPopout: null,
        popoutPosition: null,
        isQuickSwitcherOpen: false,
        currentUser: {
          id: '',
          name: '',
          displayName: '',
          tag: '0001',
          avatar: DEFAULT_AVATAR,
          status: 'offline',
        },
      });
    } finally {
      set({ isLoggingOut: false });
    }
  },

  syncProfileFromSupabase: async (userId?: string) => {
    if (!supabase) return;
    try {
      let targetId = userId;
      if (!targetId) {
        const { data: sessData } = await supabase.auth.getSession();
        targetId = sessData?.session?.user?.id;
      }
      if (!targetId) return;

      const { data: profile, error } = await db()
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .single();

      if (error) {
        console.warn('[discordStore] Error fetching profile:', error);
        return;
      }

      if (profile) {
        let displayedBadges: string[] | undefined = undefined;
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (Array.isArray(userData?.user?.user_metadata?.displayed_badges)) {
            displayedBadges = userData.user.user_metadata.displayed_badges;
          }
        } catch {}

        if (!displayedBadges && isBrowser) {
          const localSaved = window.localStorage.getItem(`lyc_displayed_badges_${profile.id}`);
          if (localSaved) {
            try {
              displayedBadges = JSON.parse(localSaved);
            } catch {}
          }
        }

        const localPrimary = isBrowser ? window.localStorage.getItem('lyc_themePrimaryColor') : null;
        const localSecondary = isBrowser ? window.localStorage.getItem('lyc_themeSecondaryColor') : null;
        const effectivePrimary = (localPrimary && localPrimary.trim() !== '')
          ? localPrimary
          : (profile.profile_primary_color && profile.profile_primary_color !== '#000000' ? profile.profile_primary_color : undefined);
        const effectiveSecondary = (localSecondary && localSecondary.trim() !== '')
          ? localSecondary
          : (profile.profile_accent_color && profile.profile_accent_color !== '#000000' ? profile.profile_accent_color : undefined);

        const mappedUser: User = {
          id: profile.id,
          name: profile.username || 'usuario',
          displayName: profile.display_name || profile.username || 'CapyMembro',
          tag: profile.id.replace(/-/g, '').slice(0, 4),
          avatar: getAvatarUrl(profile.avatar_url),
          bannerColor: profile.profile_primary_color || (isBrowser ? window.localStorage.getItem('lyc_bannerColor') : undefined) || '#5865f2',
          bannerImage: profile.banner_url || (isBrowser ? window.localStorage.getItem('lyc_bannerImage') : undefined) || undefined,
          status: 'online',
          customStatus: profile.custom_status || 'Online no CapyChat Oficial',
          aboutMe: profile.bio || '',
          role: profile.role,
          badges: profile.role === 'OWNER' ? ['capy_founder', 'capy_staff', 'capy_supporter', 'capy_community'] : ['capy_community', 'capy_supporter'],
          displayedBadges,
          joinedDate: profile.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : 'Hoje',
          nameFont: profile.name_font || (isBrowser ? window.localStorage.getItem('lyc_nameFont') : undefined) || undefined,
          nameEffect: profile.name_effect || (isBrowser ? window.localStorage.getItem('lyc_nameEffect') : undefined) || undefined,
          nameColor: profile.name_color || (isBrowser ? window.localStorage.getItem('lyc_nameColor') : undefined) || undefined,
          themePrimaryColor: effectivePrimary,
          themeSecondaryColor: effectiveSecondary,
        };

        Object.assign(currentUser, mappedUser);
        if (mockUsers.length > 0) {
          mockUsers[0] = { ...mappedUser };
        }

        if (isBrowser) {
          window.localStorage.setItem('capychat_is_authenticated', 'true');
        }

        set({
          currentUser: mappedUser,
          isAuthenticated: true,
        });

        // Garantir que a barra lateral de servidores mostre apenas servidores do usuário logado ou oficiais
        set((s) => {
          const scopedServers = s.servers.filter((srv) => {
            if (srv.id === 'server-lyc') return true;
            if (srv.ownerId === mappedUser.id) return true;
            if (srv.memberIds && srv.memberIds.includes(mappedUser.id)) return true;
            return false;
          });
          saveServersStateToStorage(scopedServers);
          return { servers: scopedServers };
        });

        get().addSavedAccount({
          id: mappedUser.id,
          name: mappedUser.name,
          displayName: mappedUser.displayName || mappedUser.name,
          avatar: mappedUser.avatar,
          tag: mappedUser.tag,
          lastActive: 'Agora mesmo',
        });

        if (supabase && isBrowser) {
          try {
            const { data: sessData } = await supabase.auth.getSession();
            if (sessData?.session?.user?.id === mappedUser.id && sessData.session.access_token) {
              window.localStorage.setItem(
                `capychat_session_${mappedUser.id}`,
                JSON.stringify({
                  access_token: sessData.session.access_token,
                  refresh_token: sessData.session.refresh_token,
                })
              );
            }
          } catch {}
        }

        void get().fetchCommunityMembers();
        get().startPresenceTracking();

        // Sincronizar estado de comunidades remotas do Supabase Cloud (is_community, rules_channel_id, public_updates_channel_id)
        try {
          const { data: remoteComms } = await db()
            .from('communities')
            .select('id, name, is_official, is_community, rules_channel_id, public_updates_channel_id, owner_id');

          if (remoteComms && remoteComms.length > 0) {
            set((s) => {
              const updatedServers = s.servers.map((srv) => {
                const matched = remoteComms.find(
                  (c) =>
                    c.id === srv.communityId ||
                    c.id === srv.id ||
                    (srv.id === 'server-lyc' && c.is_official)
                );
                if (!matched) return srv;

                const isCommunity = Boolean(matched.is_community);
                const rulesChannelId = matched.rules_channel_id || srv.rulesChannelId;
                const publicUpdatesChannelId = matched.public_updates_channel_id || srv.publicUpdatesChannelId;

                if (isBrowser) {
                  try {
                    window.localStorage.setItem(`lyc_community_enabled_${srv.id}`, isCommunity ? 'true' : 'false');
                    if (rulesChannelId) window.localStorage.setItem(`lyc_community_rules_ch_${srv.id}`, rulesChannelId);
                    if (publicUpdatesChannelId) window.localStorage.setItem(`lyc_community_updates_ch_${srv.id}`, publicUpdatesChannelId);
                  } catch {}
                }

                return {
                  ...srv,
                  communityId: matched.id,
                  ownerId: (matched as any).owner_id || srv.ownerId,
                  isCommunity,
                  rulesChannelId,
                  publicUpdatesChannelId,
                };
              });

              saveServersStateToStorage(updatedServers);
              return { servers: updatedServers };
            });
          }

          // Sincronizar servidores de comunidades onde o usuário é membro ativo
          const { data: userMemberships } = await db()
            .from('community_members')
            .select('community_id')
            .eq('user_id', mappedUser.id)
            .is('left_at', null);

          if (userMemberships) {
            const memberCommIds = new Set(userMemberships.map((m) => m.community_id));
            // Filtrar servidores locais: manter oficial e comunidades das quais o usuário é membro ativo
            set((s) => {
              const filtered = s.servers.filter((srv) => {
                if (srv.id === 'server-lyc' || srv.isVerified || srv.communityId === 'd3f2173f-79f0-4362-b60a-ad079f724b54') return true;
                const cid = srv.communityId || srv.id;
                return memberCommIds.has(cid);
              });
              saveServersStateToStorage(filtered);
              return { servers: filtered };
            });

            // Carregar todas as comunidades do usuário que ainda não estejam na store
            const currentServerIds = new Set(get().servers.map((s) => s.communityId || s.id));
            await Promise.all(
              userMemberships.map(async (m) => {
                if (!currentServerIds.has(m.community_id) && m.community_id !== 'd3f2173f-79f0-4362-b60a-ad079f724b54') {
                  await get().joinCommunityServer(m.community_id);
                }
              })
            );
          }
        } catch (commSyncErr) {
          console.warn('[discordStore] Remote communities sync warning:', commSyncErr);
        }
      }
    } catch (e) {
      console.error('[discordStore] syncProfileFromSupabase exception:', e);
    }
  },

  fetchCommunityMembers: async (communityId?: string) => {
    if (!supabase) return;
    const targetCommunityId = communityId || 'd3f2173f-79f0-4362-b60a-ad079f724b54';
    const seq = ++communityFetchSeq;

    try {
      // 1. Fetch active members of the community
      const { data: commMembers, error: commError } = await db()
        .from('community_members')
        .select('user_id, joined_at, role_id')
        .eq('community_id', targetCommunityId)
        .is('left_at', null);

      if (seq !== communityFetchSeq) return;
      if (commError || !commMembers) return;

      const memberUserIds = commMembers.map((m) => m.user_id);
      if (memberUserIds.length === 0) return;

      // 2. Fetch profiles strictly for active members
      const { data: profiles, error: profError } = await db()
        .from('profiles')
        .select('*')
        .in('id', memberUserIds);

      if (seq !== communityFetchSeq) return;
      if (profError || !profiles) return;

      // 3. Fetch presence strictly for active members
      const { data: presenceRows } = await db()
        .from('user_presence')
        .select('user_id, status, expires_at')
        .in('user_id', memberUserIds);

      if (seq !== communityFetchSeq) return;

      const now = Date.now();
      const presenceMap = new Map<string, string>();
      if (presenceRows) {
        for (const p of presenceRows) {
          presenceLeaseCache.set(p.user_id, p.expires_at);
          const isOnline = isPresenceOnline(p, now);
          presenceMap.set(p.user_id, isOnline ? 'online' : 'offline');
        }
      }

      const curUser = get().currentUser;
      const curId = curUser?.id;

      // Filter out test accounts so they never pollute production servers or member list
      const authenticProfiles = profiles.filter((p) => !isTestAccount({
        id: p.id,
        name: p.username,
        displayName: p.display_name,
        username: p.username,
        display_name: p.display_name,
      }));

      const realtimeOnlineIds = get().realtimeOnlineIds;
      const mappedMembers: User[] = authenticProfiles.map((p) => {
        const isSelf = p.id === curId || p.id === 'user-me' || p.username === curUser?.name;
        const isRealtimeOnline = realtimeOnlineIds.has(p.id);
        const isDbOnline = presenceMap.get(p.id) === 'online';
        const realStatus = isSelf
          ? (curUser?.status || 'online')
          : (isRealtimeOnline || isDbOnline ? 'online' : 'offline');

        return {
          id: p.id,
          name: p.username || 'usuario',
          displayName: isSelf ? (curUser?.displayName || p.display_name || p.username || 'Membro') : (p.display_name || p.username || 'Membro'),
          tag: p.id.replace(/-/g, '').slice(0, 4),
          avatar: getAvatarUrl(isSelf ? (curUser?.avatar || p.avatar_url) : p.avatar_url),
          bannerColor: isSelf ? (curUser?.bannerColor || p.profile_primary_color || '#5865f2') : (p.profile_primary_color || '#5865f2'),
          bannerImage: isSelf ? (curUser?.bannerImage || p.banner_url || undefined) : (p.banner_url || undefined),
          status: realStatus as any,
          customStatus: p.custom_status || (p.role === 'OWNER' ? '👑 Fundador do CapyChat' : undefined),
          aboutMe: isSelf ? (curUser?.aboutMe || p.bio || '') : (p.bio || ''),
          role: p.role,
          badges: p.role === 'OWNER' ? ['capy_founder', 'capy_staff', 'capy_supporter', 'capy_community'] : ['capy_community', 'capy_supporter'],
          displayedBadges: isSelf ? get().currentUser.displayedBadges : undefined,
          nameFont: isSelf ? curUser?.nameFont : undefined,
          nameEffect: isSelf ? curUser?.nameEffect : undefined,
          nameColor: isSelf ? curUser?.nameColor : undefined,
          themePrimaryColor: isSelf ? curUser?.themePrimaryColor : undefined,
          themeSecondaryColor: isSelf ? curUser?.themeSecondaryColor : undefined,
        };
      });

      const totalMembers = mappedMembers.length;
      const onlineMembers = mappedMembers.filter((m) => m.status !== 'offline').length;

      // Update servers array with real memberCount and onlineCount
      set((s) => {
        const updatedServers = s.servers.map((srv) => {
          if (
            srv.communityId === targetCommunityId ||
            (srv.id === 'server-lyc' && targetCommunityId === 'd3f2173f-79f0-4362-b60a-ad079f724b54') ||
            srv.id === targetCommunityId
          ) {
            return {
              ...srv,
              memberCount: totalMembers,
              onlineCount: onlineMembers,
            };
          }
          return srv;
        });
        saveServersStateToStorage(updatedServers);
        return {
          servers: updatedServers,
          communityMembers: mappedMembers,
        };
      });

      // 4. Fetch community roles and assigned member roles from database
      try {
        const [dbRolesRes, memberRolesRes] = await Promise.all([
          db()
            .from('community_roles')
            .select('*, community_role_permissions(permission)')
            .eq('community_id', targetCommunityId)
            .is('deleted_at', null)
            .order('position', { ascending: false }),
          db()
            .from('community_member_roles')
            .select('user_id, role_id')
            .eq('community_id', targetCommunityId),
        ]);

        if (seq === communityFetchSeq) {
          const dbRoles = dbRolesRes.data || [];
          const memberRoles = memberRolesRes.data || [];

          if (dbRoles.length > 0) {
            const mappedRoles: Role[] = dbRoles.map((dr: any) => ({
              id: dr.id,
              name: dr.name,
              color: dr.color || (dr.base_role === 'OWNER' ? '#f1c40f' : dr.base_role === 'ADMIN' ? '#e91e63' : dr.base_role === 'MODERATOR' ? '#2ecc71' : '#99aab5'),
              hoist: Boolean(dr.hoist),
              position: dr.position ?? 0,
              memberCount: memberRoles.filter((mr: any) => mr.role_id === dr.id).length,
              permissions: {
                viewChannels: (dr.community_role_permissions || []).some((p: any) => p.permission === 'view_channels') ?? true,
                manageChannels: (dr.community_role_permissions || []).some((p: any) => p.permission === 'manage_channels'),
                manageRoles: (dr.community_role_permissions || []).some((p: any) => p.permission === 'manage_roles'),
                kickMembers: (dr.community_role_permissions || []).some((p: any) => p.permission === 'kick_members' || p.permission === 'moderate_members' || p.permission === 'manage_members'),
                banMembers: (dr.community_role_permissions || []).some((p: any) => p.permission === 'ban_members' || p.permission === 'moderate_members' || p.permission === 'manage_members'),
                timeoutMembers: (dr.community_role_permissions || []).some((p: any) => p.permission === 'timeout_members' || p.permission === 'moderate_members'),
                manageNicknames: (dr.community_role_permissions || []).some((p: any) => p.permission === 'manage_nicknames'),
                changeNickname: (dr.community_role_permissions || []).some((p: any) => p.permission === 'change_nickname') ?? true,
                sendMessages: (dr.community_role_permissions || []).some((p: any) => p.permission === 'send_messages') ?? true,
                manageMessages: (dr.community_role_permissions || []).some((p: any) => p.permission === 'manage_messages'),
                embedLinks: (dr.community_role_permissions || []).some((p: any) => p.permission === 'embed_links') ?? true,
                attachFiles: (dr.community_role_permissions || []).some((p: any) => p.permission === 'attach_files') ?? true,
                addReactions: (dr.community_role_permissions || []).some((p: any) => p.permission === 'add_reactions') ?? true,
                mentionEveryone: (dr.community_role_permissions || []).some((p: any) => p.permission === 'mention_everyone'),
                connectVoice: (dr.community_role_permissions || []).some((p: any) => p.permission === 'connect_voice') ?? true,
                speak: (dr.community_role_permissions || []).some((p: any) => p.permission === 'speak') ?? true,
                video: (dr.community_role_permissions || []).some((p: any) => p.permission === 'video'),
                streamScreen: (dr.community_role_permissions || []).some((p: any) => p.permission === 'share_screen') ?? true,
                muteMembers: (dr.community_role_permissions || []).some((p: any) => p.permission === 'mute_members'),
                disconnectMembers: (dr.community_role_permissions || []).some((p: any) => p.permission === 'disconnect_members'),
                manageCommunity: (dr.community_role_permissions || []).some((p: any) => p.permission === 'manage_community'),
                viewAuditLog: (dr.community_role_permissions || []).some((p: any) => p.permission === 'view_audit_log'),
                createInvites: (dr.community_role_permissions || []).some((p: any) => p.permission === 'create_invites') ?? true,
                administrator: dr.base_role === 'OWNER' || (dr.community_role_permissions || []).some((p: any) => p.permission === 'manage_community' || p.permission === 'administrator'),
              },
            }));

            set((s) => {
              const updatedRolesMap = {
                ...s.serverRolesMap,
                [targetCommunityId]: mappedRoles,
                ...(targetCommunityId === 'd3f2173f-79f0-4362-b60a-ad079f724b54' ? { 'server-lyc': mappedRoles } : {}),
              };
              saveServerRolesMapToStorage(updatedRolesMap);
              return {
                serverRolesMap: updatedRolesMap,
                roles: s.activeServerId === targetCommunityId || (s.activeServerId === 'server-lyc' && targetCommunityId === 'd3f2173f-79f0-4362-b60a-ad079f724b54') ? mappedRoles : s.roles,
              };
            });
          }

          // Build complete userRoleMap from database
          const currentMap = { ...get().userRoleMap };
          for (const m of commMembers) {
            const userRoles = memberRoles
              .filter((mr: any) => mr.user_id === m.user_id)
              .map((mr: any) => mr.role_id);
            if (m.role_id && !userRoles.includes(m.role_id)) {
              userRoles.push(m.role_id);
            }

            const prof = authenticProfiles.find((p) => p.id === m.user_id);
            if (prof?.role === 'OWNER' || prof?.role === 'ADMIN') {
              if (!userRoles.includes('role-admin')) userRoles.push('role-admin');
            } else if (prof?.role === 'MODERATOR') {
              if (!userRoles.includes('role-mod')) userRoles.push('role-mod');
            }

            currentMap[m.user_id] = userRoles;
          }

          saveUserRoleMapToStorage(currentMap);
          set({ userRoleMap: currentMap });
        }
      } catch (rolesErr) {
        console.warn('[discordStore] fetchCommunityMembers roles sync error:', rolesErr);
      }
    } catch (err) {
      console.warn('[discordStore] fetchCommunityMembers failed:', err);
    }
  },

  startPresenceTracking: (communityId?: string) => {
    const targetCommunityId = communityId || 'd3f2173f-79f0-4362-b60a-ad079f724b54';

    // 1. Cleanup any previous tracking before re-subscribing
    get().stopPresenceTracking();

    if (supabase) {
      try {
        const channelId = `presence-tracker-${targetCommunityId}-${Date.now()}`;
        const channel = supabase
          .channel(channelId)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'user_presence' },
            (payload: any) => {
              if (payload?.new && payload.new.user_id) {
                presenceLeaseCache.set(payload.new.user_id, payload.new.expires_at);
              }
              scheduleDebouncedMemberRefresh(targetCommunityId);
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'community_members' },
            () => {
              scheduleDebouncedMemberRefresh(targetCommunityId);
            }
          );

        channel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            void get().fetchCommunityMembers(targetCommunityId);
          }
        });

        presenceRealtimeChannel = channel;
      } catch (err) {
        console.warn('[discordStore] Realtime presence subscription error:', err);
      }
    }

    // 2. Start presence service (heartbeat + Realtime presence channel)
    try {
      presenceService.start(targetCommunityId);
    } catch (e) {
      console.warn('[discordStore] Error starting presenceService:', e);
    }

    // 3. Setup periodic lease sweep every 10 seconds (pure client-side timestamp comparison, zero network calls)
    presenceSweepInterval = setInterval(() => {
      sweepExpiredPresences(targetCommunityId);
    }, 10000);
  },

  stopPresenceTracking: () => {
    try {
      presenceService.stop();
    } catch {}

    if (presenceRealtimeChannel) {
      try {
        if (supabase) {
          void supabase.removeChannel(presenceRealtimeChannel);
        }
      } catch (err) {
        console.warn('[discordStore] Error removing presence channel:', err);
      }
      presenceRealtimeChannel = null;
    }

    if (presenceSweepInterval) {
      clearInterval(presenceSweepInterval);
      presenceSweepInterval = null;
    }

    if (presenceDebounceTimeout) {
      clearTimeout(presenceDebounceTimeout);
      presenceDebounceTimeout = null;
    }
  },

  getServerMembers: (serverId: string): User[] => {
    const state = get();
    const server = state.servers.find((s) => s.id === serverId);
    const curUser = state.currentUser;

    if (!server) {
      return curUser?.id ? [curUser] : [];
    }

    // 1. CapyChat Oficial (official community server)
    if (server.id === 'server-lyc') {
      const authentic = (state.communityMembers || []).filter((u) => !isTestAccount(u)).map((m) =>
        (m.id === curUser?.id || m.id === 'user-me' || m.name === curUser?.name)
          ? { ...m, ...curUser }
          : m
      );
      const hasCurUser = authentic.some((u) => u.id === curUser.id || u.name === curUser.name);
      if (curUser?.id && !hasCurUser) {
        return [curUser, ...authentic];
      }
      return authentic.length > 0 ? authentic : (curUser?.id ? [curUser] : []);
    }

    // 2. Custom or user-created server
    const membersMap = state.serverMembersMap || {};
    const configuredMemberIds = server.memberIds && server.memberIds.length > 0
      ? server.memberIds
      : (membersMap[server.id] && membersMap[server.id].length > 0
          ? membersMap[server.id]
          : (server.ownerId ? [server.ownerId] : (curUser?.id ? [curUser.id] : [])));

    const effectiveMemberIds = new Set<string>(configuredMemberIds);
    if (server.ownerId) {
      effectiveMemberIds.add(server.ownerId);
    }
    if (curUser?.id && (server.ownerId === curUser.id || effectiveMemberIds.has(curUser.id))) {
      effectiveMemberIds.add(curUser.id);
    }

    const pool: User[] = [
      ...(curUser?.id ? [curUser] : []),
      ...(state.communityMembers || []).filter((u) => !isTestAccount(u) && u.id !== curUser?.id),
    ];

    const matched = pool.filter((u) => effectiveMemberIds.has(u.id));
    if (matched.length > 0) {
      return matched.map((m) => (m.id === curUser.id ? curUser : m));
    }

    return curUser?.id ? [curUser] : [];
  },

  addServerMember: (serverId: string, userId: string) => {
    set((state) => {
      const updatedMap = {
        ...state.serverMembersMap,
        [serverId]: Array.from(new Set([...(state.serverMembersMap[serverId] || []), userId])),
      };
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        const newIds = Array.from(new Set([...(s.memberIds || []), userId]));
        return {
          ...s,
          memberIds: newIds,
          memberCount: newIds.length,
        };
      });
      if (isBrowser) {
        try {
          window.localStorage.setItem('lyc_server_members_map', JSON.stringify(updatedMap));
        } catch {}
      }
      saveServersStateToStorage(updatedServers);
      return { serverMembersMap: updatedMap, servers: updatedServers };
    });
  },

  removeServerMember: (serverId: string, userId: string) => {
    set((state) => {
      const updatedMap = {
        ...state.serverMembersMap,
        [serverId]: (state.serverMembersMap[serverId] || []).filter((id) => id !== userId),
      };
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        const newIds = (s.memberIds || []).filter((id) => id !== userId);
        return {
          ...s,
          memberIds: newIds,
          memberCount: newIds.length,
        };
      });
      if (isBrowser) {
        try {
          window.localStorage.setItem('lyc_server_members_map', JSON.stringify(updatedMap));
        } catch {}
      }
      saveServersStateToStorage(updatedServers);
      return { serverMembersMap: updatedMap, servers: updatedServers };
    });
  },

  updateDisplayedBadges: async (badgeIds: string[]) => {
    const cur = get().currentUser;
    const uid = cur.id;

    // Filter to only genuine unlocked badges for security
    const unlocked = getUserUnlockedBadgeIds(cur);
    const validBadges = badgeIds.filter((id) => unlocked.includes(id));

    if (isBrowser) {
      window.localStorage.setItem(`lyc_displayed_badges_${uid}`, JSON.stringify(validBadges));
    }

    set((state) => ({
      currentUser: { ...state.currentUser, displayedBadges: validBadges },
    }));

    if (supabase && uid) {
      try {
        await supabase.auth.updateUser({
          data: { displayed_badges: validBadges },
        });
      } catch (err) {
        console.warn('[discordStore] updateDisplayedBadges error:', err);
      }
    }
  },

  updateCurrentUser: (updates) => {
    Object.assign(currentUser, updates);
    if (mockUsers.length > 0) {
      mockUsers[0] = { ...currentUser };
    }
    if (isBrowser) {
      if (updates.displayName !== undefined) window.localStorage.setItem('lycDisplayName', updates.displayName);
      if (updates.avatar !== undefined) window.localStorage.setItem('lycUserAvatar', updates.avatar);
      if (updates.bannerColor !== undefined) window.localStorage.setItem('lycUserBannerColor', updates.bannerColor);
      if (updates.bannerImage !== undefined) window.localStorage.setItem('lycUserBannerImage', updates.bannerImage || '');
      if (updates.aboutMe !== undefined) window.localStorage.setItem('lycAboutMe', updates.aboutMe);
      if (updates.nameFont !== undefined) window.localStorage.setItem('lyc_nameFont', updates.nameFont || '');
      if (updates.nameEffect !== undefined) window.localStorage.setItem('lyc_nameEffect', updates.nameEffect || '');
      if (updates.nameColor !== undefined) window.localStorage.setItem('lyc_nameColor', updates.nameColor || '');
      if (updates.themePrimaryColor !== undefined) window.localStorage.setItem('lyc_themePrimaryColor', updates.themePrimaryColor || '');
      if (updates.themeSecondaryColor !== undefined) window.localStorage.setItem('lyc_themeSecondaryColor', updates.themeSecondaryColor || '');
    }
    set((state) => ({
      currentUser: { ...state.currentUser, ...updates },
      selectedMemberForPopout:
        state.selectedMemberForPopout &&
        (state.selectedMemberForPopout.id === state.currentUser.id ||
          state.selectedMemberForPopout.id === 'user-me' ||
          state.selectedMemberForPopout.name === state.currentUser.name)
          ? { ...state.selectedMemberForPopout, ...updates }
          : state.selectedMemberForPopout,
      communityMembers: state.communityMembers.map((m) =>
        m.id === state.currentUser.id || m.id === 'user-me' || m.name === state.currentUser.name
          ? { ...m, ...updates }
          : m
      ),
    }));

    if (supabase) {
      void supabase.auth.getSession().then(({ data }) => {
        const uid = data?.session?.user?.id;
        if (!uid) return;
        const dbUpdates: Record<string, unknown> = {};
        if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
        if (updates.name !== undefined) dbUpdates.username = updates.name;
        if (updates.avatar !== undefined) dbUpdates.avatar_url = updates.avatar;
        if (updates.themePrimaryColor !== undefined) {
          dbUpdates.profile_primary_color = updates.themePrimaryColor;
        } else if (updates.bannerColor !== undefined) {
          dbUpdates.profile_primary_color = updates.bannerColor;
        }
        if (updates.themeSecondaryColor !== undefined) dbUpdates.profile_accent_color = updates.themeSecondaryColor;
        if (updates.bannerImage !== undefined) dbUpdates.banner_url = updates.bannerImage;
        if (updates.aboutMe !== undefined) dbUpdates.bio = updates.aboutMe;
        if (updates.customStatus !== undefined) dbUpdates.custom_status = updates.customStatus;
        if (updates.nameFont !== undefined) dbUpdates.name_font = updates.nameFont;
        if (updates.nameEffect !== undefined) dbUpdates.name_effect = updates.nameEffect;
        if (updates.nameColor !== undefined) dbUpdates.name_color = updates.nameColor;
        if (Object.keys(dbUpdates).length > 0) {
          void db().from('profiles').update(dbUpdates).eq('id', uid);
        }
      });
    }
  },

  theme: useThemeStore.getState().theme,
  setTheme: (theme: ThemeMode) => {
    useThemeStore.getState().setTheme(theme);
    set({ theme });
  },

  activeServerId: 'server-lyc',
  activeChannelId: 'ch-geral',
  activeHomeTab: 'friends',
  friendsFilter: 'online',
  activeView: 'chat',
  isMemberListOpen: true,
  selectedMemberForPopout: null,
  popoutPosition: null,
  isSettingsModalOpen: false,
  isUserProfileModalOpen: false,
  userProfileModalTarget: null,
  activeSettingsTab: 'my-account',
  isMicMuted: false,
  isDeafened: false,
  isVideoOn: false,
  isScreenSharing: false,
  folderStates: { 'folder-games': true },
  collapsedCategories: {},
  messages: loadInitialMessages(),

  // Servers, Folders & Rail Order
  servers: loadInitialServers(),
  folders: loadInitialFolders(),
  railOrder: loadInitialRailOrder(loadInitialServers(), loadInitialFolders()),
  isServerSettingsOpen: false,
  serverSettingsTab: 'overview',
  isServerBoostModalOpen: false,
  userBoostsAvailable: isBrowser && window.localStorage.getItem('lycUserBoostsAvailable')
    ? Math.max(0, parseInt(window.localStorage.getItem('lycUserBoostsAvailable')!, 10))
    : 3,
  isCreateChannelOpen: false,
  targetCategoryIdForNewChannel: null,
  isCreateCategoryOpen: false,

  voiceState: {
    isConnected: false,
    pingMs: 0,
    participants: [],
  },
  channelVoiceParticipants: {},
  setChannelVoiceParticipants: (channelVoiceParticipants) => set({ channelVoiceParticipants }),
  focusedParticipantId: null,
  setFocusedParticipantId: (focusedParticipantId) => set({ focusedParticipantId }),

  getServerById: (id: string) => {
    const { servers, folders } = get();
    const fromRoot = servers.find((s) => s.id === id);
    if (fromRoot) return fromRoot;
    for (const f of folders) {
      const fromFolder = f.servers.find((s) => s.id === id);
      if (fromFolder) return fromFolder;
    }
    return undefined;
  },

  setActiveServer: (id) => {
    set((state) => {
      if (id === '@me') {
        return {
          activeServerId: '@me',
          activeChannelId: 'me-friends',
          activeHomeTab: 'friends',
          activeView: 'chat',
        };
      }
      let srv = state.servers.find((s) => s.id === id);
      if (!srv) {
        for (const f of state.folders) {
          const found = f.servers.find((s) => s.id === id);
          if (found) {
            srv = found;
            break;
          }
        }
      }
      const firstChannel = srv?.categories[0]?.channels[0]?.id || 'ch-geral';
      const serverRoles = get().getServerRoles(id);
      return {
        activeServerId: id,
        activeChannelId: firstChannel,
        activeView: 'chat',
        roles: serverRoles,
      };
    });
  },

  setActiveChannel: (channelId) => {
    const { activeServerId, connectToVoice, servers } = get();
    if (activeServerId === '@me') {
      set({ activeChannelId: channelId });
      return;
    }
    const srv = servers.find((s) => s.id === activeServerId);
    let targetChannel: any = null;
    srv?.categories.forEach((cat) => {
      const found = cat.channels.find((c) => c.id === channelId);
      if (found) targetChannel = found;
    });

    if (targetChannel?.type === 'voice') {
      connectToVoice(channelId, targetChannel.name, activeServerId, srv?.name || 'Servidor');
      set({ activeChannelId: channelId, activeView: 'voice-stage' });
    } else {
      set({ activeChannelId: channelId, activeView: 'chat' });
    }
  },

  setActiveHomeTab: (tab) => set({ activeHomeTab: tab, activeChannelId: `me-${tab}` }),

  setFriendsFilter: (filter) => set({ friendsFilter: filter }),

  setActiveView: (view) => set({ activeView: view }),

  toggleMemberList: () => set((state) => ({ isMemberListOpen: !state.isMemberListOpen })),

  openMemberPopout: (user, pos) => {
    const cur = get().currentUser;
    const isSelf = user.id === cur.id || user.id === 'user-me' || user.name === cur.name;
    const target = isSelf ? { ...user, ...cur } : user;
    set({ selectedMemberForPopout: target, popoutPosition: pos });
  },

  closeMemberPopout: () => set({ selectedMemberForPopout: null, popoutPosition: null }),

  openSettingsModal: () => set({ isSettingsModalOpen: true }),

  closeSettingsModal: () => set({ isSettingsModalOpen: false }),

  openUserProfileModal: (user) => {
    const target = user || get().currentUser;
    set({ isUserProfileModalOpen: true, userProfileModalTarget: target });
  },

  closeUserProfileModal: () => set({ isUserProfileModalOpen: false, userProfileModalTarget: null }),

  setActiveSettingsTab: (tab) => set({ activeSettingsTab: tab }),

  openServerSettings: (tab = 'overview') => {
    const state = get();
    const targetServerId = state.activeServerId;
    if (targetServerId === '@me') return;

    const currentServer = state.servers.find((s) => s.id === targetServerId) || state.servers[0];
    if (!currentServer) return;

    const isOwner = Boolean(
      (!state.isAuthenticated && (state.currentUser?.id === 'user-ares' || (state.currentUser?.id === 'user-me' && currentServer.id !== 'server-lyc' && currentServer.ownerId === 'user-me'))) ||
      (state.currentUser?.id && currentServer.ownerId === state.currentUser.id) ||
      (isOfficialCommunity(currentServer) && state.currentUser?.id === 'f8fcd139-cf43-4873-bd7d-a807ecd73567')
    );

    const canManageCommunity = isOwner || state.hasServerPermission('administrator', currentServer.id) || state.hasServerPermission('manageCommunity', currentServer.id);
    const canManageRoles = isOwner || state.hasServerPermission('administrator', currentServer.id) || state.hasServerPermission('manageRoles', currentServer.id);
    const canManageChannels = isOwner || state.hasServerPermission('administrator', currentServer.id) || state.hasServerPermission('manageChannels', currentServer.id);
    const canViewAuditLog = isOwner || state.hasServerPermission('administrator', currentServer.id) || state.hasServerPermission('viewAuditLog', currentServer.id);
    const canModerate = isOwner || state.hasServerPermission('administrator', currentServer.id) || state.hasServerPermission('kickMembers', currentServer.id) || state.hasServerPermission('banMembers', currentServer.id) || state.hasServerPermission('timeoutMembers', currentServer.id);

    const canOpenSettings = isOwner || canManageCommunity || canManageRoles || canManageChannels || canViewAuditLog || canModerate;

    if (!canOpenSettings) {
      console.warn('[discordStore] Permissão negada para abrir configurações do servidor.');
      return;
    }

    let resolvedTab = tab;
    if ((tab === 'overview' || tab === 'server-profile' || tab === 'server-tag' || tab === 'engagement' || tab === 'security' || tab === 'enable-community' || tab === 'server-template') && !canManageCommunity) {
      if (canManageRoles) resolvedTab = 'roles';
      else if (canModerate) resolvedTab = 'members';
      else if (canViewAuditLog) resolvedTab = 'audit-log';
    } else if (tab === 'roles' && !canManageRoles) {
      if (canManageCommunity) resolvedTab = 'server-profile';
      else if (canModerate) resolvedTab = 'members';
      else if (canViewAuditLog) resolvedTab = 'audit-log';
    }

    set({ isServerSettingsOpen: true, serverSettingsTab: resolvedTab });
  },

  closeServerSettings: () => set({ isServerSettingsOpen: false }),

  openServerBoostModal: () => set({ isServerBoostModalOpen: true }),

  closeServerBoostModal: () => set({ isServerBoostModalOpen: false }),

  setUserBoostsAvailable: (count: number) => {
    const safeCount = Math.max(0, count);
    if (isBrowser) window.localStorage.setItem('lycUserBoostsAvailable', String(safeCount));
    set({ userBoostsAvailable: safeCount });
  },

  useBoostOnServer: (serverId: string) => {
    const { userBoostsAvailable } = get();
    if (userBoostsAvailable <= 0) return false;

    const nextBalance = userBoostsAvailable - 1;
    if (isBrowser) window.localStorage.setItem('lycUserBoostsAvailable', String(nextBalance));

    set((state) => {
      const updateServerList = (sList: typeof state.servers) =>
        sList.map((s) => {
          if (s.id !== serverId) return s;
          const newCount = (s.boostCount ?? 0) + 1;
          const newLevel = (newCount >= 14 ? 3 : newCount >= 7 ? 2 : newCount >= 2 ? 1 : 0) as 0 | 1 | 2 | 3;
          return {
            ...s,
            boostCount: newCount,
            boostLevel: newLevel,
          };
        });

      const updatedServers = updateServerList(state.servers);
      const updatedFolders = state.folders.map((f) => ({
        ...f,
        servers: updateServerList(f.servers),
      }));

      if (isBrowser) {
        window.localStorage.setItem('lycServers', JSON.stringify(updatedServers));
        window.localStorage.setItem('lycFolders', JSON.stringify(updatedFolders));
      }

      return {
        userBoostsAvailable: nextBalance,
        servers: updatedServers,
        folders: updatedFolders,
      };
    });

    return true;
  },

  setServerSettingsTab: (tab) => set({ serverSettingsTab: tab }),

  updateServer: (serverId, partial) => {
    if (!get().hasServerPermission('manageCommunity', serverId)) {
      console.warn('[discordStore] Permissão negada: manageCommunity é obrigatório para alterar configurações do servidor.');
      return;
    }
    if (isBrowser) {
      if (partial.icon !== undefined) {
        window.localStorage.setItem(`lyc_server_icon_${serverId}`, partial.icon || '');
      }
      if (partial.bannerImage !== undefined) {
        window.localStorage.setItem(`lyc_server_bannerImage_${serverId}`, partial.bannerImage || '');
      }
      if (partial.bannerColor !== undefined) {
        window.localStorage.setItem(`lyc_server_bannerColor_${serverId}`, partial.bannerColor || '');
      }
    }
    set((state) => ({
      servers: state.servers.map((s) => (s.id === serverId ? { ...s, ...partial } : s)),
    }));
  },

  openCreateChannel: (categoryId) => {
    const activeServerId = get().activeServerId;
    if (!get().hasServerPermission('manageChannels', activeServerId)) {
      console.warn('[discordStore] Permissão negada: manageChannels é obrigatório para criar canais.');
      return;
    }
    set({
      isCreateChannelOpen: true,
      targetCategoryIdForNewChannel: categoryId || null,
    });
  },

  closeCreateChannel: () =>
    set({ isCreateChannelOpen: false, targetCategoryIdForNewChannel: null }),

  addChannel: (serverId, categoryId, channelData) => {
    if (!get().hasServerPermission('manageChannels', serverId)) {
      console.warn('[discordStore] Permissão negada: manageChannels é obrigatório para criar canais.');
      return;
    }
    const newChannel: Channel = {
      id: `ch-${Date.now()}`,
      name: channelData.name.toLowerCase().replace(/\s+/g, '-'),
      type: channelData.type,
      isPrivate: channelData.isPrivate,
    };
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        // If categoryId provided, add to that category, otherwise to first category
        const targetCatId = categoryId || s.categories[0]?.id;
        const updatedCategories = s.categories.map((c) => {
          if (c.id !== targetCatId) return c;
          return {
            ...c,
            channels: [...c.channels, newChannel],
          };
        });
        return { ...s, categories: updatedCategories };
      });
      saveServersStateToStorage(updatedServers);
      return {
        servers: updatedServers,
        isCreateChannelOpen: false,
        activeChannelId: newChannel.id,
        activeView: newChannel.type === 'voice' ? 'voice-stage' : 'chat',
      };
    });

    if (channelData.type === 'voice') {
      const srv = get().servers.find((s) => s.id === serverId);
      get().connectToVoice(newChannel.id, newChannel.name, serverId, srv?.name || 'Servidor');
    }

    const curUser = get().currentUser;
    get().addAuditLogEntry(serverId, {
      user: curUser.displayName || curUser.name,
      avatar: curUser.avatar,
      actionType: 'channel_create',
      action: 'criou o canal',
      target: `#${newChannel.name}`,
      color: '#5865f2',
      details: `Tipo: ${newChannel.type === 'voice' ? 'Canal de Voz' : 'Canal de Texto'}`,
    });
  },

  openCreateCategory: () => {
    const activeServerId = get().activeServerId;
    if (!get().hasServerPermission('manageChannels', activeServerId)) {
      console.warn('[discordStore] Permissão negada: manageChannels é obrigatório para criar categorias.');
      return;
    }
    set({ isCreateCategoryOpen: true });
  },

  closeCreateCategory: () => set({ isCreateCategoryOpen: false }),

  addCategory: (serverId, catData) => {
    if (!get().hasServerPermission('manageChannels', serverId)) {
      console.warn('[discordStore] Permissão negada: manageChannels é obrigatório para criar categorias.');
      return;
    }
    const newCategory: ChannelCategory = {
      id: `cat-${Date.now()}`,
      name: catData.name.toUpperCase().trim(),
      channels: [],
      isPrivate: catData.isPrivate,
    };
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          categories: [...s.categories, newCategory],
        };
      });
      saveServersStateToStorage(updatedServers);
      return {
        servers: updatedServers,
        isCreateCategoryOpen: false,
      };
    });
  },

  toggleFolder: (folderId) =>
    set((state) => ({
      folderStates: {
        ...state.folderStates,
        [folderId]: !state.folderStates[folderId],
      },
    })),

  toggleCategory: (catId) =>
    set((state) => ({
      collapsedCategories: {
        ...state.collapsedCategories,
        [catId]: !state.collapsedCategories[catId],
      },
    })),

  toggleMute: () =>
    set((state) => {
      const nextMuted = !state.isMicMuted;
      playNotificationSound(nextMuted ? 'mute' : 'unmute');
      return { isMicMuted: nextMuted };
    }),

  toggleDeafen: () =>
    set((state) => {
      const nextDeaf = !state.isDeafened;
      playNotificationSound(nextDeaf ? 'deafen' : 'undeafen');
      return {
        isDeafened: nextDeaf,
        isMicMuted: nextDeaf ? true : state.isMicMuted,
      };
    }),

  toggleVideo: () => set((state) => ({ isVideoOn: !state.isVideoOn })),

  toggleScreenShare: () => set((state) => ({ isScreenSharing: !state.isScreenSharing })),

  connectToVoice: (channelId, channelName, serverId, serverName) => {
    void voiceService.joinChannel(channelId, channelName, serverId, serverName);
  },

  disconnectFromVoice: () => {
    void voiceService.leaveChannel(true);
  },

  // Create Server Modal & Creation
  isCreateServerModalOpen: false,
  openCreateServerModal: () => set({ isCreateServerModalOpen: true }),
  closeCreateServerModal: () => set({ isCreateServerModalOpen: false }),

  // Quick Switcher Modal (Ctrl + K)
  isQuickSwitcherOpen: false,
  openQuickSwitcher: () => set({ isQuickSwitcherOpen: true }),
  closeQuickSwitcher: () => set({ isQuickSwitcherOpen: false }),
  toggleQuickSwitcher: () => set((state) => ({ isQuickSwitcherOpen: !state.isQuickSwitcherOpen })),
  addServer: (serverData) => {
    const id = serverData.id || `server-${Date.now()}`;
    const name = serverData.name || 'Novo Servidor';
    const initials = serverData.initials || (name
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .join('')
      .substring(0, 3)
      .toUpperCase() || 'SRV');

    const curUser = get().currentUser;
    const ownerId = serverData.ownerId || curUser.id;
    const memberIds = serverData.memberIds && serverData.memberIds.length > 0
      ? serverData.memberIds
      : [ownerId];

    const newServer: Server = {
      id,
      name,
      initials,
      icon: serverData.icon,
      bannerColor: serverData.bannerColor || '#5865f2',
      bannerImage: serverData.bannerImage,
      description: serverData.description || 'Bem-vindo ao nosso servidor!',
      ownerId,
      memberIds,
      memberCount: memberIds.length,
      communityId: serverData.communityId,
      isCommunity: serverData.isCommunity,
      rulesChannelId: serverData.rulesChannelId,
      publicUpdatesChannelId: serverData.publicUpdatesChannelId,
      categories: serverData.categories || [
        {
          id: `cat-${Date.now()}-1`,
          name: 'CANAIS DE TEXTO',
          channels: [
            { id: `ch-${Date.now()}-geral`, name: 'geral', type: 'text' },
          ],
        },
        {
          id: `cat-${Date.now()}-2`,
          name: 'CANAIS DE VOZ',
          channels: [
            { id: `ch-${Date.now()}-voz`, name: 'Geral [VOZ]', type: 'voice' },
          ],
        },
      ],
    };

    set((state) => {
      const updated = [...state.servers, newServer];
      const updatedMap = {
        ...state.serverMembersMap,
        [id]: memberIds,
      };
      const initialRoles = [defaultEveryoneRole];
      const updatedRolesMap = {
        ...state.serverRolesMap,
        [id]: initialRoles,
      };
      const updatedAuditMap = {
        ...state.auditLogsByServer,
        [id]: [],
      };

      if (isBrowser) {
        try {
          const customOnly = updated.filter((s) => !mockServers.some((ms) => ms.id === s.id));
          window.localStorage.setItem('lyc_custom_servers', JSON.stringify(customOnly));
          window.localStorage.setItem('lyc_server_members_map', JSON.stringify(updatedMap));
          saveServerRolesMapToStorage(updatedRolesMap);
          saveAuditLogsByServerToStorage(updatedAuditMap);
        } catch {}
      }
      saveServersStateToStorage(updated);

      return {
        servers: updated,
        serverMembersMap: updatedMap,
        serverRolesMap: updatedRolesMap,
        auditLogsByServer: updatedAuditMap,
        roles: initialRoles,
        activeServerId: newServer.id,
        activeChannelId: newServer.categories[0].channels[0].id,
        activeView: 'chat',
        isCreateServerModalOpen: false,
      };
    });
  },

  deleteServer: async (serverId: string): Promise<{ success: boolean; error?: string }> => {
    const state = get();
    const targetServer = state.servers.find((s) => s.id === serverId);
    if (!targetServer) {
      return { success: false, error: 'Servidor não encontrado.' };
    }

    // 1. Guard: Official community server is protected
    if (targetServer.id === 'server-lyc' || targetServer.isVerified) {
      return { success: false, error: 'O servidor oficial CapyChat é protegido e não pode ser excluído.' };
    }

    // 2. Guard: Only owner or app admin can delete
    const curUser = state.currentUser;
    const isOwner =
      targetServer.ownerId === curUser?.id ||
      (curUser?.role === 'OWNER' && curUser?.id === 'f8fcd139-cf43-4873-bd7d-a807ecd73567');
    if (!isOwner) {
      return { success: false, error: 'Apenas o proprietário deste servidor tem autorização para excluí-lo.' };
    }

    // 3. Backend community cleanup if UUID
    if (targetServer.communityId) {
      try {
        await communityAction('delete', { community_id: targetServer.communityId });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('proprietário') || (err as Record<string, unknown>)?.code === '42501') {
          return { success: false, error: 'Sem permissão no backend para excluir este servidor.' };
        }
      }
    }

    // 4. Update local state and persistence
    set((state) => {
      const updated = state.servers.filter((s) => s.id !== serverId);
      const updatedFolders = state.folders
        .map((f) => ({
          ...f,
          servers: f.servers.filter((s) => s.id !== serverId),
        }))
        .filter((f) => f.servers.length > 0);
      const updatedRailOrder = state.railOrder.filter((id) => id !== serverId);

      const updatedMembersMap = { ...state.serverMembersMap };
      delete updatedMembersMap[serverId];

      if (isBrowser) {
        try {
          const customOnly = updated.filter((s) => !mockServers.some((ms) => ms.id === s.id));
          window.localStorage.setItem('lyc_custom_servers', JSON.stringify(customOnly));
          window.localStorage.setItem('lyc_server_members_map', JSON.stringify(updatedMembersMap));
          window.localStorage.removeItem(`lyc_server_icon_${serverId}`);
          window.localStorage.removeItem(`lyc_server_bannerImage_${serverId}`);
          window.localStorage.removeItem(`lyc_server_bannerColor_${serverId}`);
        } catch {}
      }

      saveServersStateToStorage(updated);
      saveFoldersStateToStorage(updatedFolders);
      saveRailOrderToStorage(updatedRailOrder);

      let activeServerId = state.activeServerId;
      let activeChannelId = state.activeChannelId;
      if (activeServerId === serverId) {
        const fallbackServer = updated.find((s) => s.id === 'server-lyc') || updated[0];
        activeServerId = fallbackServer?.id || '@me';
        activeChannelId = fallbackServer?.categories[0]?.channels[0]?.id || 'ch-geral';
      }

      return {
        servers: updated,
        folders: updatedFolders,
        railOrder: updatedRailOrder,
        serverMembersMap: updatedMembersMap,
        activeServerId,
        activeChannelId,
        isServerSettingsOpen: false,
      };
    });

    return { success: true };
  },

  enableCommunity: async (serverId: string) => {
    const state = get();
    const server = state.servers.find((s) => s.id === serverId);
    if (!server) {
      return { success: false, error: 'Servidor não encontrado.' };
    }

    // 1. Permission Guard: Only server owner or users with admin permissions
    const curUser = state.currentUser;
    const isOwner = server.ownerId === curUser?.id || curUser?.role === 'OWNER';
    const canModerate = state.canUserModerate(curUser.id, undefined, serverId);
    if (!isOwner && !canModerate.isAdmin) {
      return { success: false, error: 'Apenas o proprietário ou administradores podem habilitar recursos de comunidade.' };
    }

    // 2. Idempotency Check & Channels Identification
    const allChannels: Channel[] = (server.categories || []).flatMap((c) => c.channels || []);
    let rulesChannel = allChannels.find((ch) => ch.name === 'regras' || ch.name === 'regras-e-diretrizes');
    let updatesChannel = allChannels.find((ch) => ch.name === 'avisos' || ch.name === 'anuncios' || ch.name === 'atualizacoes-da-comunidade');

    const createdChannelNames: string[] = [];
    const timestamp = Date.now();

    const updatedCategories = (server.categories && server.categories.length > 0)
      ? server.categories.map((c) => ({ ...c, channels: [...c.channels] }))
      : [
          {
            id: `cat-${timestamp}-default`,
            name: 'INFORMAÇÕES',
            channels: [],
          },
        ];

    // Create #regras if not present
    if (!rulesChannel) {
      const newRulesCh: Channel = {
        id: `ch-${timestamp}-regras`,
        name: 'regras',
        type: 'text',
        topic: 'Regras e diretrizes oficiais da comunidade CapyChat.',
      };
      // Place in first category at top
      updatedCategories[0] = {
        ...updatedCategories[0],
        channels: [newRulesCh, ...(updatedCategories[0].channels || [])],
      };
      rulesChannel = newRulesCh;
      createdChannelNames.push('#regras');
    }

    // Create #avisos if not present
    if (!updatesChannel) {
      const newUpdatesCh: Channel = {
        id: `ch-${timestamp}-avisos`,
        name: 'avisos',
        type: 'announcement',
        topic: 'Anúncios oficiais e comunicados para todos os membros.',
      };
      // Place in first category after regras
      const existingChs = updatedCategories[0].channels || [];
      const rulesIdx = existingChs.findIndex((ch) => ch.id === rulesChannel?.id);
      const insertIdx = rulesIdx !== -1 ? rulesIdx + 1 : 0;
      const updatedChs = [...existingChs];
      updatedChs.splice(insertIdx, 0, newUpdatesCh);
      updatedCategories[0] = {
        ...updatedCategories[0],
        channels: updatedChs,
      };
      updatesChannel = newUpdatesCh;
      createdChannelNames.push('#avisos');
    }

    // 3. Update server state
    const updatedServer: Server = {
      ...server,
      isCommunity: true,
      rulesChannelId: rulesChannel?.id,
      publicUpdatesChannelId: updatesChannel?.id,
      categories: updatedCategories,
    };

    set((s) => {
      const updatedServers = s.servers.map((srv) => (srv.id === serverId ? updatedServer : srv));
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });

    if (isBrowser) {
      try {
        window.localStorage.setItem(`lyc_community_enabled_${serverId}`, 'true');
        window.localStorage.setItem(`lyc_community_rules_ch_${serverId}`, rulesChannel?.id || '');
        window.localStorage.setItem(`lyc_community_updates_ch_${serverId}`, updatesChannel?.id || '');
      } catch {}
    }

    // 4. Supabase DB persistence if connected community
    let remoteSynced = false;
    let remoteStatus: 'synced' | 'schema_missing' | 'permission_denied' | 'network_error' | 'local_only' = 'local_only';
    let remoteError: string | undefined;

    const commId =
      server.communityId ||
      (server.id === 'server-lyc'
        ? 'd3f2173f-79f0-4362-b60a-ad079f724b54'
        : (server.id.length === 36 && server.id.includes('-') && !server.id.startsWith('server-'))
        ? server.id
        : null);

    if (commId) {
      try {
        const { error: commUpdateErr } = await db().from('communities').update({
          is_community: true,
          rules_channel_id: rulesChannel?.id?.includes('-') && rulesChannel.id.length === 36 ? rulesChannel.id : null,
          public_updates_channel_id: updatesChannel?.id?.includes('-') && updatesChannel.id.length === 36 ? updatesChannel.id : null,
        }).eq('id', commId);

        if (!commUpdateErr) {
          remoteSynced = true;
          remoteStatus = 'synced';
        } else {
          remoteSynced = false;
          if (commUpdateErr.code === '42703' || commUpdateErr.code === 'PGRST204') {
            remoteStatus = 'schema_missing';
            remoteError = 'Coluna is_community ausente no Supabase remoto (migração pendente).';
          } else if (commUpdateErr.code === '42501') {
            remoteStatus = 'permission_denied';
            remoteError = 'Permissão negada pelo RLS no Supabase Cloud.';
          } else {
            remoteStatus = 'network_error';
            remoteError = commUpdateErr.message;
          }
        }
      } catch (err: any) {
        remoteSynced = false;
        remoteStatus = 'network_error';
        remoteError = err?.message || 'Falha de conexão com o Supabase.';
      }
    }

    // 5. Audit Log registration
    get().addAuditLogEntry(serverId, {
      user: curUser.displayName || curUser.name,
      avatar: curUser.avatar,
      actionType: 'community_update',
      action: 'habilitou os recursos de Comunidade Oficial',
      target: server.name,
      color: '#5865f2',
      details: createdChannelNames.length > 0
        ? `Canais automáticos criados: ${createdChannelNames.join(', ')}`
        : 'Canais vinculados aos existentes.',
    });

    return {
      success: true,
      remoteSynced,
      remoteStatus,
      remoteError,
      createdChannels: createdChannelNames,
    };
  },

  disableCommunity: async (serverId: string) => {
    const state = get();
    const server = state.servers.find((s) => s.id === serverId);
    if (!server) return { success: false, error: 'Servidor não encontrado.' };

    const curUser = state.currentUser;
    const isOwner = server.ownerId === curUser?.id || curUser?.role === 'OWNER';
    const canModerate = state.canUserModerate(curUser.id, undefined, serverId);
    if (!isOwner && !canModerate.isAdmin) {
      return { success: false, error: 'Apenas o proprietário ou administradores podem desabilitar a comunidade.' };
    }

    const updatedServer: Server = {
      ...server,
      isCommunity: false,
    };

    set((s) => {
      const updatedServers = s.servers.map((srv) => (srv.id === serverId ? updatedServer : srv));
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });

    if (isBrowser) {
      try {
        window.localStorage.setItem(`lyc_community_enabled_${serverId}`, 'false');
      } catch {}
    }

    const commId =
      server.communityId ||
      (server.id === 'server-lyc'
        ? 'd3f2173f-79f0-4362-b60a-ad079f724b54'
        : (server.id.length === 36 && server.id.includes('-') && !server.id.startsWith('server-'))
        ? server.id
        : null);

    if (commId) {
      try {
        await db().from('communities').update({ is_community: false }).eq('id', commId);
      } catch {}
    }

    get().addAuditLogEntry(serverId, {
      user: curUser.displayName || curUser.name,
      avatar: curUser.avatar,
      actionType: 'community_update',
      action: 'desativou os recursos de Comunidade Oficial',
      target: server.name,
      color: '#f23f43',
    });

    return { success: true };
  },

  createCommunityServer: async (serverName: string, icon?: string) => {
    const trimmed = serverName.trim();
    if (!trimmed) {
      return { success: false, error: 'O nome do servidor é obrigatório.' };
    }
    const state = get();
    const curUser = state.currentUser;
    if (!curUser || !curUser.id) {
      return { success: false, error: 'Você precisa estar autenticado para criar um servidor.' };
    }

    if (supabase && state.isAuthenticated) {
      try {
        const commId = await communityAction<string>('create', {
          name: trimmed,
          image_url: icon || null,
        });

        if (commId) {
          try {
            const { data: cats } = await db()
              .from('channel_categories')
              .select('id')
              .eq('community_id', commId)
              .limit(1);

            const catId = cats?.[0]?.id;
            if (catId) {
              await communityAction('create_channel', {
                community_id: commId,
                category_id: catId,
                name: 'geral',
                kind: 'text',
                description: 'Bate-papo geral da comunidade',
              });
              await communityAction('create_channel', {
                community_id: commId,
                category_id: catId,
                name: 'Geral [Voz]',
                kind: 'voice',
              });
            }
          } catch (chErr) {
            console.warn('[discordStore] Error creating initial channels:', chErr);
          }

          const joinRes = await get().joinCommunityServer(commId);
          if (joinRes.success) {
            get().setActiveServer(commId);
            return { success: true, serverId: commId };
          }
        }
      } catch (err: any) {
        console.error('[discordStore] createCommunityServer remote error:', err);
        return { success: false, error: err?.message || 'Erro ao criar servidor no Supabase.' };
      }
    }

    // Local / Offline fallback
    const initials = trimmed
      .split(' ')
      .map((w) => w[0])
      .slice(0, 3)
      .join('')
      .toUpperCase();
    const newServerId = `server-${Date.now()}`;

    state.addServer({
      id: newServerId,
      name: trimmed,
      initials: initials || 'SRV',
      icon: icon || undefined,
      bannerColor: 'blurple-purple',
      bannerImage: null,
      description: `Comunidade criada por ${curUser.displayName || curUser.name}`,
      ownerId: curUser.id,
      memberIds: [curUser.id],
      memberCount: 1,
      categories: [
        {
          id: `cat-${Date.now()}-1`,
          name: 'CANAIS DE TEXTO',
          channels: [
            { id: `ch-${Date.now()}-general`, name: 'geral', type: 'text', topic: 'Bate-papo geral do servidor.' },
          ],
        },
        {
          id: `cat-${Date.now()}-2`,
          name: 'CANAIS DE VOZ',
          channels: [
            { id: `ch-${Date.now()}-voice`, name: 'Geral [Voz]', type: 'voice' },
          ],
        },
      ],
    });

    state.setActiveServer(newServerId);
    return { success: true, serverId: newServerId };
  },

  createServerFromTemplate: async (template: ServerTemplateData, serverName: string, icon?: string) => {
    const state = get();
    const curUser = state.currentUser;
    if (!curUser || !curUser.id) {
      return { success: false, error: 'Você precisa estar autenticado para criar um servidor.' };
    }

    if (supabase && state.isAuthenticated) {
      try {
        const commId = await communityAction<string>('create', {
          name: serverName.trim(),
          image_url: icon || null,
        });

        if (commId) {
          if (template.categories && template.categories.length > 0) {
            for (const cat of template.categories) {
              try {
                const catRes = await communityAction<string>('create_category', {
                  community_id: commId,
                  name: cat.name,
                });
                const catId = typeof catRes === 'string' ? catRes : (catRes as any)?.id;
                if (catId && cat.channels) {
                  for (const ch of cat.channels) {
                    await communityAction('create_channel', {
                      community_id: commId,
                      category_id: catId,
                      name: ch.name,
                      kind: ch.type === 'voice' ? 'voice' : 'text',
                      description: ch.topic || '',
                    });
                  }
                }
              } catch (catErr) {
                console.warn('[discordStore] Error creating template category:', catErr);
              }
            }
          }

          const joinRes = await get().joinCommunityServer(commId);
          if (joinRes.success) {
            get().setActiveServer(commId);
            return { success: true, serverId: commId };
          }
        }
      } catch (err: any) {
        console.error('[discordStore] createServerFromTemplate remote error:', err);
        return { success: false, error: err?.message || 'Erro ao criar comunidade a partir do modelo.' };
      }
    }

    const { serverData, customRoles } = buildServerFromTemplate(
      template,
      serverName,
      curUser.id,
      icon
    );

    // Call addServer to register server and default @everyone role
    state.addServer(serverData);

    // Now append customRoles into serverRolesMap
    const newServerId = serverData.id!;
    set((s) => {
      const existingRoles = s.serverRolesMap[newServerId] || [defaultEveryoneRole];
      const mergedRoles = [...existingRoles, ...customRoles];
      const updatedRolesMap = {
        ...s.serverRolesMap,
        [newServerId]: mergedRoles,
      };
      saveServerRolesMapToStorage(updatedRolesMap);
      return {
        serverRolesMap: updatedRolesMap,
        roles: mergedRoles,
      };
    });

    return {
      success: true,
      serverId: newServerId,
    };
  },

  joinCommunityServer: async (communityId: string) => {
    const state = get();
    // 1. Check if already in servers list
    const existing = state.servers.find(
      (s) => s.id === communityId || s.communityId === communityId
    );
    if (existing) {
      get().setActiveServer(existing.id);
      return { success: true, server: existing };
    }

    // 2. Fetch community from Supabase Cloud
    if (!supabase) {
      return { success: false, error: 'Supabase não inicializado.' };
    }

    try {
      const { data: comm, error: commErr } = await db()
        .from('communities')
        .select('*')
        .eq('id', communityId)
        .single();

      if (commErr || !comm) {
        return { success: false, error: 'Comunidade não encontrada no servidor.' };
      }

      // 3. Fetch categories and channels
      const [catRes, chRes] = await Promise.all([
        db()
          .from('channel_categories')
          .select('*')
          .eq('community_id', communityId)
          .is('deleted_at', null)
          .order('position'),
        db()
          .from('channels')
          .select('*')
          .eq('community_id', communityId)
          .is('deleted_at', null)
          .order('position'),
      ]);

      const rawCategories = catRes.data || [];
      const rawChannels = chRes.data || [];

      let categories: ChannelCategory[] = [];
      if (rawCategories.length > 0) {
        categories = rawCategories.map((c: any) => ({
          id: c.id,
          name: c.name,
          channels: rawChannels
            .filter((ch: any) => ch.category_id === c.id)
            .map((ch: any) => ({
              id: ch.id,
              name: ch.name,
              type: (ch.kind === 'voice' ? 'voice' : 'text') as ChannelType,
              topic: ch.description || '',
              isPrivate: Boolean(ch.is_private),
            })),
        }));
      } else {
        categories = [
          {
            id: `cat-${communityId}-default`,
            name: 'CANAIS DE TEXTO',
            channels: rawChannels.length > 0
              ? rawChannels.map((ch: any) => ({
                  id: ch.id,
                  name: ch.name,
                  type: (ch.kind === 'voice' ? 'voice' : 'text') as ChannelType,
                  topic: ch.description || '',
                  isPrivate: Boolean(ch.is_private),
                }))
              : [{ id: `ch-${communityId}-geral`, name: 'geral', type: 'text' as ChannelType }],
          },
        ];
      }

      const curUser = state.currentUser;
      const newServer: Server = {
        id: comm.id,
        communityId: comm.id,
        name: comm.name,
        initials: (comm.name || 'SRV').slice(0, 3).toUpperCase(),
        icon: comm.image_url || undefined,
        ownerId: comm.owner_id,
        memberIds: [curUser.id],
        isVerified: Boolean(comm.is_official),
        isCommunity: Boolean(comm.is_community),
        categories,
        boostCount: 0,
        boostLevel: 0,
        memberCount: 1,
        onlineCount: 1,
      };

      set((s) => {
        const next = [...s.servers, newServer];
        saveServersStateToStorage(next);
        return {
          servers: next,
          activeServerId: newServer.id,
          activeChannelId: newServer.categories[0]?.channels[0]?.id || 'ch-geral',
          activeView: 'chat',
        };
      });

      // Background sync members and presence for the new server
      void get().fetchCommunityMembers(communityId);
      get().startPresenceTracking(communityId);

      return { success: true, server: newServer };
    } catch (err: any) {
      console.error('[discordStore] joinCommunityServer exception:', err);
      return { success: false, error: err?.message || 'Erro ao carregar servidor.' };
    }
  },

  leaveServer: async (serverId) => {
    const state = get();
    const targetServer = state.servers.find((s) => s.id === serverId);
    if (!targetServer) {
      return { success: false, error: 'Servidor não encontrado.' };
    }

    // 1. Owner guard:
    const isOwner =
      targetServer.ownerId === state.currentUser?.id ||
      (targetServer.id === 'server-lyc' &&
        (state.currentUser?.role === 'OWNER' || state.currentUser?.id === 'f8fcd139-cf43-4873-bd7d-a807ecd73567'));
    if (isOwner) {
      return {
        success: false,
        error: 'O proprietário precisa transferir a posse do servidor antes de sair.',
      };
    }

    // 2. Real backend leave if connected to Supabase:
    if (supabase && state.currentUser?.id) {
      try {
        const commId =
          targetServer.communityId ||
          (targetServer.id === 'server-lyc'
            ? 'd3f2173f-79f0-4362-b60a-ad079f724b54'
            : targetServer.id.startsWith('server-')
            ? null
            : targetServer.id);

        if (commId) {
          await communityAction('leave', { community_id: commId });
        }
      } catch (err: any) {
        console.warn('[discordStore] leaveServer error from Supabase:', err);
        const msg = err?.message || '';
        if (msg.includes('proprietário precisa transferir')) {
          return {
            success: false,
            error: 'O proprietário precisa transferir a posse da comunidade antes de sair.',
          };
        }
        if (msg.includes('Permission denied') || msg.includes('42501')) {
          return {
            success: false,
            error: 'Permissão negada para sair deste servidor.',
          };
        }
      }
    }

    // 3. Mark in lyc_left_servers so loadInitialServers won't re-inject it
    if (isBrowser) {
      try {
        const leftServers: string[] = JSON.parse(
          window.localStorage.getItem('lyc_left_servers') || '[]'
        );
        if (!leftServers.includes(serverId)) {
          leftServers.push(serverId);
          window.localStorage.setItem('lyc_left_servers', JSON.stringify(leftServers));
        }
      } catch {}
    }

    // 4. Update local state
    const updated = state.servers.filter((s) => s.id !== serverId);
    const updatedFolders = state.folders
      .map((f) => ({
        ...f,
        servers: f.servers.filter((s) => s.id !== serverId),
      }))
      .filter((f) => f.servers.length > 0);
    const updatedRailOrder = state.railOrder.filter((id) => id !== serverId);

    saveServersStateToStorage(updated);
    saveFoldersStateToStorage(updatedFolders);
    saveRailOrderToStorage(updatedRailOrder);

    let activeServerId = state.activeServerId;
    let activeChannelId = state.activeChannelId;
    let activeView = state.activeView;
    let activeHomeTab = state.activeHomeTab;

    if (activeServerId === serverId) {
      if (updated.length > 0) {
        activeServerId = updated[0].id;
        activeChannelId = updated[0].categories[0]?.channels[0]?.id || 'ch-geral';
        activeView = 'chat';
      } else {
        activeServerId = '@me';
        activeChannelId = 'me-friends';
        activeHomeTab = 'friends';
        activeView = 'chat';
      }
    }

    set({
      servers: updated,
      folders: updatedFolders,
      railOrder: updatedRailOrder,
      activeServerId,
      activeChannelId,
      activeView,
      activeHomeTab,
    });

    return { success: true };
  },

  reorderServers: (serverId, direction) => {
    set((state) => {
      const idx = state.servers.findIndex((s) => s.id === serverId);
      if (idx === -1) return state;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= state.servers.length) return state;
      const nextServers = [...state.servers];
      const temp = nextServers[idx];
      nextServers[idx] = nextServers[targetIdx];
      nextServers[targetIdx] = temp;
      saveServersStateToStorage(nextServers);
      return { servers: nextServers };
    });
  },

  moveServer: (sourceServerId, targetServerId, position = 'above') => {
    set((state) => {
      if (sourceServerId === targetServerId) return state;
      const sourceIdx = state.servers.findIndex((s) => s.id === sourceServerId);
      const targetIdx = state.servers.findIndex((s) => s.id === targetServerId);
      if (sourceIdx === -1 || targetIdx === -1) return state;

      const nextServers = [...state.servers];
      const [moved] = nextServers.splice(sourceIdx, 1);

      let newTargetIdx = nextServers.findIndex((s) => s.id === targetServerId);
      if (position === 'below') {
        newTargetIdx += 1;
      }
      nextServers.splice(newTargetIdx, 0, moved);
      saveServersStateToStorage(nextServers);
      return { servers: nextServers };
    });
  },

  createFolder: (sourceServerId, targetServerId, folderName = 'Pasta de Servidores') => {
    set((state) => {
      if (sourceServerId === targetServerId) return state;

      let sourceServer = state.servers.find((s) => s.id === sourceServerId);
      let targetServer = state.servers.find((s) => s.id === targetServerId);

      let updatedFolders = state.folders.map((f) => ({
        ...f,
        servers: [...f.servers],
      }));

      if (!sourceServer) {
        for (const f of updatedFolders) {
          const found = f.servers.find((s) => s.id === sourceServerId);
          if (found) {
            sourceServer = found;
            f.servers = f.servers.filter((s) => s.id !== sourceServerId);
            break;
          }
        }
      }

      if (!targetServer) {
        for (const f of updatedFolders) {
          const found = f.servers.find((s) => s.id === targetServerId);
          if (found) {
            targetServer = found;
            f.servers = f.servers.filter((s) => s.id !== targetServerId);
            break;
          }
        }
      }

      if (!sourceServer || !targetServer) return state;

      const newFolderId = `folder-${Date.now()}`;
      const newFolder: ServerFolder = {
        id: newFolderId,
        name: folderName,
        color: '#5865f2',
        isOpen: true,
        servers: [targetServer, sourceServer],
      };

      updatedFolders = updatedFolders.filter((f) => f.servers.length > 0);
      updatedFolders.push(newFolder);

      const nextServers = state.servers.filter(
        (s) => s.id !== sourceServerId && s.id !== targetServerId
      );

      let nextRailOrder = [...state.railOrder];
      const targetIdx = nextRailOrder.indexOf(targetServerId);
      nextRailOrder = nextRailOrder.filter(
        (id) => id !== sourceServerId && id !== targetServerId
      );
      if (targetIdx !== -1) {
        nextRailOrder.splice(targetIdx, 0, newFolderId);
      } else {
        nextRailOrder.push(newFolderId);
      }

      saveServersStateToStorage(nextServers);
      saveFoldersStateToStorage(updatedFolders);
      saveRailOrderToStorage(nextRailOrder);

      return {
        servers: nextServers,
        folders: updatedFolders,
        railOrder: nextRailOrder,
        folderStates: {
          ...state.folderStates,
          [newFolderId]: true,
        },
      };
    });
  },

  addServerToFolder: (folderId, serverId) => {
    set((state) => {
      let serverToAdd = state.servers.find((s) => s.id === serverId);
      let updatedFolders = state.folders.map((f) => ({
        ...f,
        servers: [...f.servers],
      }));

      if (!serverToAdd) {
        for (const f of updatedFolders) {
          const found = f.servers.find((s) => s.id === serverId);
          if (found) {
            serverToAdd = found;
            f.servers = f.servers.filter((s) => s.id !== serverId);
            break;
          }
        }
      }
      if (!serverToAdd) return state;

      const targetFolder = updatedFolders.find((f) => f.id === folderId);
      if (!targetFolder) return state;

      if (!targetFolder.servers.some((s) => s.id === serverId)) {
        targetFolder.servers.push(serverToAdd);
      }

      updatedFolders = updatedFolders.filter((f) => f.servers.length > 0);
      const nextServers = state.servers.filter((s) => s.id !== serverId);
      const nextRailOrder = state.railOrder.filter((id) => id !== serverId);

      saveServersStateToStorage(nextServers);
      saveFoldersStateToStorage(updatedFolders);
      saveRailOrderToStorage(nextRailOrder);

      return {
        servers: nextServers,
        folders: updatedFolders,
        railOrder: nextRailOrder,
        folderStates: {
          ...state.folderStates,
          [folderId]: true,
        },
      };
    });
  },

  removeServerFromFolder: (folderId, serverId, targetIndex) => {
    set((state) => {
      const folder = state.folders.find((f) => f.id === folderId);
      if (!folder) return state;
      const serverToRemove = folder.servers.find((s) => s.id === serverId);
      if (!serverToRemove) return state;

      let remainingServers = folder.servers.filter((s) => s.id !== serverId);
      let updatedFolders = state.folders.map((f) =>
        f.id === folderId ? { ...f, servers: remainingServers } : f
      );

      let nextServers = [...state.servers];
      let nextRailOrder = [...state.railOrder];

      if (remainingServers.length === 1) {
        const lastServer = remainingServers[0];
        updatedFolders = updatedFolders.filter((f) => f.id !== folderId);
        nextServers.push(lastServer);
        const folderIdx = nextRailOrder.indexOf(folderId);
        if (folderIdx !== -1) {
          nextRailOrder.splice(folderIdx, 1, lastServer.id);
        } else {
          nextRailOrder.push(lastServer.id);
        }
      } else if (remainingServers.length === 0) {
        updatedFolders = updatedFolders.filter((f) => f.id !== folderId);
        nextRailOrder = nextRailOrder.filter((id) => id !== folderId);
      }

      if (
        typeof targetIndex === 'number' &&
        targetIndex >= 0 &&
        targetIndex <= nextServers.length
      ) {
        nextServers.splice(targetIndex, 0, serverToRemove);
        nextRailOrder.splice(targetIndex, 0, serverToRemove.id);
      } else {
        nextServers.push(serverToRemove);
        nextRailOrder.push(serverToRemove.id);
      }

      saveServersStateToStorage(nextServers);
      saveFoldersStateToStorage(updatedFolders);
      saveRailOrderToStorage(nextRailOrder);

      return {
        servers: nextServers,
        folders: updatedFolders,
        railOrder: nextRailOrder,
      };
    });
  },

  deleteFolder: (folderId) => {
    set((state) => {
      const folder = state.folders.find((f) => f.id === folderId);
      if (!folder) return state;

      const nextServers = [...state.servers, ...folder.servers];
      const updatedFolders = state.folders.filter((f) => f.id !== folderId);
      const folderIdx = state.railOrder.indexOf(folderId);
      let nextRailOrder = state.railOrder.filter((id) => id !== folderId);
      if (folderIdx !== -1) {
        nextRailOrder.splice(folderIdx, 0, ...folder.servers.map((s) => s.id));
      } else {
        nextRailOrder.push(...folder.servers.map((s) => s.id));
      }

      saveServersStateToStorage(nextServers);
      saveFoldersStateToStorage(updatedFolders);
      saveRailOrderToStorage(nextRailOrder);

      return {
        servers: nextServers,
        folders: updatedFolders,
        railOrder: nextRailOrder,
      };
    });
  },

  moveRailItem: (sourceId, targetId, position = 'above') => {
    set((state) => {
      if (sourceId === targetId) return state;
      const currentOrder = [...state.railOrder];
      if (!currentOrder.includes(sourceId)) currentOrder.push(sourceId);
      if (!currentOrder.includes(targetId)) currentOrder.push(targetId);

      const sourceIdx = currentOrder.indexOf(sourceId);
      if (sourceIdx === -1) return state;
      const [moved] = currentOrder.splice(sourceIdx, 1);

      let targetIdx = currentOrder.indexOf(targetId);
      if (position === 'below') {
        targetIdx += 1;
      }
      currentOrder.splice(targetIdx, 0, moved);

      const nextServers = [...state.servers];
      const srvSrcIdx = nextServers.findIndex((s) => s.id === sourceId);
      const srvTgtIdx = nextServers.findIndex((s) => s.id === targetId);
      if (srvSrcIdx !== -1 && srvTgtIdx !== -1) {
        const [sMoved] = nextServers.splice(srvSrcIdx, 1);
        let sTarget = nextServers.findIndex((s) => s.id === targetId);
        if (position === 'below') sTarget += 1;
        nextServers.splice(sTarget, 0, sMoved);
        saveServersStateToStorage(nextServers);
      }

      saveRailOrderToStorage(currentOrder);
      return {
        railOrder: currentOrder,
        servers: nextServers,
      };
    });
  },

  markServerAsRead: (serverId) => {
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          unreadBadge: 0,
          mentionCount: 0,
          categories: s.categories.map((c) => ({
            ...c,
            channels: c.channels.map((ch) => ({
              ...ch,
              unread: false,
              mentionCount: 0,
            })),
          })),
        };
      });
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });
  },

  toggleMuteServer: (serverId) => {
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          isMuted: !s.isMuted,
        };
      });
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });
  },

  reorderChannels: (serverId, categoryId, channelId, direction) => {
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        const updatedCats = s.categories.map((c) => {
          if (c.id !== categoryId) return c;
          const idx = c.channels.findIndex((ch) => ch.id === channelId);
          if (idx === -1) return c;
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= c.channels.length) return c;
          const nextChannels = [...c.channels];
          const temp = nextChannels[idx];
          nextChannels[idx] = nextChannels[targetIdx];
          nextChannels[targetIdx] = temp;
          return { ...c, channels: nextChannels };
        });
        return { ...s, categories: updatedCats };
      });
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });
  },

  reorderCategories: (serverId, categoryId, direction) => {
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        const idx = s.categories.findIndex((c) => c.id === categoryId);
        if (idx === -1) return s;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= s.categories.length) return s;
        const nextCats = [...s.categories];
        const temp = nextCats[idx];
        nextCats[idx] = nextCats[targetIdx];
        nextCats[targetIdx] = temp;
        return { ...s, categories: nextCats };
      });
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });
  },

  moveChannel: (serverId, sourceCategoryId, targetCategoryId, channelId, targetIndex) => {
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;

        let movedChannel: Channel | null = null;
        let sourceIndex = -1;

        const intermediateCats = s.categories.map((c) => {
          if (c.id !== sourceCategoryId) return c;
          const foundIdx = c.channels.findIndex((ch) => ch.id === channelId);
          if (foundIdx !== -1) {
            movedChannel = c.channels[foundIdx];
            sourceIndex = foundIdx;
          }
          return {
            ...c,
            channels: c.channels.filter((ch) => ch.id !== channelId),
          };
        });

        if (!movedChannel) return s;

        const finalCats = intermediateCats.map((c) => {
          if (c.id !== targetCategoryId) return c;
          const nextChannels = [...c.channels];
          const clamped = Math.max(0, Math.min(targetIndex, nextChannels.length + 1));
          const finalIdx =
            sourceCategoryId === targetCategoryId && sourceIndex !== -1 && sourceIndex < clamped
              ? Math.max(0, clamped - 1)
              : Math.min(clamped, nextChannels.length);

          nextChannels.splice(finalIdx, 0, movedChannel!);
          return {
            ...c,
            channels: nextChannels,
          };
        });

        return {
          ...s,
          categories: finalCats,
        };
      });

      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });
  },

  moveCategory: (serverId, categoryId, targetIndex) => {
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        const sourceIdx = s.categories.findIndex((c) => c.id === categoryId);
        if (sourceIdx === -1) return s;
        const cat = s.categories[sourceIdx];
        const nextCats = s.categories.filter((c) => c.id !== categoryId);
        const clamped = Math.max(0, Math.min(targetIndex, s.categories.length));
        const finalIdx = sourceIdx < clamped ? Math.max(0, clamped - 1) : Math.min(clamped, nextCats.length);
        nextCats.splice(finalIdx, 0, cat);
        return {
          ...s,
          categories: nextCats,
        };
      });

      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });
  },

  editChannel: (serverId, categoryId, channelId, updates) => {
    if (!get().hasServerPermission('manageChannels', serverId)) {
      console.warn('[discordStore] Permissão negada: manageChannels é obrigatório para editar canais.');
      return;
    }
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          categories: s.categories.map((c) => {
            if (c.id !== categoryId) return c;
            return {
              ...c,
              channels: c.channels.map((ch) =>
                ch.id === channelId ? { ...ch, ...updates } : ch
              ),
            };
          }),
        };
      });
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });
  },

  deleteChannel: (serverId, categoryId, channelId) => {
    if (!get().hasServerPermission('manageChannels', serverId)) {
      console.warn('[discordStore] Permissão negada: manageChannels é obrigatório para excluir canais.');
      return;
    }
    const curUser = get().currentUser;
    const targetServer = get().servers.find(s => s.id === serverId);
    let chName = channelId;
    targetServer?.categories.forEach(c => {
      const found = c.channels.find(ch => ch.id === channelId);
      if (found) chName = found.name;
    });

    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          categories: s.categories.map((c) => {
            if (c.id !== categoryId) return c;
            return {
              ...c,
              channels: c.channels.filter((ch) => ch.id !== channelId),
            };
          }),
        };
      });
      const activeChannelId =
        state.activeChannelId === channelId
          ? updatedServers.find((s) => s.id === serverId)?.categories[0]?.channels[0]?.id || 'ch-geral'
          : state.activeChannelId;
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers, activeChannelId };
    });

    get().addAuditLogEntry(serverId, {
      user: curUser.displayName || curUser.name,
      avatar: curUser.avatar,
      actionType: 'channel_delete',
      action: 'excluiu o canal',
      target: `#${chName}`,
      color: '#f23f43',
    });
  },

  duplicateChannel: (serverId, categoryId, channelId) => {
    if (!get().hasServerPermission('manageChannels', serverId)) {
      console.warn('[discordStore] Permissão negada: manageChannels é obrigatório para duplicar canais.');
      return;
    }
    set((state) => {
      let duplicatedId = '';
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          categories: s.categories.map((c) => {
            if (c.id !== categoryId) return c;
            const targetChannel = c.channels.find((ch) => ch.id === channelId);
            if (!targetChannel) return c;
            duplicatedId = `ch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const clonedChannel: Channel = {
              ...targetChannel,
              id: duplicatedId,
              name: `${targetChannel.name}-cópia`,
              unread: false,
              mentionCount: 0,
            };
            const idx = c.channels.findIndex((ch) => ch.id === channelId);
            const nextChannels = [...c.channels];
            nextChannels.splice(idx + 1, 0, clonedChannel);
            return {
              ...c,
              channels: nextChannels,
            };
          }),
        };
      });
      saveServersStateToStorage(updatedServers);
      return {
        servers: updatedServers,
        activeChannelId: duplicatedId || state.activeChannelId,
      };
    });
  },

  markChannelAsRead: (serverId, categoryId, channelId) => {
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          categories: s.categories.map((c) => {
            if (c.id !== categoryId) return c;
            return {
              ...c,
              channels: c.channels.map((ch) =>
                ch.id === channelId ? { ...ch, unread: false, mentionCount: 0 } : ch
              ),
            };
          }),
        };
      });
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });
  },

  markCategoryAsRead: (serverId, categoryId) => {
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          categories: s.categories.map((c) => {
            if (c.id !== categoryId) return c;
            return {
              ...c,
              channels: c.channels.map((ch) => ({ ...ch, unread: false, mentionCount: 0 })),
            };
          }),
        };
      });
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });
  },

  toggleMuteChannel: (serverId, categoryId, channelId) => {
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          categories: s.categories.map((c) => {
            if (c.id !== categoryId) return c;
            return {
              ...c,
              channels: c.channels.map((ch) =>
                ch.id === channelId ? { ...ch, isMuted: !ch.isMuted } : ch
              ),
            };
          }),
        };
      });
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });
  },

  toggleMuteCategory: (serverId, categoryId) => {
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          categories: s.categories.map((c) =>
            c.id === categoryId ? { ...c, isMuted: !c.isMuted } : c
          ),
        };
      });
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });
  },

  editCategory: (serverId, categoryId, updates) => {
    if (!get().hasServerPermission('manageChannels', serverId)) {
      console.warn('[discordStore] Permissão negada: manageChannels é obrigatório para editar categorias.');
      return;
    }
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          categories: s.categories.map((c) =>
            c.id === categoryId ? { ...c, ...updates } : c
          ),
        };
      });
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers };
    });
  },

  deleteCategory: (serverId, categoryId) => {
    if (!get().hasServerPermission('manageChannels', serverId)) {
      console.warn('[discordStore] Permissão negada: manageChannels é obrigatório para excluir categorias.');
      return;
    }
    set((state) => {
      const updatedServers = state.servers.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          categories: s.categories.filter((c) => c.id !== categoryId),
        };
      });
      // If current active channel was in deleted category, fall back to first remaining channel
      let activeChannelId = state.activeChannelId;
      const targetServer = updatedServers.find((s) => s.id === serverId);
      const channelStillExists = targetServer?.categories.some((cat) =>
        cat.channels.some((ch) => ch.id === activeChannelId)
      );
      if (!channelStillExists && targetServer && targetServer.categories.length > 0) {
        activeChannelId = targetServer.categories[0].channels[0]?.id || 'ch-geral';
      }
      saveServersStateToStorage(updatedServers);
      return { servers: updatedServers, activeChannelId };
    });
  },

  sendMessage: (channelId, content, attachments, replyTo) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;
    const now = new Date();
    const timeString = `Hoje às ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      channelId,
      author: get().currentUser,
      content,
      timestamp: timeString,
      attachments,
      replyTo,
    };

    set((state) => {
      const current = state.messages[channelId] || [];
      const updated = {
        ...state.messages,
        [channelId]: [...current, newMsg],
      };
      saveMessagesToStorage(updated);
      return { messages: updated };
    });

    // Native Windows Notification if mentioned or in DM
    if (typeof window !== 'undefined' && window.arena?.notify) {
      if (content.includes('@') || channelId.startsWith('dm-')) {
        window.arena.notify(
          get().currentUser.displayName || get().currentUser.name,
          content.length > 80 ? content.slice(0, 77) + '...' : content,
          {
            type: channelId.startsWith('dm-') ? 'dm' : 'mention',
            channelId,
          }
        );
      }
    }
  },

  editMessage: (channelId, messageId, newContent) => {
    set((state) => {
      const list = state.messages[channelId] || [];
      const updated = {
        ...state.messages,
        [channelId]: list.map((m) =>
          m.id === messageId ? { ...m, content: newContent, isEdited: true } : m
        ),
      };
      saveMessagesToStorage(updated);
      return { messages: updated };
    });
  },

  deleteMessage: (channelId, messageId) => {
    set((state) => {
      const list = state.messages[channelId] || [];
      const updated = {
        ...state.messages,
        [channelId]: list.filter((m) => m.id !== messageId),
      };
      saveMessagesToStorage(updated);
      return { messages: updated };
    });
  },

  pinMessage: (channelId, messageId) => {
    set((state) => {
      const list = state.messages[channelId] || [];
      const updated = {
        ...state.messages,
        [channelId]: list.map((m) =>
          m.id === messageId ? { ...m, isPinned: !m.isPinned } : m
        ),
      };
      saveMessagesToStorage(updated);
      return { messages: updated };
    });
  },

  toggleReaction: (channelId, messageId, emoji) => {
    set((state) => {
      const list = state.messages[channelId] || [];
      const updatedList = list.map((msg) => {
        if (msg.id !== messageId) return msg;
        const reactions = msg.reactions ? [...msg.reactions] : [];
        const existing = reactions.find((r) => r.emoji === emoji);
        if (existing) {
          if (existing.me) {
            existing.count -= 1;
            existing.me = false;
          } else {
            existing.count += 1;
            existing.me = true;
          }
        } else {
          reactions.push({ emoji, count: 1, me: true });
        }
        return { ...msg, reactions: reactions.filter((r) => r.count > 0) };
      });
      const updated = {
        ...state.messages,
        [channelId]: updatedList,
      };
      saveMessagesToStorage(updated);
      return { messages: updated };
    });
  },

  // Friend Requests
  friendRequests: defaultFriendRequests,
  sendFriendRequest: async (username: string) => {
    const trimmed = username.trim();
    if (!trimmed) {
      return { success: false, message: 'Digite o nome de usuário do CapyChat.' };
    }
    const cleanUser = trimmed.replace(/^@/, '');
    const curUser = get().currentUser;
    if (cleanUser.toLowerCase() === curUser.name?.toLowerCase()) {
      return { success: false, message: 'Você não pode enviar um pedido de amizade para si mesmo.' };
    }

    if (supabase) {
      try {
        const { data: foundProfiles } = await db()
          .from('profiles')
          .select('*')
          .or(`username.ilike.${cleanUser},display_name.ilike.${cleanUser}`);

        const target = foundProfiles && foundProfiles.length > 0 ? foundProfiles[0] : null;

        if (target) {
          if (target.id === curUser.id) {
            return { success: false, message: 'Você não pode enviar um pedido de amizade para si mesmo.' };
          }

          try {
            await socialAction('request_friend', { user_id: target.id });
          } catch (rpcErr: any) {
            const msg = (rpcErr?.message || '').toLowerCase();
            if (msg.includes('já existe amizade') || msg.includes('solicitação pendente')) {
              return { success: false, message: 'Você já possui amizade ou pedido pendente com este usuário.' };
            }
          }

          const newReq: FriendRequest = {
            id: `req-${Date.now()}`,
            user: {
              id: target.id,
              name: target.username || cleanUser,
              displayName: target.display_name || target.username || cleanUser,
              tag: target.id.replace(/-/g, '').slice(0, 4),
              avatar: getAvatarUrl(target.avatar_url),
              bannerColor: target.profile_primary_color || '#5865f2',
              status: target.status || 'online',
              aboutMe: target.bio || '',
            },
            type: 'outgoing',
            timestamp: 'Agora mesmo',
          };
          set((state) => ({
            friendRequests: [newReq, ...state.friendRequests],
          }));
          return { success: true, message: `Pedido de amizade enviado para ${target.display_name || target.username}!` };
        }
      } catch (e) {
        console.warn('[discordStore] sendFriendRequest error:', e);
      }
    }

    // Fallback local
    const reqId = `req-${Date.now()}`;
    const newReq: FriendRequest = {
      id: reqId,
      user: {
        id: `user-${Date.now()}`,
        name: cleanUser,
        displayName: cleanUser,
        tag: Math.floor(1000 + Math.random() * 9000).toString(),
        avatar: DEFAULT_AVATAR,
        bannerColor: '#5865f2',
        status: 'online',
        aboutMe: 'Novo amigo adicionado no CapyChat.',
      },
      type: 'outgoing',
      timestamp: 'Agora mesmo',
    };
    set((state) => ({
      friendRequests: [newReq, ...state.friendRequests],
    }));
    return { success: true, message: `Pedido de amizade enviado para ${cleanUser}!` };
  },

  acceptFriendRequest: async (requestId: string) => {
    const req = get().friendRequests.find((r) => r.id === requestId);
    if (!req) return;
    if (supabase && req.user.id && !req.user.id.startsWith('user-')) {
      try {
        await socialAction('accept_friend', { user_id: req.user.id });
      } catch (err) {
        console.warn('[discordStore] accept_friend error:', err);
      }
    }
    set((state) => {
      if (!mockUsers.some((u) => u.id === req.user.id)) {
        mockUsers.push(req.user);
      }
      return {
        friendRequests: state.friendRequests.filter((r) => r.id !== requestId),
        communityMembers: state.communityMembers.some((m) => m.id === req.user.id)
          ? state.communityMembers
          : [req.user, ...state.communityMembers],
      };
    });
  },

  rejectFriendRequest: async (requestId: string) => {
    const req = get().friendRequests.find((r) => r.id === requestId);
    if (req && supabase && req.user.id && !req.user.id.startsWith('user-')) {
      try {
        await socialAction('decline_friend', { user_id: req.user.id });
      } catch (err) {
        console.warn('[discordStore] decline_friend error:', err);
      }
    }
    set((state) => ({
      friendRequests: state.friendRequests.filter((r) => r.id !== requestId),
    }));
  },

  // Roles state & actions
  serverRolesMap: loadInitialServerRolesMap(),
  auditLogsByServer: loadInitialAuditLogsByServer(),
  roles: loadInitialRoles(),
  userRoleMap: loadInitialUserRoleMap(),

  getServerRoles: (serverId: string) => {
    const map = get().serverRolesMap;
    if (map[serverId] && map[serverId].length > 0) {
      return map[serverId];
    }
    if (serverId === 'server-lyc') {
      return defaultRoles;
    }
    return [defaultEveryoneRole];
  },

  getAuditLogs: (serverId: string) => {
    const map = get().auditLogsByServer;
    return map[serverId] || [];
  },

  addAuditLogEntry: (serverId: string, entry: Omit<AuditLogEntry, 'id' | 'time'> & { time?: string }) => {
    set((state) => {
      const serverLogs = state.auditLogsByServer[serverId] || [];
      const now = new Date();
      const timeStr = entry.time || `Hoje às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      const newEntry: AuditLogEntry = {
        ...entry,
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        time: timeStr,
      };
      const updatedMap = {
        ...state.auditLogsByServer,
        [serverId]: [newEntry, ...serverLogs],
      };
      saveAuditLogsByServerToStorage(updatedMap);
      return { auditLogsByServer: updatedMap };
    });
  },

  addRole: (role: Role) => {
    const activeServerId = get().activeServerId;
    if (!get().hasServerPermission('manageRoles', activeServerId)) {
      console.warn('[discordStore] Permissão negada: manageRoles é obrigatório para criar cargos.');
      return;
    }
    const curUser = get().currentUser;
    set((state) => {
      const everyoneRole = state.roles.find((r) => r.id === 'role-everyone');
      const otherRoles = state.roles.filter((r) => r.id !== 'role-everyone');
      const newRoles = everyoneRole ? [role, ...otherRoles, everyoneRole] : [role, ...otherRoles];
      const updatedRoles = newRoles.map((r, idx) => ({ ...r, position: idx + 1 }));
      saveRolesToStorage(updatedRoles);
      const updatedRolesMap = {
        ...state.serverRolesMap,
        [activeServerId]: updatedRoles,
      };
      saveServerRolesMapToStorage(updatedRolesMap);
      return { roles: updatedRoles, serverRolesMap: updatedRolesMap };
    });
    get().addAuditLogEntry(activeServerId, {
      user: curUser.displayName || curUser.name,
      avatar: curUser.avatar,
      actionType: 'create_role',
      action: 'criou o cargo',
      target: role.name,
      color: role.color || '#2ecc71',
      details: `Cor: ${role.color} • Posição: ${role.position || 1}`,
    });
  },

  updateRole: async (roleId: string, updates: Partial<Role>) => {
    const activeServerId = get().activeServerId;
    if (!get().hasServerPermission('manageRoles', activeServerId)) {
      console.warn('[discordStore] Permissão negada: manageRoles é obrigatório para atualizar cargos.');
      return;
    }

    const curUser = get().currentUser;
    const currentServer = get().servers.find((s) => s.id === activeServerId) || get().servers[0];
    const isOwner = Boolean(
      (!get().isAuthenticated && (curUser.id === 'user-ares' || (curUser.id === 'user-me' && currentServer && currentServer.id !== 'server-lyc' && currentServer.ownerId === 'user-me'))) ||
      (currentServer && curUser.id && currentServer.ownerId === curUser.id) ||
      (isOfficialCommunity(currentServer) && curUser.id === 'f8fcd139-cf43-4873-bd7d-a807ecd73567')
    );

    const currentServerRoles = get().serverRolesMap[activeServerId] || get().roles;
    const targetRole = currentServerRoles.find((r) => r.id === roleId);

    // Hierarchy & protection checks for non-owner
    if (!isOwner) {
      if (targetRole?.base_role === 'OWNER') {
        console.warn('[discordStore] Não é permitido modificar o cargo de proprietário.');
        return;
      }
      const userRoleIds = get().userRoleMap[curUser.id] || [];
      const actorRoles = currentServerRoles.filter((r) => userRoleIds.includes(r.id));
      const actorMaxPos = Math.max(0, ...actorRoles.map((r) => r.position ?? 0));

      if (targetRole && (targetRole.position ?? 0) >= actorMaxPos) {
        console.warn('[discordStore] Não é permitido modificar um cargo de hierarquia igual ou superior.');
        return;
      }
      if (typeof updates.position === 'number' && updates.position >= actorMaxPos) {
        console.warn('[discordStore] Não é permitido definir uma posição igual ou superior à do seu cargo mais alto.');
        return;
      }
      const hasAdmin = actorRoles.some((r) => r.permissions?.administrator);
      if (updates.permissions?.administrator && !hasAdmin) {
        console.warn('[discordStore] Apenas administradores podem conceder permissão de administrador.');
        return;
      }
    }

    set((state) => {
      const currentServerRoles = state.serverRolesMap[activeServerId] || state.roles;
      const updatedRoles = currentServerRoles.map((r) => (r.id === roleId ? { ...r, ...updates } : r));
      saveRolesToStorage(updatedRoles);
      const updatedRolesMap = {
        ...state.serverRolesMap,
        [activeServerId]: updatedRoles,
      };
      saveServerRolesMapToStorage(updatedRolesMap);
      return { roles: updatedRoles, serverRolesMap: updatedRolesMap };
    });
    get().addAuditLogEntry(activeServerId, {
      user: curUser.displayName || curUser.name,
      avatar: curUser.avatar,
      actionType: 'update_role',
      action: 'atualizou o cargo',
      target: updates.name || targetRole?.name || roleId,
      color: updates.color || targetRole?.color || '#5865f2',
    });

    // Remote sync to Supabase if connected
    const isUuid = (id?: string) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const commId = currentServer?.communityId || (activeServerId === 'server-lyc' ? 'd3f2173f-79f0-4362-b60a-ad079f724b54' : activeServerId);

    if (supabase && get().isAuthenticated && isUuid(roleId) && isUuid(commId)) {
      try {
        const payload: Record<string, any> = {
          community_id: commId,
          role_id: roleId,
        };
        if (updates.name) payload.name = updates.name.trim();
        if (updates.color) payload.color = updates.color;
        if (typeof updates.position === 'number') payload.position = updates.position;
        if (updates.permissions) {
          payload.permissions = Object.entries(updates.permissions)
            .filter(([_, enabled]) => !!enabled)
            .map(([key]) => PERMISSION_KEY_MAP[key as keyof RolePermissions])
            .filter(Boolean);
        }
        await communityAction('edit_role', payload);
      } catch (e) {
        console.warn('[discordStore] updateRole Supabase sync error:', e);
      }
    }
  },

  deleteRole: (roleId: string) => {
    if (roleId === 'role-everyone') return;
    const activeServerId = get().activeServerId;
    if (!get().hasServerPermission('manageRoles', activeServerId)) {
      console.warn('[discordStore] Permissão negada: manageRoles é obrigatório para excluir cargos.');
      return;
    }

    const curUser = get().currentUser;
    const currentServer = get().servers.find((s) => s.id === activeServerId) || get().servers[0];
    const isOwner = Boolean(
      (!get().isAuthenticated && (curUser.id === 'user-ares' || (curUser.id === 'user-me' && currentServer && currentServer.id !== 'server-lyc' && currentServer.ownerId === 'user-me'))) ||
      (currentServer && curUser.id && currentServer.ownerId === curUser.id) ||
      (isOfficialCommunity(currentServer) && curUser.id === 'f8fcd139-cf43-4873-bd7d-a807ecd73567')
    );

    const currentServerRoles = get().serverRolesMap[activeServerId] || get().roles;
    const targetRole = currentServerRoles.find((r) => r.id === roleId);

    if (targetRole?.base_role === 'OWNER') {
      console.warn('[discordStore] Não é permitido excluir o cargo de proprietário.');
      return;
    }

    if (!isOwner) {
      const userRoleIds = get().userRoleMap[curUser.id] || [];
      const actorRoles = currentServerRoles.filter((r) => userRoleIds.includes(r.id));
      const actorMaxPos = Math.max(0, ...actorRoles.map((r) => r.position ?? 0));
      if (targetRole && (targetRole.position ?? 0) >= actorMaxPos) {
        console.warn('[discordStore] Não é permitido excluir um cargo de hierarquia igual ou superior.');
        return;
      }
    }

    set((state) => {
      const currentServerRoles = state.serverRolesMap[activeServerId] || state.roles;
      const updatedRoles = currentServerRoles
        .filter((r) => r.id !== roleId)
        .map((r, idx) => ({ ...r, position: idx + 1 }));
      saveRolesToStorage(updatedRoles);
      const updatedRolesMap = {
        ...state.serverRolesMap,
        [activeServerId]: updatedRoles,
      };
      saveServerRolesMapToStorage(updatedRolesMap);
      return { roles: updatedRoles, serverRolesMap: updatedRolesMap };
    });
    get().addAuditLogEntry(activeServerId, {
      user: curUser.displayName || curUser.name,
      avatar: curUser.avatar,
      actionType: 'delete_role',
      action: 'excluiu o cargo',
      target: targetRole?.name || roleId,
      color: '#f23f43',
    });
  },

  reorderRoles: (sourceRoleId: string, targetIndex: number) => {
    const activeServerId = get().activeServerId;
    if (!get().hasServerPermission('manageRoles', activeServerId)) {
      console.warn('[discordStore] Permissão negada: manageRoles é obrigatório para reordenar cargos.');
      return;
    }
    set((state) => {
      const everyoneRole = state.roles.find((r) => r.id === 'role-everyone');
      const moveableRoles = state.roles.filter((r) => r.id !== 'role-everyone');
      const sourceIndex = moveableRoles.findIndex((r) => r.id === sourceRoleId);
      if (sourceIndex === -1) return state;

      const [targetRole] = moveableRoles.splice(sourceIndex, 1);
      const clampedIndex = Math.max(0, Math.min(targetIndex, moveableRoles.length));
      moveableRoles.splice(clampedIndex, 0, targetRole);

      const finalRoles = everyoneRole ? [...moveableRoles, everyoneRole] : moveableRoles;
      const updatedRoles = finalRoles.map((role, idx) => ({
        ...role,
        position: idx + 1,
      }));

      saveRolesToStorage(updatedRoles);
      const updatedRolesMap = {
        ...state.serverRolesMap,
        [activeServerId]: updatedRoles,
      };
      saveServerRolesMapToStorage(updatedRolesMap);
      return { roles: updatedRoles, serverRolesMap: updatedRolesMap };
    });
  },

  moveRoleByIndex: (fromIndex: number, toIndex: number) => {
    const activeServerId = get().activeServerId;
    set((state) => {
      const moveableRoles = state.roles.filter((r) => r.id !== 'role-everyone');
      const everyoneRole = state.roles.find((r) => r.id === 'role-everyone');
      if (fromIndex < 0 || fromIndex >= moveableRoles.length) return state;

      const [moved] = moveableRoles.splice(fromIndex, 1);
      const clamped = Math.max(0, Math.min(toIndex, moveableRoles.length));
      moveableRoles.splice(clamped, 0, moved);

      const finalRoles = everyoneRole ? [...moveableRoles, everyoneRole] : moveableRoles;
      const updatedRoles = finalRoles.map((role, idx) => ({
        ...role,
        position: idx + 1,
      }));

      saveRolesToStorage(updatedRoles);
      const updatedRolesMap = {
        ...state.serverRolesMap,
        [activeServerId]: updatedRoles,
      };
      saveServerRolesMapToStorage(updatedRolesMap);
      return { roles: updatedRoles, serverRolesMap: updatedRolesMap };
    });
  },

  setRoles: (roles: Role[]) => {
    const activeServerId = get().activeServerId;
    saveRolesToStorage(roles);
    set((state) => {
      const updatedRolesMap = {
        ...state.serverRolesMap,
        [activeServerId]: roles,
      };
      saveServerRolesMapToStorage(updatedRolesMap);
      return { roles, serverRolesMap: updatedRolesMap };
    });
  },

  getUserRoleColor: (userId: string) => {
    const userRoleIds = get().userRoleMap[userId] || [];
    const roles = get().roles;
    for (const r of roles) {
      if (userRoleIds.includes(r.id)) {
        return r.color;
      }
    }
    return '#dbdee1';
  },

  getUserRole: (userId: string) => {
    const userRoleIds = get().userRoleMap[userId] || [];
    const roles = get().roles;
    for (const r of roles) {
      if (userRoleIds.includes(r.id)) {
        return r;
      }
    }
    return roles.find((r) => r.id === 'role-everyone');
  },

  setUserRoles: async (userId: string, roleIds: string[], serverId?: string) => {
    const state = get();
    const targetServerId = serverId || state.activeServerId;
    const currentServer = state.servers.find((s) => s.id === targetServerId) || state.servers[0];
    const previousRoleIds = state.userRoleMap[userId] || [];

    // Check permissions
    const perms = state.canUserModerate(state.currentUser.id, userId, targetServerId);
    if (!perms.canManageRoles && !perms.isAdmin) {
      return { success: false, error: 'Você não possui permissão para alterar cargos deste membro.' };
    }

    // Optimistic local state update
    const newMap = {
      ...state.userRoleMap,
      [userId]: roleIds,
    };
    saveUserRoleMapToStorage(newMap);
    set({ userRoleMap: newMap });

    // Sync to Supabase if community context and valid UUIDs
    const isUuid = (id?: string) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const commId = currentServer?.communityId || (targetServerId === 'server-lyc' ? 'd3f2173f-79f0-4362-b60a-ad079f724b54' : targetServerId);

    if (supabase && state.isAuthenticated && targetServerId !== '@me' && isUuid(userId) && isUuid(commId)) {

      try {
        let commRoles = state.serverRolesMap[commId] || state.serverRolesMap['server-lyc'] || [];
        if (commRoles.length === 0) {
          const { data: dbRoles } = await db()
            .from('community_roles')
            .select('*')
            .eq('community_id', commId)
            .is('deleted_at', null);
          if (dbRoles && dbRoles.length > 0) {
            commRoles = dbRoles as any;
          }
        }

        const resolveToUuid = (roleId: string): string | null => {
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId)) {
            return roleId;
          }
          const matched = commRoles.find((r: any) =>
            r.id === roleId ||
            (roleId === 'role-admin' && (r.base_role === 'ADMIN' || r.name.toLowerCase().includes('admin'))) ||
            (roleId === 'role-mod' && (r.base_role === 'MODERATOR' || r.name.toLowerCase().includes('mod'))) ||
            (roleId === 'role-vip' && r.name.toLowerCase().includes('vip')) ||
            (roleId === 'role-competitor' && r.name.toLowerCase().includes('compet'))
          );
          return matched ? (matched as any).id : null;
        };

        const added = roleIds.filter((id) => !previousRoleIds.includes(id));
        const removed = previousRoleIds.filter((id) => !roleIds.includes(id));

        for (const addId of added) {
          const uuid = resolveToUuid(addId);
          if (uuid) {
            await communityAction('assign_role', {
              community_id: commId,
              user_id: userId,
              role_id: uuid,
            });
          }
        }

        for (const remId of removed) {
          const uuid = resolveToUuid(remId);
          if (uuid) {
            await communityAction('remove_role', {
              community_id: commId,
              user_id: userId,
              role_id: uuid,
            });
          }
        }

        await get().fetchCommunityMembers(commId);
        return { success: true };
      } catch (err: any) {
        console.error('[discordStore] setUserRoles remote sync error:', err);
        // Rollback optimistic update on error
        const rollbackMap = {
          ...get().userRoleMap,
          [userId]: previousRoleIds,
        };
        saveUserRoleMapToStorage(rollbackMap);
        set({ userRoleMap: rollbackMap });
        return { success: false, error: err?.message || 'Falha ao salvar cargo no servidor.' };
      }
    }

    return { success: true };
  },

  canUserModerate: (actorUserId: string, targetUserId?: string, serverId?: string) => {
    const state = get();
    const targetServerId = serverId || state.activeServerId;
    const currentServer = state.servers.find(s => s.id === targetServerId) || state.servers[0];
    const isOwner = Boolean(
      (!state.isAuthenticated && (actorUserId === 'user-ares' || (actorUserId === 'user-me' && currentServer && currentServer.id !== 'server-lyc' && currentServer.ownerId === 'user-me'))) ||
      (currentServer && actorUserId && currentServer.ownerId === actorUserId) ||
      (isOfficialCommunity(currentServer) && actorUserId === 'f8fcd139-cf43-4873-bd7d-a807ecd73567')
    );
    
    const actorRoleIds = state.userRoleMap[actorUserId] || (actorUserId === state.currentUser?.id ? (state.userRoleMap['user-me'] || state.userRoleMap[state.currentUser.id] || []) : []);
    const serverRoles = (currentServer && (state.serverRolesMap[currentServer.id] || (currentServer.communityId ? state.serverRolesMap[currentServer.communityId] : null) || (currentServer.id === 'server-lyc' ? state.serverRolesMap['server-lyc'] : null))) || [];
    const actorRoles = serverRoles.filter(r => actorRoleIds.includes(r.id));
    
    const isAdmin = isOwner || actorRoles.some(r => r.permissions?.administrator);
    const canKick = isAdmin || actorRoles.some(r => r.permissions?.kickMembers);
    const canBan = isAdmin || actorRoles.some(r => r.permissions?.banMembers);
    const canManageRoles = isAdmin || actorRoles.some(r => r.permissions?.manageRoles);

    if (targetUserId) {
      if (targetUserId === actorUserId || targetUserId === state.currentUser?.id) {
        return { canKick: false, canBan: false, canManageRoles: isOwner, isAdmin: isOwner };
      }
      const targetIsOwner = (!state.isAuthenticated && (targetUserId === 'user-ares' || (targetUserId === 'user-me' && currentServer && currentServer.id !== 'server-lyc' && currentServer.ownerId === 'user-me')))
        || (currentServer && targetUserId && currentServer.ownerId === targetUserId)
        || (isOfficialCommunity(currentServer) && targetUserId === 'f8fcd139-cf43-4873-bd7d-a807ecd73567');
      if (targetIsOwner) {
        return { canKick: false, canBan: false, canManageRoles: false, isAdmin: false };
      }
      const targetRoleIds = state.userRoleMap[targetUserId] || [];
      const targetRoles = serverRoles.filter(r => targetRoleIds.includes(r.id));
      const targetIsAdmin = targetRoles.some(r => r.permissions?.administrator);
      if (targetIsAdmin && !isOwner) {
        return { canKick: false, canBan: false, canManageRoles: false, isAdmin };
      }

      // Hierarchy check: non-owner actor cannot moderate member with equal or higher role
      if (!isOwner && targetRoles.length > 0) {
        const actorMaxPos = Math.max(0, ...actorRoles.map((r) => r.position ?? 0));
        const targetMaxPos = Math.max(0, ...targetRoles.map((r) => r.position ?? 0));
        if (targetMaxPos >= actorMaxPos) {
          return { canKick: false, canBan: false, canManageRoles: false, isAdmin: false };
        }
      }
    }

    return { canKick, canBan, canManageRoles, isAdmin };
  },

  hasServerPermission: (permission: keyof RolePermissions, serverId?: string, channelId?: string): boolean => {
    const state = get();
    const curUser = state.currentUser;
    if (!curUser) return false;

    const targetServerId = serverId || state.activeServerId;
    if (targetServerId === '@me') return true;

    const currentServer = state.servers.find((s) => s.id === targetServerId) || (serverId ? null : state.servers[0]);
    if (!currentServer) return false;

    // 1. Owner always has all permissions
    const isOwner = Boolean(
      (!state.isAuthenticated && (curUser.id === 'user-ares' || (curUser.id === 'user-me' && currentServer.id !== 'server-lyc' && currentServer.ownerId === 'user-me'))) ||
      (curUser.id && currentServer.ownerId === curUser.id) ||
      (isOfficialCommunity(currentServer) && curUser.id === 'f8fcd139-cf43-4873-bd7d-a807ecd73567')
    );
    if (isOwner) return true;

    // 2. Fetch actor roles strictly for target server
    const userRoleIds = state.userRoleMap[curUser.id] || (state.userRoleMap['user-me'] || state.userRoleMap[curUser.id] || []);
    const serverRoles = (state.serverRolesMap[currentServer.id] || (currentServer.communityId ? state.serverRolesMap[currentServer.communityId] : null) || (currentServer.id === 'server-lyc' ? state.serverRolesMap['server-lyc'] : null)) || [];

    // Default / @everyone role
    const defaultRole = serverRoles.find((r) => r.id === 'role-everyone' || r.name === '@everyone' || r.name === '@todos' || r.isDefault);
    const assignedRoles = serverRoles.filter((r) => userRoleIds.includes(r.id));
    if (defaultRole && !assignedRoles.some((r) => r.id === defaultRole.id)) {
      assignedRoles.push(defaultRole);
    }

    // 3. Administrator role grants all permissions
    if (assignedRoles.some((r) => r.permissions?.administrator)) {
      return true;
    }

    // 4. Channel permission overrides if channelId provided
    if (channelId) {
      const channel = currentServer.categories?.flatMap((c) => c.channels || []).find((ch) => ch.id === channelId);
      if (channel && channel.permissionOverrides) {
        for (const role of assignedRoles) {
          const override = channel.permissionOverrides[role.id];
          if (override) {
            if (permission === 'viewChannels') {
              if (override.viewChannel === 'deny') return false;
              if (override.viewChannel === 'allow') return true;
            }
            if (permission === 'sendMessages') {
              if (override.sendMessages === 'deny') return false;
              if (override.sendMessages === 'allow') return true;
            }
            if (permission === 'connectVoice') {
              if (override.connectVoice === 'deny') return false;
              if (override.connectVoice === 'allow') return true;
            }
          }
        }
      }
    }

    // 5. Default allowed keys for common member interactions if not explicitly configured
    const defaultAllowedKeys: (keyof RolePermissions)[] = [
      'viewChannels',
      'sendMessages',
      'connectVoice',
      'speak',
      'streamScreen',
      'attachFiles',
      'addReactions',
      'createInvites',
      'changeNickname',
    ];

    // Check if any assigned role has the permission enabled
    for (const r of assignedRoles) {
      if (r.permissions && r.permissions[permission] === true) {
        return true;
      }
    }

    // If default role has explicit boolean, use it
    if (defaultRole && defaultRole.permissions && defaultRole.permissions[permission] !== undefined) {
      return defaultRole.permissions[permission] === true;
    }

    // Fallback to default allowed keys ONLY for member non-administrative keys
    return defaultAllowedKeys.includes(permission);
  },

  kickMember: async (serverId: string, userId: string) => {
    const { canUserModerate, currentUser, communityMembers } = get();
    const perms = canUserModerate(currentUser.id, userId, serverId);
    if (!perms.canKick) {
      return { success: false, message: 'Você não tem permissão para expulsar membros.' };
    }

    const targetUser = communityMembers.find(m => m.id === userId) || mockUsers.find(u => u.id === userId);

    set((state) => {
      const updatedMembers = state.communityMembers.filter((m) => m.id !== userId);
      const voiceParticipants = state.voiceState.participants.filter((p) => p.user.id !== userId);
      return {
        communityMembers: updatedMembers,
        voiceState: {
          ...state.voiceState,
          participants: voiceParticipants,
        },
      };
    });

    get().addAuditLogEntry(serverId, {
      user: currentUser.displayName || currentUser.name,
      avatar: currentUser.avatar,
      actionType: 'kick',
      action: 'expulsou o membro',
      target: targetUser?.displayName || targetUser?.name || userId,
      color: '#f23f43',
    });

    return { success: true, message: 'Membro expulso com sucesso do servidor.' };
  },

  banMember: async (serverId: string, userId: string, reason?: string) => {
    const { canUserModerate, currentUser, communityMembers } = get();
    const perms = canUserModerate(currentUser.id, userId, serverId);
    if (!perms.canBan) {
      return { success: false, message: 'Você não tem permissão para banir membros.' };
    }

    const targetUser = communityMembers.find(m => m.id === userId) || mockUsers.find(u => u.id === userId);

    set((state) => {
      const updatedMembers = state.communityMembers.filter((m) => m.id !== userId);
      const voiceParticipants = state.voiceState.participants.filter((p) => p.user.id !== userId);
      const bannedKey = `lyc_banned_${serverId}`;
      try {
        const existing = JSON.parse(localStorage.getItem(bannedKey) || '[]');
        if (!existing.includes(userId)) existing.push(userId);
        localStorage.setItem(bannedKey, JSON.stringify(existing));
      } catch {}

      return {
        communityMembers: updatedMembers,
        voiceState: {
          ...state.voiceState,
          participants: voiceParticipants,
        },
      };
    });

    get().addAuditLogEntry(serverId, {
      user: currentUser.displayName || currentUser.name,
      avatar: currentUser.avatar,
      actionType: 'ban',
      action: 'baniu o usuário',
      target: targetUser?.displayName || targetUser?.name || userId,
      color: '#da373c',
      details: reason,
    });

    return { success: true, message: `Membro banido com sucesso.${reason ? ' Motivo: ' + reason : ''}` };
  },

  serverMuteUser: (userId: string, isMuted: boolean) => {
    set((state) => ({
      voiceState: {
        ...state.voiceState,
        participants: state.voiceState.participants.map((p) =>
          p.user.id === userId ? { ...p, isMuted } : p
        ),
      },
    }));
  },

  serverDeafenUser: (userId: string, isDeafened: boolean) => {
    set((state) => ({
      voiceState: {
        ...state.voiceState,
        participants: state.voiceState.participants.map((p) =>
          p.user.id === userId ? { ...p, isDeafened } : p
        ),
      },
    }));
  },

  moveUserVoice: (userId: string, targetChannelId: string) => {
    set((state) => {
      const targetChannel = state.servers
        .flatMap((s) => s.categories)
        .flatMap((c) => c.channels)
        .find((ch) => ch.id === targetChannelId);

      if (!targetChannel) return state;

      if (userId === state.currentUser.id || userId === 'user-me') {
        return {
          voiceState: {
            ...state.voiceState,
            channelId: targetChannelId,
            channelName: targetChannel.name,
          },
          activeChannelId: targetChannelId,
        };
      }
      return state;
    });
  },

  disconnectUserVoice: (userId: string) => {
    set((state) => {
      if (userId === state.currentUser.id || userId === 'user-me') {
        return {
          voiceState: {
            isConnected: false,
            pingMs: 0,
            participants: [],
          },
          activeView: 'chat',
        };
      }
      return {
        voiceState: {
          ...state.voiceState,
          participants: state.voiceState.participants.filter((p) => p.user.id !== userId),
        },
      };
    });
  },

  setUserNickname: (userId: string, nickname: string) => {
    set((state) => {
      const cleanNick = nickname.trim();
      const updatedMembers = state.communityMembers.map((m) =>
        m.id === userId ? { ...m, displayName: cleanNick || m.name } : m
      );
      const isCur = userId === state.currentUser.id || userId === 'user-me';
      const updatedCur = isCur ? { ...state.currentUser, displayName: cleanNick || state.currentUser.name } : state.currentUser;
      return { communityMembers: updatedMembers, currentUser: updatedCur };
    });
  },

  setUserNote: (userId: string, note: string) => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`lyc_note_${userId}`, note);
      } catch {}
    }
  },

  getUserNote: (userId: string) => {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(`lyc_note_${userId}`) || '';
      } catch {}
    }
    return '';
  },

  removeFriend: (userId: string) => {
    set((state) => ({
      friendRequests: state.friendRequests.filter((r) => r.user.id !== userId),
      communityMembers: state.communityMembers.filter((m) => m.id !== userId || m.id === state.currentUser.id),
    }));
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__discordStore = useDiscord;
}

const scheduleDebouncedMemberRefresh = (communityId?: string) => {
  if (presenceDebounceTimeout) clearTimeout(presenceDebounceTimeout);
  presenceDebounceTimeout = setTimeout(() => {
    void useDiscord.getState().fetchCommunityMembers(communityId);
  }, 300);
};

export const sweepExpiredPresences = (communityId = 'd3f2173f-79f0-4362-b60a-ad079f724b54') => {
  const state = useDiscord.getState();
  const now = Date.now();
  let changed = false;

  const currentMembers = state.communityMembers;
  if (!currentMembers || currentMembers.length === 0) return;

  const curId = state.currentUser?.id;
  const realtimeIds = state.realtimeOnlineIds;

  const updatedMembers = currentMembers.map((m) => {
    if (m.id === curId) return m;

    if (realtimeIds.has(m.id)) {
      if (m.status === 'offline') {
        changed = true;
        return { ...m, status: 'online' as const };
      }
      return m;
    }

    if (m.status !== 'offline') {
      const expiresAt = presenceLeaseCache.get(m.id);
      const isStillOnline = isPresenceOnline({ status: 'online', expires_at: expiresAt }, now);
      if (!isStillOnline) {
        changed = true;
        return { ...m, status: 'offline' as const };
      }
    }
    return m;
  });

  if (changed) {
    const onlineMembers = updatedMembers.filter((m) => m.status !== 'offline').length;
    useDiscord.setState((s) => ({
      communityMembers: updatedMembers,
      servers: s.servers.map((srv) =>
        srv.communityId === communityId ||
        (srv.id === 'server-lyc' && communityId === 'd3f2173f-79f0-4362-b60a-ad079f724b54') ||
        srv.id === communityId
          ? { ...srv, onlineCount: onlineMembers }
          : srv
      ),
    }));
  }
};

if (typeof window !== 'undefined') {
  (window as any).__useDiscordStore = useDiscord;
}


