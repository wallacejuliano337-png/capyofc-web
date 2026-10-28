import { getAssetUrl } from '../utils/assets';

export type SettingsTab =
  | 'my-account'
  | 'profiles'
  | 'insignias'
  | 'privacy-safety'
  | 'authorized-apps'
  | 'connections'
  | 'nitro'
  | 'server-boost'
  | 'subscriptions'
  | 'appearance'
  | 'accessibility'
  | 'voice-video'
  | 'notifications'
  | 'keybinds'
  | 'language'
  | 'about';

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface UserActivity {
  type: 'PLAYING' | 'STREAMING' | 'LISTENING' | 'WATCHING';
  name: string;
  details?: string;
  state?: string;
  timeStarted?: string;
}

export interface User {
  id: string;
  name: string;
  displayName?: string;
  tag: string;
  avatar: string;
  bannerColor?: string;
  bannerImage?: string;
  status: UserStatus;
  customStatus?: string;
  aboutMe?: string;
  badges?: string[];
  displayedBadges?: string[];
  role?: string;
  joinedDate?: string;
  activity?: UserActivity;
  isBot?: boolean;
  roleIds?: string[];
  nameFont?: string;
  nameEffect?: 'solid' | 'gradient' | 'neon' | 'cartoon' | 'pop' | 'gummy' | 'prism';
  nameColor?: string;
  themePrimaryColor?: string;
  themeSecondaryColor?: string;
}

export interface SavedAccount {
  id: string;
  name: string;
  displayName?: string;
  avatar: string;
  tag?: string;
  lastActive: string;
}

export interface RolePermissions {
  // Geral e administração do servidor
  administrator: boolean;
  manageCommunity?: boolean;
  viewAuditLog?: boolean;

  // Gerenciamento de cargos e canais
  manageChannels: boolean;
  manageRoles: boolean;

  // Gerenciamento de membros e moderação
  kickMembers: boolean;
  banMembers: boolean;
  timeoutMembers?: boolean;
  manageNicknames?: boolean;
  changeNickname?: boolean;

  // Canais e mensagens
  viewChannels: boolean;
  sendMessages?: boolean;
  manageMessages?: boolean;
  embedLinks?: boolean;
  attachFiles?: boolean;
  addReactions?: boolean;
  mentionEveryone?: boolean;

  // Voz e chamadas
  connectVoice: boolean;
  speak?: boolean;
  video?: boolean;
  streamScreen: boolean;
  muteMembers?: boolean;
  disconnectMembers?: boolean;

  // Recursos de comunidade
  createInvites?: boolean;
}

export const PERMISSION_KEY_MAP: Record<keyof RolePermissions, string> = {
  administrator: 'administrator',
  manageCommunity: 'manage_community',
  viewAuditLog: 'view_audit_log',
  manageChannels: 'manage_channels',
  manageRoles: 'manage_roles',
  kickMembers: 'kick_members',
  banMembers: 'ban_members',
  timeoutMembers: 'timeout_members',
  manageNicknames: 'manage_nicknames',
  changeNickname: 'change_nickname',
  viewChannels: 'view_channels',
  sendMessages: 'send_messages',
  manageMessages: 'manage_messages',
  embedLinks: 'embed_links',
  attachFiles: 'attach_files',
  addReactions: 'add_reactions',
  mentionEveryone: 'mention_everyone',
  connectVoice: 'connect_voice',
  speak: 'speak',
  video: 'video',
  streamScreen: 'share_screen',
  muteMembers: 'mute_members',
  disconnectMembers: 'disconnect_members',
  createInvites: 'create_invites',
};

export const DEFAULT_MEMBER_PERMISSIONS: RolePermissions = {
  administrator: false,
  manageCommunity: false,
  viewAuditLog: false,
  manageChannels: false,
  manageRoles: false,
  kickMembers: false,
  banMembers: false,
  timeoutMembers: false,
  manageNicknames: false,
  changeNickname: true,
  viewChannels: true,
  sendMessages: true,
  manageMessages: false,
  embedLinks: true,
  attachFiles: true,
  addReactions: true,
  mentionEveryone: false,
  connectVoice: true,
  speak: true,
  video: false,
  streamScreen: true,
  muteMembers: false,
  disconnectMembers: false,
  createInvites: true,
};

export interface Role {
  id: string;
  name: string;
  color: string;
  hoist?: boolean;
  position?: number;
  permissions: RolePermissions;
  memberCount?: number;
  onlineCount?: number;
  isDefault?: boolean;
  base_role?: string;
}

export type ChannelType = 'text' | 'voice' | 'announcement' | 'forum';

export type PermissionOverrideState = 'allow' | 'inherit' | 'deny';

export interface ChannelPermissionOverride {
  roleId: string;
  viewChannel?: PermissionOverrideState;
  sendMessages?: PermissionOverrideState;
  connectVoice?: PermissionOverrideState;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  topic?: string;
  unread?: boolean;
  mentionCount?: number;
  isPrivate?: boolean;
  allowedRoleIds?: string[];
  permissionOverrides?: Record<string, ChannelPermissionOverride>;
  slowmode?: number;
  isNsfw?: boolean;
  bitrate?: number;
  userLimit?: number;
  videoQuality?: string;
  isMuted?: boolean;
}

export interface ChannelCategory {
  id: string;
  name: string;
  channels: Channel[];
  isPrivate?: boolean;
  isMuted?: boolean;
}

export interface ServerFolder {
  id: string;
  name: string;
  color?: string;
  servers: Server[];
  isOpen?: boolean;
}

export interface ColorGradient {
  id: string;
  name: string;
  gradientClass: string;
  fromColor: string;
  toColor: string;
}

export const COLOR_GRADIENTS: ColorGradient[] = [
  { id: 'matte-black', name: 'Preto fosco', gradientClass: 'from-[#1e1f22] to-[#111214]', fromColor: '#1e1f22', toColor: '#111214' },
  { id: 'vibrant-pink', name: 'Rosa vibrante', gradientClass: 'from-[#eb459e] to-[#f47b67]', fromColor: '#eb459e', toColor: '#f47b67' },
  { id: 'red', name: 'Vermelho', gradientClass: 'from-[#ed4245] to-[#f26522]', fromColor: '#ed4245', toColor: '#f26522' },
  { id: 'orange', name: 'Laranja', gradientClass: 'from-[#f26522] to-[#faa61a]', fromColor: '#f26522', toColor: '#faa61a' },
  { id: 'golden-yellow', name: 'Amarelo dourado', gradientClass: 'from-[#faa61a] to-[#fee75c]', fromColor: '#faa61a', toColor: '#fee75c' },
  { id: 'blurple-purple', name: 'Roxo', gradientClass: 'from-[#5865f2] to-[#8a2be2]', fromColor: '#5865f2', toColor: '#8a2be2' },
  { id: 'cyan-blue', name: 'Azul ciano', gradientClass: 'from-[#00b0f4] to-[#00a8fc]', fromColor: '#00b0f4', toColor: '#00a8fc' },
  { id: 'mint', name: 'Menta', gradientClass: 'from-[#57f287] to-[#3ba55d]', fromColor: '#57f287', toColor: '#3ba55d' },
  { id: 'olive', name: 'Verde oliva', gradientClass: 'from-[#3ba55d] to-[#2d7d46]', fromColor: '#3ba55d', toColor: '#2d7d46' },
  { id: 'dark-gray', name: 'Cinza escuro', gradientClass: 'from-[#4e5058] to-[#2b2d31]', fromColor: '#4e5058', toColor: '#2b2d31' },
];

export function getServerBannerGradient(colorId?: string): string {
  const found = COLOR_GRADIENTS.find((c) => c.id === colorId);
  return found ? found.gradientClass : 'from-[#5865f2] to-[#8a2be2]';
}

export interface ServerTagBadge {
  id: string;
  name: string;
  iconUrl: string;
  char?: string;
}

export interface ServerTagColor {
  id: string;
  name: string;
  hex: string;
  bg: string;
}

export const SERVER_TAG_BADGES: ServerTagBadge[] = [
  { id: 'broto-verde', name: 'Broto Verde', iconUrl: '/assets/insignias/broto-verde.png', char: '🌱' },
  { id: 'caneca-cafe', name: 'Caneca de Café', iconUrl: '/assets/insignias/caneca-cafe.png', char: '☕' },
  { id: 'capy', name: 'Capy', iconUrl: '/assets/insignias/capy.png', char: '🦫' },
  { id: 'coracao-rosa', name: 'Coração Rosa', iconUrl: '/assets/insignias/coracao-rosa.png', char: '💖' },
  { id: 'coroa-dourada', name: 'Coroa Dourada', iconUrl: '/assets/insignias/coroa-dourada.png', char: '👑' },
  { id: 'fogueira', name: 'Fogueira', iconUrl: '/assets/insignias/fogueira.png', char: '🔥' },
  { id: 'laranja', name: 'Laranja', iconUrl: '/assets/insignias/laranja.png', char: '🍊' },
  { id: 'estrela-dourada', name: 'Estrela Dourada', iconUrl: '/assets/insignias/estrela-dourada.png', char: '⭐' },
  { id: 'fones-gamer', name: 'Fones Gamer', iconUrl: '/assets/insignias/fones-gamer.png', char: '🎧' },
  { id: 'gota-dagua', name: 'Gota d’Água', iconUrl: '/assets/insignias/gota-dagua.png', char: '💧' },
  { id: 'pata-roxa', name: 'Pata Roxa Facetada', iconUrl: '/assets/insignias/pata-roxa.png', char: '🐾' },
  { id: 'pata', name: 'Pata', iconUrl: '/assets/insignias/pata.png', char: '🐾' },
  { id: 'raio-dourado', name: 'Raio Dourado', iconUrl: '/assets/insignias/raio-dourado.png', char: '⚡' },
  { id: 'folha-verde', name: 'Folha Verde', iconUrl: '/assets/insignias/folha-verde.png', char: '🍃' },
  { id: 'lua-crescente', name: 'Lua Crescente', iconUrl: '/assets/insignias/lua-crescente.png', char: '🌙' },
];

const LEGACY_BADGE_MAP: Record<string, string> = {
  gem: 'coroa-dourada',
  leaf: 'folha-verde',
  sword: 'coroa-dourada',
  heart: 'coracao-rosa',
  fire: 'fogueira',
  drop: 'gota-dagua',
  skull: 'pata-roxa',
  moon: 'lua-crescente',
  zap: 'raio-dourado',
  mushroom: 'broto-verde',
};

export const SERVER_TAG_COLORS: ServerTagColor[] = [
  { id: 'gold', name: 'Dourado', hex: '#f1c40f', bg: 'bg-[#f1c40f]' },
  { id: 'blurple', name: 'Blurple', hex: '#5865f2', bg: 'bg-[#5865f2]' },
  { id: 'pink', name: 'Rosa', hex: '#eb459e', bg: 'bg-[#eb459e]' },
  { id: 'cyan', name: 'Ciano', hex: '#00b0f4', bg: 'bg-[#00b0f4]' },
  { id: 'mint', name: 'Menta', hex: '#57f287', bg: 'bg-[#57f287]' },
  { id: 'red', name: 'Vermelho', hex: '#ed4245', bg: 'bg-[#ed4245]' },
];

export function resolveServerTagColor(colorIdOrHex?: string): { id: string; name: string; hex: string; bg?: string } {
  if (!colorIdOrHex) return SERVER_TAG_COLORS[0];
  const found = SERVER_TAG_COLORS.find((c) => c.id === colorIdOrHex);
  if (found) return found;
  if (colorIdOrHex.startsWith('#')) {
    return { id: 'custom', name: 'Personalizada', hex: colorIdOrHex, bg: '' };
  }
  return SERVER_TAG_COLORS[0];
}

export function resolveServerTagBadgeItem(badgeId?: string): ServerTagBadge {
  if (!badgeId) return SERVER_TAG_BADGES[0];
  const mappedId = LEGACY_BADGE_MAP[badgeId] || badgeId;
  const found = SERVER_TAG_BADGES.find((b) => b.id === mappedId);
  return found || SERVER_TAG_BADGES[0];
}

export function resolveServerTagBadgeIcon(badgeId?: string, customImage?: string | null): string {
  if (customImage) return customImage;
  const item = resolveServerTagBadgeItem(badgeId);
  return item.iconUrl;
}

export function resolveServerTagBadge(badgeId?: string): string {
  if (!badgeId) return SERVER_TAG_BADGES[0].char || '💎';
  const mappedId = LEGACY_BADGE_MAP[badgeId] || badgeId;
  const found = SERVER_TAG_BADGES.find((b) => b.id === mappedId);
  return found ? (found.char || '💎') : '💎';
}

export interface ServerSticker {
  id: string;
  name: string;
  url: string;
  description?: string;
  tags?: string;
}

export interface Server {
  id: string;
  communityId?: string;
  isCommunity?: boolean;
  rulesChannelId?: string;
  publicUpdatesChannelId?: string;
  name: string;
  icon?: string;
  initials: string;
  banner?: string;
  bannerImage?: string | null;
  bannerColor?: string;
  unreadBadge?: number;
  mentionCount?: number;
  categories: ChannelCategory[];
  description?: string;
  traits?: string[];
  systemChannelId?: string;
  afkChannelId?: string;
  afkTimeout?: string;
  roles?: Role[];
  serverTag?: string;
  serverTagBadge?: string;
  serverTagBadgeImage?: string | null;
  serverTagColor?: string;
  welcomeRandomMsg?: boolean;
  welcomeStickerPrompt?: boolean;
  boostSystemMsg?: boolean;
  tipsSystemMsg?: boolean;
  activityFeedEnabled?: boolean;
  defaultNotification?: 'all' | 'mentions';
  showBoostProgressBar?: boolean;
  boostCount?: number;
  boostLevel?: 0 | 1 | 2 | 3;
  accessMode?: 'invite' | 'request' | 'discoverable';
  isNsfw?: boolean;
  rules?: string[];
  verificationLevel?: 'none' | 'low' | 'medium' | 'high' | 'highest';
  require2FA?: boolean;
  restrictKicksToAdmin?: boolean;
  explicitContentFilter?: 'none' | 'noroles' | 'all';
  activityAlerts?: boolean;
  ownerId?: string;
  memberIds?: string[];
  isMuted?: boolean;
  isVerified?: boolean;
  verifiedBadgeStyle?: 'blue' | 'gold';
  memberCount?: number;
  onlineCount?: number;
  createdAtDaysAgo?: number;
  stickers?: ServerSticker[];
}

export interface MessageReaction {
  emoji: string;
  count: number;
  me: boolean;
}

export interface MessageEmbed {
  title?: string;
  description?: string;
  color?: string;
  url?: string;
  author?: {
    name: string;
    iconUrl?: string;
  };
  fields?: { name: string; value: string; inline?: boolean }[];
  thumbnailUrl?: string;
  imageUrl?: string;
  footer?: {
    text: string;
    iconUrl?: string;
  };
}

export interface MessageAttachment {
  id?: string;
  type: 'image' | 'video' | 'file' | 'sticker';
  url: string;
  name?: string;
  size?: string;
}

export interface Message {
  id: string;
  channelId: string;
  author: User;
  content: string;
  timestamp: string;
  edited?: boolean;
  isEdited?: boolean;
  isPinned?: boolean;
  replyTo?: {
    id: string;
    author: string;
    content: string;
  };
  embed?: MessageEmbed;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
}

export interface FriendRequest {
  id: string;
  user: User;
  type: 'incoming' | 'outgoing';
  timestamp: string;
}

export interface VoiceParticipant {
  user: User;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  isVideoOn: boolean;
  streamUrl?: string;
  mediaStream?: MediaStream;
}

export interface VoiceConnectionState {
  isConnected: boolean;
  serverId?: string;
  serverName?: string;
  channelId?: string;
  channelName?: string;
  pingMs: number;
  participants: VoiceParticipant[];
  error?: string;
}

export interface ShopItem {
  id: string;
  title: string;
  collection: string;
  type: 'avatar-decoration' | 'profile-effect' | 'banner';
  previewUrl: string;
  price: string;
  isNew?: boolean;
  isExclusive?: boolean;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  game: string;
  reward: string;
  rewardIcon: string;
  progress: number;
  maxProgress: number;
  expiresIn: string;
  completed?: boolean;
}

export interface ElectronScreenSource {
  id: string;
  name: string;
  thumbnail: string;
}

export interface AuditLogEntry {
  id: string;
  user: string;
  avatar?: string;
  actionType: string;
  action: string;
  target: string;
  time: string;
  color: string;
  details?: string;
}

