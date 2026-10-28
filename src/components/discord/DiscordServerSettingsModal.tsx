import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDiscord, mockUsers, currentUser } from '../../store/discordStore';
import { User, Role, RolePermissions, resolveServerTagBadge, resolveServerTagColor, resolveServerTagBadgeIcon, SERVER_TAG_BADGES, ServerSticker } from '../../types/discord';
import { LycVerifiedBadge } from './LycVerifiedBadge';
import { DiscordDeleteServerModal } from './DiscordDeleteServerModal';
import {
  exportServerToTemplate,
  saveServerTemplate,
  downloadTemplateAsJson,
} from '../../services/server-templates';
import { isOfficialCommunity } from '../../services/communityLevel';
import { getAssetUrl } from '../../utils/assets';
import {
  X,
  Shield,
  Smile,
  FileText,
  ShieldCheck,
  Webhook,
  Trash2,
  Upload,
  Check,
  Users,
  ExternalLink,
  Sparkles,
  Volume2,
  VolumeX,
  Hash,
  Calendar,
  Gem,
  Infinity,
  Sticker,
  Search,
  Plus,
  Pencil,
  GripVertical,
  MoreVertical,
  ChevronRight,
  ArrowLeft,
  Pipette,
  AlertTriangle,
  UserPlus,
  UserMinus,
  Ban,
  UserX,
  Layers,
  Bot,
  Info,
  Lock,
  Mail,
  Globe,
  ChevronDown,
  Copy,
  Link as LinkIcon,
  Clock,
  Flame,
  Sword,
  Heart,
  Skull,
  Moon,
  Zap,
  Leaf,
  CheckCircle2,
  Download,
  Sliders,
  ShieldAlert,
  Radio,
  FileCode,
  Tag,
  RadioReceiver,
  Play,
  Crown,
  Award,
  MonitorPlay,
  Video,
} from 'lucide-react';

interface AuditLogEntry {
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

interface ColorGradient {
  id: string;
  name: string;
  gradientClass: string;
  fromColor: string;
  toColor: string;
}

const COLOR_GRADIENTS: ColorGradient[] = [
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

interface RolePermissionItemDef {
  key: keyof RolePermissions;
  label: string;
  desc: string;
  isDanger?: boolean;
  adminOnly?: boolean;
}

interface RolePermissionCategoryDef {
  title: string;
  description: string;
  permissions: RolePermissionItemDef[];
}

const ROLE_PERMISSION_CATEGORIES: RolePermissionCategoryDef[] = [
  {
    title: 'Geral e Administração do Servidor',
    description: 'Controle de privilégios e governança do servidor.',
    permissions: [
      {
        key: 'administrator',
        label: 'Administrador',
        desc: 'Concede todas as permissões ao membro e contorna restrições de canais e cargos. Use com extrema cautela!',
        isDanger: true,
        adminOnly: true,
      },
      {
        key: 'manageCommunity',
        label: 'Gerenciar Servidor',
        desc: 'Permite alterar o nome do servidor, ícone, banner, notificações e descrição.',
        isDanger: true,
      },
      {
        key: 'viewAuditLog',
        label: 'Ver Registro de Auditoria',
        desc: 'Permite visualizar o histórico detalhado de alterações e ações administrativas.',
      },
    ],
  },
  {
    title: 'Cargos e Canais',
    description: 'Estruturação de permissões e organização da comunidade.',
    permissions: [
      {
        key: 'manageRoles',
        label: 'Gerenciar Cargos',
        desc: 'Permite criar novos cargos e editar ou excluir cargos abaixo deste na hierarquia.',
        isDanger: true,
      },
      {
        key: 'manageChannels',
        label: 'Gerenciar Canais',
        desc: 'Permite criar, editar, reordenar ou excluir canais de texto e voz.',
        isDanger: true,
      },
    ],
  },
  {
    title: 'Membros e Moderação',
    description: 'Manutenção da ordem e convivência dos membros.',
    permissions: [
      {
        key: 'kickMembers',
        label: 'Expulsar Membros',
        desc: 'Permite remover membros do servidor. Eles poderão retornar se convidados novamente.',
        isDanger: true,
      },
      {
        key: 'banMembers',
        label: 'Banir Membros',
        desc: 'Permite banir permanentemente membros do servidor, revogando o acesso.',
        isDanger: true,
      },
      {
        key: 'timeoutMembers',
        label: 'Moderar / Silenciar Membros',
        desc: 'Permite aplicar castigos temporários ou silenciamento preventivo.',
        isDanger: true,
      },
      {
        key: 'changeNickname',
        label: 'Alterar Próprio Apelido',
        desc: 'Permite que o usuário altere seu próprio apelido neste servidor.',
      },
      {
        key: 'manageNicknames',
        label: 'Gerenciar Apelidos',
        desc: 'Permite alterar os apelidos de outros membros do servidor.',
      },
    ],
  },
  {
    title: 'Canais e Mensagens',
    description: 'Privilégios de envio, edição e interações textuais.',
    permissions: [
      {
        key: 'viewChannels',
        label: 'Ver Canais',
        desc: 'Permite aos membros lerem o histórico e mensagens nos canais de texto.',
      },
      {
        key: 'sendMessages',
        label: 'Enviar Mensagens',
        desc: 'Permite enviar mensagens nos canais de texto e tópicos.',
      },
      {
        key: 'manageMessages',
        label: 'Gerenciar Mensagens',
        desc: 'Permite apagar ou fixar mensagens de outros membros.',
        isDanger: true,
      },
      {
        key: 'attachFiles',
        label: 'Anexar Arquivos e Mídias',
        desc: 'Permite enviar imagens, vídeos e arquivos nos canais.',
      },
      {
        key: 'mentionEveryone',
        label: 'Mencionar @everyone e @here',
        desc: 'Permite emitir menções que notificam todos os membros da comunidade.',
        isDanger: true,
      },
      {
        key: 'addReactions',
        label: 'Adicionar Reações',
        desc: 'Permite adicionar novas reações com emojis às mensagens.',
      },
    ],
  },
  {
    title: 'Voz e Chamadas',
    description: 'Controle de áudio, microfone e transmissões.',
    permissions: [
      {
        key: 'connectVoice',
        label: 'Conectar à Voz',
        desc: 'Permite entrar em canais de voz e escutar outros membros.',
      },
      {
        key: 'speak',
        label: 'Falar na Voz',
        desc: 'Permite falar pelos microfones nos canais de voz.',
      },
      {
        key: 'streamScreen',
        label: 'Compartilhar Tela',
        desc: 'Permite transmitir a tela ou aplicativos em canais de voz.',
      },
      {
        key: 'video',
        label: 'Vídeo / Transmissão de Câmera',
        desc: 'Permite ligar a câmera em canais de voz.',
      },
      {
        key: 'muteMembers',
        label: 'Silenciar Membros na Voz',
        desc: 'Permite silenciar o microfone de outros membros na chamada de voz.',
        isDanger: true,
      },
      {
        key: 'disconnectMembers',
        label: 'Desconectar Membros',
        desc: 'Permite desconectar outros usuários de um canal de voz.',
        isDanger: true,
      },
    ],
  },
  {
    title: 'Recursos de Comunidade',
    description: 'Compartilhamento e atalhos de engajamento da comunidade.',
    permissions: [
      {
        key: 'createInvites',
        label: 'Criar Convites',
        desc: 'Permite gerar links de convite para trazer novas pessoas ao servidor.',
      },
    ],
  },
];

const DISCORD_ROLE_COLORS = [
  { name: 'Padrão', hex: '#99aab5' },
  { name: 'Verde', hex: '#2ecc71' },
  { name: 'Azul', hex: '#3498db' },
  { name: 'Roxo', hex: '#9b59b6' },
  { name: 'Rosa', hex: '#e91e63' },
  { name: 'Amarelo', hex: '#f1c40f' },
  { name: 'Laranja', hex: '#e67e22' },
  { name: 'Vermelho', hex: '#e74c3c' },
  { name: 'Ciano', hex: '#1abc9c' },
  { name: 'Azul Escuro', hex: '#206694' },
  { name: 'Roxo Escuro', hex: '#71368a' },
  { name: 'Verde Escuro', hex: '#1f8b4c' },
];

const SERVER_TAG_COLORS = [
  { id: 'gold', name: 'Dourado', hex: '#f1c40f', bg: 'bg-[#f1c40f]' },
  { id: 'blurple', name: 'Blurple', hex: '#5865f2', bg: 'bg-[#5865f2]' },
  { id: 'pink', name: 'Rosa', hex: '#eb459e', bg: 'bg-[#eb459e]' },
  { id: 'cyan', name: 'Ciano', hex: '#00b0f4', bg: 'bg-[#00b0f4]' },
  { id: 'mint', name: 'Menta', hex: '#57f287', bg: 'bg-[#57f287]' },
  { id: 'red', name: 'Vermelho', hex: '#ed4245', bg: 'bg-[#ed4245]' },
];

export const DiscordServerSettingsModal: React.FC = () => {
  const {
    isServerSettingsOpen,
    closeServerSettings,
    openServerBoostModal,
    servers,
    activeServerId,
    updateServer,
    roles,
    userRoleMap,
    addRole,
    updateRole,
    deleteRole,
    reorderRoles,
    moveRoleByIndex,
    setUserRoles,
    serverSettingsTab,
    communityMembers,
    getServerMembers,
    deleteServer,
    enableCommunity,
    disableCommunity,
    canUserModerate,
    hasServerPermission,
    currentUser: storeCurrentUser,
    isAuthenticated,
    getAuditLogs,
    addAuditLogEntry,
  } = useDiscord();

  const currentServer = servers.find((s) => s.id === activeServerId) || servers[0];
  const isOfficial = isOfficialCommunity(currentServer);

  const isOwner = Boolean(
    (!isAuthenticated && (storeCurrentUser?.id === 'user-ares' || (storeCurrentUser?.id === 'user-me' && currentServer && currentServer.id !== 'server-lyc' && currentServer.ownerId === 'user-me'))) ||
    (currentServer && storeCurrentUser?.id && currentServer.ownerId === storeCurrentUser.id) ||
    (isOfficial && storeCurrentUser?.id === 'f8fcd139-cf43-4873-bd7d-a807ecd73567')
  );

  const canManageCommunity = isOwner || hasServerPermission('administrator', currentServer?.id) || hasServerPermission('manageCommunity', currentServer?.id);
  const canManageRoles = isOwner || hasServerPermission('administrator', currentServer?.id) || hasServerPermission('manageRoles', currentServer?.id);
  const canManageChannels = isOwner || hasServerPermission('administrator', currentServer?.id) || hasServerPermission('manageChannels', currentServer?.id);
  const canViewAuditLog = isOwner || hasServerPermission('administrator', currentServer?.id) || hasServerPermission('viewAuditLog', currentServer?.id);
  const canModerate = isOwner || hasServerPermission('administrator', currentServer?.id) || hasServerPermission('kickMembers', currentServer?.id) || hasServerPermission('banMembers', currentServer?.id) || hasServerPermission('timeoutMembers', currentServer?.id);
  const canManageExpressions = canManageCommunity;
  const canCreateInvites = isOwner || hasServerPermission('administrator', currentServer?.id) || hasServerPermission('manageCommunity', currentServer?.id) || hasServerPermission('createInvites', currentServer?.id);
  const canManageWebhooks = canManageCommunity;

  const canAccessSettings = isOwner || canManageCommunity || canManageRoles || canManageChannels || canViewAuditLog || canModerate;

  const [activeTab, setActiveTab] = useState<string>(serverSettingsTab || 'server-profile');
  const [hasChanges, setHasChanges] = useState(false);
  const [isDeleteServerModalOpen, setIsDeleteServerModalOpen] = useState(false);
  const [roleSaveError, setRoleSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!canAccessSettings) {
      closeServerSettings();
    }
  }, [canAccessSettings, closeServerSettings]);

  useEffect(() => {
    if (serverSettingsTab) {
      setActiveTab(serverSettingsTab);
    }
  }, [serverSettingsTab]);

  useEffect(() => {
    const isTabPermitted = (tab: string) => {
      switch (tab) {
        case 'server-profile':
        case 'server-tag':
        case 'engagement':
        case 'enable-community':
        case 'server-template':
        case 'security':
        case 'automod':
          return canManageCommunity;
        case 'roles':
          return canManageRoles;
        case 'channels':
          return canManageChannels;
        case 'members':
          return canModerate || canManageRoles || canManageCommunity;
        case 'audit-log':
          return canViewAuditLog;
        case 'bans':
          return canModerate;
        case 'emoji':
        case 'stickers':
        case 'soundboard':
          return canManageExpressions;
        case 'invites':
          return canCreateInvites;
        case 'integrations':
        case 'app-directory':
          return canManageWebhooks;
        default:
          return canManageCommunity;
      }
    };

    if (!isTabPermitted(activeTab)) {
      if (canManageCommunity) setActiveTab('server-profile');
      else if (canManageRoles) setActiveTab('roles');
      else if (canModerate) setActiveTab('members');
      else if (canViewAuditLog) setActiveTab('audit-log');
      else if (canCreateInvites) setActiveTab('invites');
      else if (canManageExpressions) setActiveTab('emoji');
    }
  }, [activeTab, canManageCommunity, canManageRoles, canManageChannels, canModerate, canViewAuditLog, canManageExpressions, canCreateInvites, canManageWebhooks]);

  // 1. Perfil do Servidor State
  const [serverName, setServerName] = useState(currentServer?.name || '');
  const [serverIcon, setServerIcon] = useState(currentServer?.icon || '');
  const [bannerImage, setBannerImage] = useState<string | null>(
    currentServer?.bannerImage || currentServer?.banner || null
  );
  const [selectedGradientId, setSelectedGradientId] = useState<string>(
    currentServer?.bannerColor || 'blurple-purple'
  );
  const [traits, setTraits] = useState<string[]>(
    currentServer?.traits && currentServer.traits.length > 0
      ? currentServer.traits
      : ['Gaming & Competitivo', 'Comunidade Ativa', 'Torneios Semanais', '', '']
  );
  const [description, setDescription] = useState<string>(
    currentServer?.description ||
      'Servidor oficial da LYC Arena. Reúna seus amigos, crie partidas personalizadas, dispute torneios ranqueados e converse por voz com baixa latência!'
  );

  // Selo de Verificação LYC State
  const [isVerified, setIsVerified] = useState<boolean>(currentServer?.isVerified ?? false);
  const [verifiedBadgeStyle, setVerifiedBadgeStyle] = useState<'blue' | 'gold'>(
    currentServer?.verifiedBadgeStyle || 'blue'
  );
  const [serverMemberCount, setServerMemberCount] = useState<number>(
    currentServer?.memberCount ?? 7
  );
  const [serverCreatedAtDaysAgo, setServerCreatedAtDaysAgo] = useState<number>(
    currentServer?.createdAtDaysAgo ?? 60
  );

  // 2. Tag do Servidor State
  const [serverTag, setServerTag] = useState(currentServer?.serverTag || '');
  const [selectedBadge, setSelectedBadge] = useState(currentServer?.serverTagBadge || 'coroa-dourada');
  const [serverTagBadgeImage, setServerTagBadgeImage] = useState<string | null>(
    currentServer?.serverTagBadgeImage || null
  );
  const [selectedTagColor, setSelectedTagColor] = useState(currentServer?.serverTagColor || 'gold');

  // 3. Engajamento State
  const [welcomeRandomMsg, setWelcomeRandomMsg] = useState(currentServer?.welcomeRandomMsg ?? true);
  const [welcomeStickerPrompt, setWelcomeStickerPrompt] = useState(currentServer?.welcomeStickerPrompt ?? true);
  const [boostSystemMsg, setBoostSystemMsg] = useState(currentServer?.boostSystemMsg ?? true);
  const [tipsSystemMsg, setTipsSystemMsg] = useState(currentServer?.tipsSystemMsg ?? false);
  const [systemChannelId, setSystemChannelId] = useState(currentServer?.systemChannelId || 'ch-geral');
  const [activityFeedEnabled, setActivityFeedEnabled] = useState(currentServer?.activityFeedEnabled ?? true);
  const [defaultNotification, setDefaultNotification] = useState<'all' | 'mentions'>(
    currentServer?.defaultNotification || 'mentions'
  );
  const [afkChannelId, setAfkChannelId] = useState(currentServer?.afkChannelId || 'none');
  const [afkTimeout, setAfkTimeout] = useState(currentServer?.afkTimeout || '15');

  // 4. Vantagens de Impulso State
  const [showBoostProgressBar, setShowBoostProgressBar] = useState<boolean>(
    currentServer?.showBoostProgressBar ?? true
  );
  const [serverBoostCount, setServerBoostCount] = useState<number>(
    currentServer?.boostCount ?? 24
  );

  // 5. Cargos State
  const [roleSearch, setRoleSearch] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [draggedRoleId, setDraggedRoleId] = useState<string | null>(null);
  const [dropTargetRoleId, setDropTargetRoleId] = useState<{
    id: string;
    position: 'above' | 'below';
  } | null>(null);
  const [roleSubTab, setRoleSubTab] = useState<'display' | 'permissions' | 'links' | 'members'>('display');
  const [editingRoleName, setEditingRoleName] = useState('');
  const [editingRoleColor, setEditingRoleColor] = useState('#99aab5');
  const [editingRolePermissions, setEditingRolePermissions] = useState<Role['permissions']>({
    viewChannels: true,
    manageChannels: false,
    manageRoles: false,
    kickMembers: false,
    banMembers: false,
    connectVoice: true,
    streamScreen: true,
    administrator: false,
  });

  // 6. Membros State
  const [showMembersInChannelList, setShowMembersInChannelList] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSort, setMemberSort] = useState<'newest' | 'oldest'>('oldest');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberPage, setMemberPage] = useState(1);
  const [activeMemberRoleMenu, setActiveMemberRoleMenu] = useState<string | null>(null);
  const [activeModerationMenu, setActiveModerationMenu] = useState<string | null>(null);
  const [mutedMemberIds, setMutedMemberIds] = useState<string[]>([]);
  const effectiveMemberList = getServerMembers(currentServer.id);
  const [activeMemberList, setActiveMemberList] = useState(effectiveMemberList);

  useEffect(() => {
    setActiveMemberList(getServerMembers(currentServer.id));
  }, [currentServer.id, communityMembers, servers]);

  useEffect(() => {
    if (currentServer?.memberCount !== undefined) {
      setServerMemberCount(currentServer.memberCount);
    } else {
      setServerMemberCount(activeMemberList.length);
    }
  }, [currentServer?.id, currentServer?.memberCount, activeMemberList.length]);

  const serverOnlineCount = useMemo(() => {
    if (currentServer?.onlineCount !== undefined) {
      return currentServer.onlineCount;
    }
    return activeMemberList.filter((m) => m.status !== 'offline').length;
  }, [currentServer?.onlineCount, activeMemberList]);

  const filteredMemberList = useMemo(() => {
    return activeMemberList.filter((u) =>
      (u.displayName || u.name).toLowerCase().includes(memberSearch.toLowerCase())
    );
  }, [activeMemberList, memberSearch]);

  const memberPageSize = 10;
  const memberTotalPages = Math.max(1, Math.ceil(filteredMemberList.length / memberPageSize));
  const paginatedMembers = useMemo(() => {
    const start = (memberPage - 1) * memberPageSize;
    return filteredMemberList.slice(start, start + memberPageSize);
  }, [filteredMemberList, memberPage]);

  const [confirmActionModal, setConfirmActionModal] = useState<{
    type: 'kick' | 'ban';
    user: (typeof mockUsers)[0];
  } | null>(null);

  // Audit Log State & Filters
  const [auditFilterAction, setAuditFilterAction] = useState<string>('all');
  const [auditFilterUser, setAuditFilterUser] = useState<string>('all');
  const auditLogList = getAuditLogs(currentServer?.id || 'server-lyc');
  const availableAuditUsers = Array.from(new Set(auditLogList.map((item) => item.user).filter(Boolean)));

  // 7. Convites State & Modals
  const [areInvitesPaused, setAreInvitesPaused] = useState(false);
  const [copiedInviteCode, setCopiedInviteCode] = useState<string | null>(null);
  const [isCreateInviteModalOpen, setIsCreateInviteModalOpen] = useState(false);
  const [inviteToRevoke, setInviteToRevoke] = useState<{ code: string; creator: string } | null>(null);
  const [newInviteChannel, setNewInviteChannel] = useState<string>(
    currentServer?.categories?.[0]?.channels?.[0]?.name ? `#${currentServer.categories[0].channels[0].name}` : '#chat-geral'
  );
  const [newInviteMaxUses, setNewInviteMaxUses] = useState<number>(0);
  const [newInviteExpires, setNewInviteExpires] = useState<string>('7d');
  const [invitesList, setInvitesList] = useState(
    currentServer?.id === 'server-lyc'
      ? [
          { code: 'Hm9aqnt3c', creator: 'Ares_Admin', channel: '#chat-geral', uses: 24, maxUses: 100, expires: 'Em 6 dias' },
          { code: 'lyc-ranked', creator: 'Valkyrie', channel: '#anuncios', uses: 112, maxUses: 0, expires: 'Nunca' },
          { code: 'x9K2pL81w', creator: 'CyberSamurai', channel: '#geral-2', uses: 5, maxUses: 25, expires: 'Em 2 dias' },
        ]
      : []
  );

  // 8. Acesso State
  const [accessMode, setAccessMode] = useState<'invite' | 'request' | 'discoverable'>(
    currentServer?.accessMode || 'invite'
  );
  const [isNsfw, setIsNsfw] = useState(currentServer?.isNsfw ?? false);
  const [rulesList, setRulesList] = useState<string[]>(
    currentServer?.rules && currentServer.rules.length > 0
      ? currentServer.rules
      : [
          'Comporte-se com respeito e civilidade em todos os canais.',
          'Sem spam, autopromoção não autorizada ou mensagens em massa.',
          'Proibido qualquer conteúdo ofensivo, discriminatório ou ilegal.',
        ]
  );
  const [newRuleInput, setNewRuleInput] = useState('');

  // 9. Emojis & Figurinhas State
  const [emojisList, setEmojisList] = useState(
    currentServer?.id === 'server-lyc'
      ? [
          { id: 'e1', name: 'lyc_fire', char: '🔥', uploadedBy: 'Ares_Admin' },
          { id: 'e2', name: 'gg_wp', char: '🏆', uploadedBy: 'Valkyrie' },
          { id: 'e3', name: 'hype_shield', char: '🛡️', uploadedBy: 'Ares_Admin' },
          { id: 'e4', name: 'cyber_sword', char: '⚔️', uploadedBy: 'CyberSamurai' },
          { id: 'e5', name: 'gg_heart', char: '💖', uploadedBy: 'Luna_Star' },
          { id: 'e6', name: 'lightning_win', char: '⚡', uploadedBy: 'NeonRider' },
        ]
      : []
  );

  // 10. Segurança & Moderação State
  const [verificationLevel, setVerificationLevel] = useState<'none' | 'low' | 'medium' | 'high' | 'highest'>(
    currentServer?.verificationLevel || 'low'
  );
  const [require2FA, setRequire2FA] = useState(currentServer?.require2FA ?? true);
  const [restrictKicksToAdmin, setRestrictKicksToAdmin] = useState(currentServer?.restrictKicksToAdmin ?? true);
  const [explicitContentFilter, setExplicitContentFilter] = useState<'none' | 'noroles' | 'all'>(
    currentServer?.explicitContentFilter || 'noroles'
  );
  const [activityAlerts, setActivityAlerts] = useState(currentServer?.activityAlerts ?? true);

  // Integrations & Templates Feedback State
  const [webhookManagedNotice, setWebhookManagedNotice] = useState(false);
  const [isFollowedChannelsGuideOpen, setIsFollowedChannelsGuideOpen] = useState(false);
  const [botManagedNotice, setBotManagedNotice] = useState(false);
  const [templateCopied, setTemplateCopied] = useState(false);
  const [communityEnabledNotice, setCommunityEnabledNotice] = useState(false);

  // Community Enablement Real State
  const [isEnablingCommunity, setIsEnablingCommunity] = useState(false);
  const [communityActionError, setCommunityActionError] = useState<string | null>(null);
  const [communityActionSuccess, setCommunityActionSuccess] = useState<string | null>(null);

  // Server Template Real State
  const [templateTitle, setTemplateTitle] = useState(currentServer?.name ? `${currentServer.name} (Modelo)` : 'Modelo Oficial CapyChat');
  const [templateDesc, setTemplateDesc] = useState(currentServer?.description || 'Modelo de canais, categorias e cargos.');
  const [generatedTemplateUrl, setGeneratedTemplateUrl] = useState<string | null>(null);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

  // 11. Banimentos State
  const [bannedUsers, setBannedUsers] = useState(
    currentServer?.id === 'server-lyc'
      ? [
          {
            id: 'ban-1',
            name: 'ToxicPlayer_99',
            tag: '6666',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
            reason: 'Uso de linguajar impróprio e spam no chat geral',
          },
          {
            id: 'ban-2',
            name: 'HackAim_Bot',
            tag: '0101',
            avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
            reason: 'Trapaça confirmada em torneio ranqueado oficial',
          },
        ]
      : []
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const badgeFileInputRef = useRef<HTMLInputElement>(null);
  const stickerFileInputRef = useRef<HTMLInputElement>(null);
  const [serverStickers, setServerStickers] = useState<ServerSticker[]>(
    currentServer?.stickers || []
  );

  // Sync state when server changes or modal opens
  useEffect(() => {
    if (currentServer) {
      setServerStickers(currentServer.stickers || []);
      setServerName(currentServer.name);
      setServerIcon(currentServer.icon || '');
      setBannerImage(currentServer.bannerImage || currentServer.banner || null);
      setSelectedGradientId(currentServer.bannerColor || 'blurple-purple');
      setTraits(
        currentServer.traits && currentServer.traits.length > 0
          ? currentServer.traits
          : ['Gaming & Competitivo', 'Comunidade Ativa', 'Torneios Semanais', '', '']
      );
      setDescription(
        currentServer.description ||
          'Servidor oficial da LYC Arena. Reúna seus amigos, crie partidas personalizadas, dispute torneios ranqueados e converse por voz com baixa latência!'
      );
      setServerTag(currentServer.serverTag || '');
      setSelectedBadge(currentServer.serverTagBadge || 'gem');
      setServerTagBadgeImage(currentServer.serverTagBadgeImage || null);
      setSelectedTagColor(currentServer.serverTagColor || 'gold');
      setWelcomeRandomMsg(currentServer.welcomeRandomMsg ?? true);
      setWelcomeStickerPrompt(currentServer.welcomeStickerPrompt ?? true);
      setBoostSystemMsg(currentServer.boostSystemMsg ?? true);
      setTipsSystemMsg(currentServer.tipsSystemMsg ?? false);
      setSystemChannelId(currentServer.systemChannelId || 'ch-geral');
      setActivityFeedEnabled(currentServer.activityFeedEnabled ?? true);
      setDefaultNotification(currentServer.defaultNotification || 'mentions');
      setAfkChannelId(currentServer.afkChannelId || 'none');
      setAfkTimeout(currentServer.afkTimeout || '15');
      setShowBoostProgressBar(currentServer.showBoostProgressBar ?? true);
      setServerBoostCount(currentServer.boostCount ?? 0);
      setAccessMode(currentServer.accessMode || 'invite');
      setIsNsfw(currentServer.isNsfw ?? false);
      setRulesList(
        currentServer.rules && currentServer.rules.length > 0
          ? currentServer.rules
          : [
              'Comporte-se com respeito e civilidade em todos os canais.',
              'Sem spam, autopromoção não autorizada ou mensagens em massa.',
              'Proibido qualquer conteúdo ofensivo, discriminatório ou ilegal.',
            ]
      );
      setVerificationLevel(currentServer.verificationLevel || 'low');
      setRequire2FA(currentServer.require2FA ?? true);
      setRestrictKicksToAdmin(currentServer.restrictKicksToAdmin ?? true);
      setExplicitContentFilter(currentServer.explicitContentFilter || 'noroles');
      setActivityAlerts(currentServer.activityAlerts ?? true);
      setIsVerified(currentServer.isVerified ?? false);
      setVerifiedBadgeStyle(currentServer.verifiedBadgeStyle || 'blue');
      setServerMemberCount(currentServer.memberCount ?? 0);
      setServerCreatedAtDaysAgo(currentServer.createdAtDaysAgo ?? 0);
      setHasChanges(false);
    }
  }, [activeServerId, isServerSettingsOpen]);

  // Sync activeTab when serverSettingsTab changes in the store
  useEffect(() => {
    if (serverSettingsTab) {
      setActiveTab(serverSettingsTab);
    }
  }, [serverSettingsTab]);

  // Sync editing role state when editingRoleId changes
  useEffect(() => {
    if (editingRoleId) {
      const targetRole = roles.find((r) => r.id === editingRoleId);
      if (targetRole) {
        setEditingRoleName(targetRole.name);
        setEditingRoleColor(targetRole.color);
        setEditingRolePermissions({ ...targetRole.permissions });
      }
    }
  }, [editingRoleId, roles]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isServerSettingsOpen) {
        if (editingRoleId) {
          setEditingRoleId(null);
        } else {
          closeServerSettings();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isServerSettingsOpen, editingRoleId, closeServerSettings]);

  if (!isServerSettingsOpen || !currentServer) return null;

  // Flatten channels for dropdowns
  const allChannels = currentServer.categories.flatMap((cat) => cat.channels);
  const textChannels = allChannels.filter((c) => c.type === 'text' || c.type === 'announcement');
  const voiceChannels = allChannels.filter((c) => c.type === 'voice');

  const currentGradient =
    COLOR_GRADIENTS.find((g) => g.id === selectedGradientId) || COLOR_GRADIENTS[5];

  const currentBadgeChar = resolveServerTagBadge(selectedBadge);
  const currentBadgeIcon = resolveServerTagBadgeIcon(selectedBadge, serverTagBadgeImage);
  const currentTagColorObj = resolveServerTagColor(selectedTagColor);

  const handleSaveAll = () => {
    if (canManageCommunity) {
      updateServer(currentServer.id, {
        name: serverName.trim() || currentServer.name,
        icon: serverIcon,
        bannerColor: selectedGradientId,
        bannerImage,
        banner: bannerImage || undefined,
        traits: traits.filter((t) => t.trim().length > 0),
        description: description.trim(),
        serverTag: serverTag.trim(),
        serverTagBadge: selectedBadge,
        serverTagBadgeImage,
        serverTagColor: selectedTagColor,
        welcomeRandomMsg,
        welcomeStickerPrompt,
        boostSystemMsg,
        tipsSystemMsg,
        systemChannelId,
        activityFeedEnabled,
        defaultNotification,
        afkChannelId,
        afkTimeout,
        showBoostProgressBar,
        boostCount: serverBoostCount,
        boostLevel: (serverBoostCount >= 14 ? 3 : serverBoostCount >= 7 ? 2 : serverBoostCount >= 2 ? 1 : 0) as 0 | 1 | 2 | 3,
        accessMode,
        isNsfw,
        rules: rulesList,
        verificationLevel,
        require2FA,
        restrictKicksToAdmin,
        explicitContentFilter,
        activityAlerts,
        isVerified,
        verifiedBadgeStyle,
        memberCount: serverMemberCount,
        createdAtDaysAgo: serverCreatedAtDaysAgo,
        stickers: serverStickers,
      });
    }

    if (editingRoleId && canManageRoles) {
      updateRole(editingRoleId, {
        name: editingRoleName.trim() || 'novo cargo',
        color: editingRoleColor,
        permissions: editingRolePermissions,
      });
    }

    setHasChanges(false);
  };

  const handleResetAll = () => {
    if (currentServer) {
      setServerStickers(currentServer.stickers || []);
      setServerName(currentServer.name);
      setServerIcon(currentServer.icon || '');
      setBannerImage(currentServer.bannerImage || currentServer.banner || null);
      setSelectedGradientId(currentServer.bannerColor || 'blurple-purple');
      setTraits(
        currentServer.traits && currentServer.traits.length > 0
          ? currentServer.traits
          : ['Gaming & Competitivo', 'Comunidade Ativa', 'Torneios Semanais', '', '']
      );
      setDescription(currentServer.description || '');
      setServerTag(currentServer.serverTag || 'LYC');
      setSelectedBadge(currentServer.serverTagBadge || 'coroa-dourada');
      setServerTagBadgeImage(currentServer.serverTagBadgeImage || null);
      setSelectedTagColor(currentServer.serverTagColor || 'gold');
      setWelcomeRandomMsg(currentServer.welcomeRandomMsg ?? true);
      setWelcomeStickerPrompt(currentServer.welcomeStickerPrompt ?? true);
      setBoostSystemMsg(currentServer.boostSystemMsg ?? true);
      setTipsSystemMsg(currentServer.tipsSystemMsg ?? false);
      setSystemChannelId(currentServer.systemChannelId || 'ch-geral');
      setActivityFeedEnabled(currentServer.activityFeedEnabled ?? true);
      setDefaultNotification(currentServer.defaultNotification || 'mentions');
      setAfkChannelId(currentServer.afkChannelId || 'none');
      setAfkTimeout(currentServer.afkTimeout || '15');
      setShowBoostProgressBar(currentServer.showBoostProgressBar ?? true);
      setServerBoostCount(currentServer.boostCount ?? 0);
      setAccessMode(currentServer.accessMode || 'invite');
      setIsNsfw(currentServer.isNsfw ?? false);
      setVerificationLevel(currentServer.verificationLevel || 'low');
      setRequire2FA(currentServer.require2FA ?? true);
      setRestrictKicksToAdmin(currentServer.restrictKicksToAdmin ?? true);
      setExplicitContentFilter(currentServer.explicitContentFilter || 'noroles');
      setActivityAlerts(currentServer.activityAlerts ?? true);
      setIsVerified(currentServer.isVerified ?? false);
      setVerifiedBadgeStyle(currentServer.verifiedBadgeStyle || 'blue');
      setServerMemberCount(currentServer.memberCount ?? 0);
      setServerCreatedAtDaysAgo(currentServer.createdAtDaysAgo ?? 0);
    }
    if (editingRoleId) {
      const target = roles.find((r) => r.id === editingRoleId);
      if (target) {
        setEditingRoleName(target.name);
        setEditingRoleColor(target.color);
        setEditingRolePermissions({ ...target.permissions });
      }
    }
    setHasChanges(false);
  };

  const handleCreateRole = () => {
    if (!canManageRoles) {
      setRoleSaveError('Você não tem permissão para criar cargos.');
      setTimeout(() => setRoleSaveError(null), 3500);
      return;
    }
    const newRoleId = `role-${Date.now()}`;
    const newRole: Role = {
      id: newRoleId,
      name: 'novo cargo',
      color: '#99aab5',
      hoist: true,
      position: roles.length + 1,
      memberCount: 0,
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
    addRole(newRole);
    setEditingRoleId(newRoleId);
    setRoleSubTab('display');
  };

  const toggleMemberRole = async (userId: string, roleId: string) => {
    const currentRoles = userRoleMap[userId] || [];
    let updated: string[];
    if (currentRoles.includes(roleId)) {
      updated = currentRoles.filter((id) => id !== roleId);
    } else {
      updated = [...currentRoles, roleId];
    }
    const res = await setUserRoles(userId, updated, currentServer.id);
    if (res && !res.success && res.error) {
      setRoleSaveError(res.error);
      setTimeout(() => setRoleSaveError(null), 3500);
    }
  };

  const handleAddRule = () => {
    if (newRuleInput.trim()) {
      setRulesList([...rulesList, newRuleInput.trim()]);
      setNewRuleInput('');
      setHasChanges(true);
    }
  };

  const handleAddPresetRule = (ruleText: string) => {
    if (!rulesList.includes(ruleText)) {
      setRulesList([...rulesList, ruleText]);
      setHasChanges(true);
    }
  };

  const handleRemoveRule = (index: number) => {
    setRulesList(rulesList.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleRevokeBan = (banId: string) => {
    setBannedUsers((prev) => prev.filter((b) => b.id !== banId));
  };

  const handleCopyInvite = (code: string) => {
    const fullUrl = `https://capychat.app/invite/${code}`;
    navigator.clipboard.writeText(fullUrl).catch(() => {});
    setCopiedInviteCode(code);
    setTimeout(() => {
      setCopiedInviteCode((prev) => (prev === code ? null : prev));
    }, 2200);
  };

  const handleConfirmRevokeInvite = () => {
    if (!inviteToRevoke) return;
    const targetCode = inviteToRevoke.code;
    setInvitesList((prev) => prev.filter((inv) => inv.code !== targetCode));
    addAuditLogEntry(currentServer.id, {
      user: storeCurrentUser.displayName || storeCurrentUser.name,
      avatar: storeCurrentUser.avatar,
      actionType: 'invite_revoke',
      action: 'revogou o link de convite',
      target: targetCode,
      color: '#f23f43',
    });
    setInviteToRevoke(null);
  };

  const handleGenerateCustomInvite = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const expireLabels: Record<string, string> = {
      '30m': 'Em 30 minutos',
      '1h': 'Em 1 hora',
      '6h': 'Em 6 horas',
      '12h': 'Em 12 horas',
      '1d': 'Em 1 dia',
      '7d': 'Em 7 dias',
      'never': 'Nunca expira',
    };

    const newInvite = {
      code,
      creator: storeCurrentUser.displayName || storeCurrentUser.name,
      channel: newInviteChannel,
      uses: 0,
      maxUses: newInviteMaxUses,
      expires: expireLabels[newInviteExpires] || 'Em 7 dias',
    };

    setInvitesList([newInvite, ...invitesList]);
    setIsCreateInviteModalOpen(false);

    addAuditLogEntry(currentServer.id, {
      user: storeCurrentUser.displayName || storeCurrentUser.name,
      avatar: storeCurrentUser.avatar,
      actionType: 'invite_create',
      action: 'criou um novo link de convite',
      target: code,
      color: '#5865f2',
      details: `Canal: ${newInviteChannel} • Limite: ${newInviteMaxUses ? newInviteMaxUses + ' usos' : 'Ilimitado'} • Validade: ${newInvite.expires}`,
    });
  };

  const handleRevokeInvite = (code: string) => {
    const inv = invitesList.find(i => i.code === code);
    setInviteToRevoke(inv || { code, creator: 'Membro' });
  };

  const handleCreateInvite = () => {
    setIsCreateInviteModalOpen(true);
  };

  const traitIcons = ['🎮', '💬', '🏆', '🎵', '⚡'];

  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(roleSearch.toLowerCase())
  );

  const everyoneRole = roles.find((r) => r.id === 'role-everyone') || roles[roles.length - 1];
  const currentEditingRole = roles.find((r) => r.id === editingRoleId);

  if (!canAccessSettings) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#313338] flex select-none animate-in fade-in duration-150 overflow-hidden font-sans">
      {/* ── 1. SIDEBAR LATERAL ESQUERDA (Estrutura e seções oficiais) ───── */}
      <div className="w-[240px] bg-[#2b2d31] flex flex-col items-end py-10 pr-3 pl-4 border-r border-[#1f2023] overflow-y-auto flex-shrink-0 scrollbar-thin scrollbar-thumb-[#1a1b1e]">
        <div className="w-[200px] space-y-4 text-xs font-semibold">
          {/* Topo: Nome do Servidor em caixa alta sutil */}
          <div className="px-2 pt-2 flex items-center gap-1.5 min-w-0">
            <h3 className="text-[12px] font-bold text-[#949ba4] uppercase tracking-wider truncate">
              {serverName || currentServer.name}
            </h3>
            {isVerified && (
              <LycVerifiedBadge style={verifiedBadgeStyle} size="xs" showTooltip={false} />
            )}
          </div>

          {/* Itens Superiores */}
          {canManageCommunity && (
            <>
              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    setActiveTab('server-profile');
                    setEditingRoleId(null);
                  }}
                  className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                    activeTab === 'server-profile'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                  }`}
                >
                  <span>Perfil do servidor</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('server-tag');
                    setEditingRoleId(null);
                  }}
                  className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                    activeTab === 'server-tag'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                  }`}
                >
                  <span>Tag do servidor</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('engagement');
                    setEditingRoleId(null);
                  }}
                  className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                    activeTab === 'engagement'
                      ? 'bg-[#35373c] text-white font-semibold'
                      : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                  }`}
                >
                  <span>Engajamento</span>
                </button>
              </div>

              <div className="h-[1px] bg-[#3f4147]/50 my-1 mx-2" />
            </>
          )}

          {/* Divisor e Seção EXPRESSÕES */}
          {canManageExpressions && (
            <>
              <div>
                <div className="px-2 py-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider">
                  Expressões
                </div>
                <div className="space-y-0.5 mt-0.5">
                  <button
                    onClick={() => {
                      setActiveTab('emoji');
                      setEditingRoleId(null);
                    }}
                    className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                      activeTab === 'emoji'
                        ? 'bg-[#35373c] text-white font-semibold'
                        : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                    }`}
                  >
                    <span>Emoji</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('stickers');
                      setEditingRoleId(null);
                    }}
                    className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                      activeTab === 'stickers'
                        ? 'bg-[#35373c] text-white font-semibold'
                        : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                    }`}
                  >
                    <span>Figurinhas</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('soundboard');
                      setEditingRoleId(null);
                    }}
                    className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                      activeTab === 'soundboard'
                        ? 'bg-[#35373c] text-white font-semibold'
                        : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                    }`}
                  >
                    <span>Painel de efeitos sonoros</span>
                  </button>
                </div>
              </div>

              <div className="h-[1px] bg-[#3f4147]/50 my-1 mx-2" />
            </>
          )}

          {/* Divisor e Seção PESSOAS */}
          {(canModerate || canManageRoles || canCreateInvites || canManageCommunity) && (
            <div>
              <div className="px-2 py-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider">
                Pessoas
              </div>
              <div className="space-y-0.5 mt-0.5">
                {(canModerate || canManageRoles || canManageCommunity) && (
                  <button
                    onClick={() => {
                      setActiveTab('members');
                      setEditingRoleId(null);
                    }}
                    className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                      activeTab === 'members'
                        ? 'bg-[#35373c] text-white font-semibold'
                        : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                    }`}
                  >
                    <span>Membros</span>
                  </button>
                )}
                {canManageRoles && (
                  <button
                    onClick={() => {
                      setActiveTab('roles');
                      setEditingRoleId(null);
                    }}
                    className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                      activeTab === 'roles'
                        ? 'bg-[#35373c] text-white font-semibold'
                        : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                    }`}
                  >
                    <span>Cargos</span>
                  </button>
                )}
                {canCreateInvites && (
                  <button
                    onClick={() => {
                      setActiveTab('invites');
                      setEditingRoleId(null);
                    }}
                    className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                      activeTab === 'invites'
                        ? 'bg-[#35373c] text-white font-semibold'
                        : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                    }`}
                  >
                    <span>Convites</span>
                  </button>
                )}
                {canManageCommunity && (
                  <button
                    onClick={() => {
                      setActiveTab('access');
                      setEditingRoleId(null);
                    }}
                    className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                      activeTab === 'access'
                        ? 'bg-[#35373c] text-white font-semibold'
                        : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                    }`}
                  >
                    <span>Acesso</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Divisor e Seção APPS */}
          {canManageWebhooks && (
            <>
              <div className="h-[1px] bg-[#3f4147]/50 my-1 mx-2" />
              <div>
                <div className="px-2 py-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider">
                  Apps
                </div>
                <div className="space-y-0.5 mt-0.5">
                  <button
                    onClick={() => {
                      setActiveTab('integrations');
                      setEditingRoleId(null);
                    }}
                    className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                      activeTab === 'integrations'
                        ? 'bg-[#35373c] text-white font-semibold'
                        : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                    }`}
                  >
                    <span>Integrações</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('app-directory');
                      setEditingRoleId(null);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                      activeTab === 'app-directory'
                        ? 'bg-[#35373c] text-white font-semibold'
                        : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                    }`}
                  >
                    <span>Diretório de Apps</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#949ba4]" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Divisor e Seção MODERAÇÃO */}
          {(canManageCommunity || canViewAuditLog || canModerate) && (
            <>
              <div className="h-[1px] bg-[#3f4147]/50 my-1 mx-2" />
              <div>
                <div className="px-2 py-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider">
                  Moderação
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {canManageCommunity && (
                    <button
                      onClick={() => {
                        setActiveTab('security');
                        setEditingRoleId(null);
                      }}
                      className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                        activeTab === 'security'
                          ? 'bg-[#35373c] text-white font-semibold'
                          : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                      }`}
                    >
                      <span>Configurações de Segurança</span>
                    </button>
                  )}
                  {canViewAuditLog && (
                    <button
                      onClick={() => {
                        setActiveTab('audit-log');
                        setEditingRoleId(null);
                      }}
                      className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                        activeTab === 'audit-log'
                          ? 'bg-[#35373c] text-white font-semibold'
                          : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                      }`}
                    >
                      <span>Registro de auditoria</span>
                    </button>
                  )}
                  {canModerate && (
                    <button
                      onClick={() => {
                        setActiveTab('bans');
                        setEditingRoleId(null);
                      }}
                      className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                        activeTab === 'bans'
                          ? 'bg-[#35373c] text-white font-semibold'
                          : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                      }`}
                    >
                      <span>Banimentos</span>
                    </button>
                  )}
                  {canManageCommunity && (
                    <button
                      onClick={() => {
                        setActiveTab('automod');
                        setEditingRoleId(null);
                      }}
                      className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                        activeTab === 'automod'
                          ? 'bg-[#35373c] text-white font-semibold'
                          : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                      }`}
                    >
                      <span>AutoMod</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Itens de rodapé */}
          {(canManageCommunity || isOwner) && (
            <>
              <div className="h-[1px] bg-[#3f4147]/50 my-1 mx-2" />
              <div className="space-y-0.5">
                {canManageCommunity && (
                  <>
                    <button
                      onClick={() => {
                        setActiveTab('enable-community');
                        setEditingRoleId(null);
                      }}
                      className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                        activeTab === 'enable-community'
                          ? 'bg-[#35373c] text-white font-semibold'
                          : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                      }`}
                    >
                      <span>Habilitar comunidade</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('server-template');
                        setEditingRoleId(null);
                      }}
                      className={`w-full flex items-center px-2 py-1.5 rounded-[4px] font-medium text-left transition-colors cursor-pointer ${
                        activeTab === 'server-template'
                          ? 'bg-[#35373c] text-white font-semibold'
                          : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                      }`}
                    >
                      <span>Modelo do servidor</span>
                    </button>
                  </>
                )}
                {isOwner && (
                  <>
                    <div className="h-[1px] bg-[#3f4147]/50 my-1 mx-2" />
                    <button
                      onClick={() => setIsDeleteServerModalOpen(true)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-[4px] font-medium text-left text-[#f23f43] hover:bg-[#f23f43]/15 transition-colors cursor-pointer group"
                    >
                      <span>Excluir servidor</span>
                      <Trash2 className="w-3.5 h-3.5 opacity-80 group-hover:opacity-100" />
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 2. ÁREA DE CONTEÚDO PRINCIPAL (Central) ───── */}
      <div className="flex-1 bg-[#313338] overflow-y-auto px-10 py-10 relative flex justify-start">
        <div className="w-full max-w-[960px] pb-28">
          {/* ========================================================================= */}
          {/* ── 1. ABA: PERFIL DO SERVIDOR ─────────────────────────────────────────── */}
          {/* ========================================================================= */}
          {activeTab === 'server-profile' && (
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">
                Perfil do servidor
              </h2>
              <p className="text-xs text-[#949ba4] mt-1 mb-8 max-w-[620px] leading-relaxed">
                Personalize como seu servidor aparece em links de convite e, se habilitado, em Descoberta de Servidores e mensagens do canal de anúncios.
              </p>

              <div className="flex flex-col lg:flex-row items-start gap-10">
                {/* Coluna Esquerda: Formulário */}
                <div className="flex-1 w-full space-y-7 max-w-[540px]">
                  <div>
                    <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                      NOME DO SERVIDOR
                    </label>
                    <input
                      type="text"
                      value={serverName}
                      onChange={(e) => {
                        setServerName(e.target.value);
                        setHasChanges(true);
                      }}
                      placeholder="Nome do servidor"
                      className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#5c5f66] focus:outline-none focus:border-[#5865f2] transition-colors shadow-inner"
                    />
                  </div>

                  {/* Container Unificado: Ícone e Banner do Servidor */}
                  <div className="bg-[#232428]/80 border border-[#2b2d31] rounded-2xl p-6 space-y-6 shadow-sm backdrop-blur-sm">
                    {/* Bloco 1: Ícone do Servidor */}
                    <div>
                      <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1">
                        ÍCONE DO SERVIDOR
                      </label>
                      <p className="text-xs text-[#949ba4] mb-3">
                        Recomendamos uma imagem quadrada de, pelo menos, 512x512.
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer shadow flex items-center gap-2 active:scale-95"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Alterar ícone do servidor</span>
                        </button>
                        {serverIcon && (
                          <button
                            type="button"
                            onClick={() => {
                              setServerIcon('');
                              setHasChanges(true);
                            }}
                            className="text-[#f23f43] hover:underline text-xs font-medium cursor-pointer transition-colors px-2 py-1"
                          >
                            Remover ícone
                          </button>
                        )}
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                if (ev.target?.result) {
                                  const dataUrl = ev.target.result as string;
                                  setServerIcon(dataUrl);
                                  setHasChanges(true);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </div>
                    </div>

                    <div className="h-[1px] bg-[#2b2d31]" />

                    {/* Bloco 2: Banner / Faixa do Servidor */}
                    <div>
                      <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1">
                        BANNER / FAIXA DO SERVIDOR
                      </label>
                      <p className="text-xs text-[#949ba4] mb-3">
                        Personalize a imagem ou a cor de fundo do cabeçalho do servidor.
                      </p>

                      {/* Botão de Enviar Imagem em destaque antes das cores */}
                      <div className="flex items-center gap-3 mb-4">
                        <button
                          type="button"
                          onClick={() => bannerFileInputRef.current?.click()}
                          className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer shadow flex items-center gap-2 active:scale-95"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Enviar imagem de banner</span>
                        </button>
                        {(bannerImage || selectedGradientId !== 'blurple-purple') && (
                          <button
                            type="button"
                            onClick={() => {
                              setBannerImage(null);
                              setSelectedGradientId('blurple-purple');
                              setHasChanges(true);
                            }}
                            className="text-xs text-[#949ba4] hover:text-[#dbdee1] hover:underline cursor-pointer transition-colors px-2 py-1"
                          >
                            Restaurar padrão
                          </button>
                        )}
                        <input
                          type="file"
                          ref={bannerFileInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                if (ev.target?.result) {
                                  const dataUrl = ev.target.result as string;
                                  setBannerImage(dataUrl);
                                  setHasChanges(true);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                            e.target.value = '';
                          }}
                        />
                      </div>

                      {/* Grade de estilos/gradientes como alternativa rápida */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wider block">
                          Ou selecione um estilo de gradiente:
                        </span>
                        <div className="grid grid-cols-5 gap-2.5">
                          {COLOR_GRADIENTS.map((color) => {
                            const isSelected = !bannerImage && selectedGradientId === color.id;
                            return (
                              <div
                                key={color.id}
                                onClick={() => {
                                  setSelectedGradientId(color.id);
                                  setBannerImage(null);
                                  setHasChanges(true);
                                }}
                                title={color.name}
                                className={`h-10 rounded-xl cursor-pointer bg-gradient-to-r ${color.gradientClass} transition-all relative flex items-center justify-center ${
                                  isSelected
                                    ? 'ring-2 ring-white scale-105 shadow-lg border border-[#1e1f22]'
                                    : 'hover:scale-105 opacity-85 hover:opacity-100'
                                }`}
                              >
                                {isSelected && (
                                  <div className="w-5 h-5 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── SEÇÃO: SELO DE VERIFICAÇÃO OFICIAL LYC (COMPACTA) ───── */}
                  {(() => {
                    const isMemberEligible = serverMemberCount >= 1000;
                    const isAgeEligible = serverCreatedAtDaysAgo >= 30;
                    const isEligible = isMemberEligible && isAgeEligible;

                    const memberProgress = Math.min(100, Math.round((serverMemberCount / 1000) * 100));
                    const ageProgress = Math.min(100, Math.round((serverCreatedAtDaysAgo / 30) * 100));
                    const missingMembers = Math.max(0, 1000 - serverMemberCount);
                    const missingDays = Math.max(0, 30 - serverCreatedAtDaysAgo);

                    return (
                      <div className="bg-[#232428]/80 border border-[#2b2d31] rounded-xl p-3.5 space-y-3 shadow-sm backdrop-blur-sm relative overflow-hidden">
                        {/* Glow ambient background suave */}
                        <div
                          className={`absolute -top-16 -right-16 w-36 h-36 rounded-full blur-2xl pointer-events-none transition-colors duration-500 ${
                            isVerified ? 'bg-[#00a8fc]/10' : 'bg-white/5'
                          }`}
                        />

                        {/* Header da Seção de Verificação - Compacto */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[#1e1f22] border border-[#2b2d31] flex items-center justify-center flex-shrink-0 shadow-inner">
                              <LycVerifiedBadge
                                style="blue"
                                size="sm"
                                showTooltip={false}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-xs font-bold text-white tracking-wide">
                                  Selo de Verificação LYC
                                </h3>
                                {isEligible ? (
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#23a55a]/15 text-[#23a55a] border border-[#23a55a]/30">
                                    Elegível
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#f0b232]/15 text-[#f0b232] border border-[#f0b232]/30">
                                    Requisitos Pendentes
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#949ba4] truncate leading-tight mt-0.5">
                                Insígnia oficial de autenticidade da LYC Arena e CapyChat.
                              </p>
                            </div>
                          </div>

                          {/* Switch de Ativação Compacto */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-semibold text-[#80848e]">
                              {isVerified && isEligible ? 'Ativo' : 'Inativo'}
                            </span>
                            <button
                              type="button"
                              disabled={!isEligible}
                              onClick={() => {
                                if (isEligible) {
                                  setIsVerified(!isVerified);
                                  setVerifiedBadgeStyle('blue');
                                  setHasChanges(true);
                                }
                              }}
                              className={`w-10 h-5 rounded-full transition-all duration-200 p-0.5 flex items-center ${
                                !isEligible
                                  ? 'bg-[#35373c] opacity-50 cursor-not-allowed justify-start'
                                  : isVerified
                                  ? 'bg-[#00a8fc] justify-end shadow-[0_0_10px_rgba(0,168,252,0.4)] cursor-pointer'
                                  : 'bg-[#4e5058] justify-start cursor-pointer hover:bg-[#5c5f66]'
                              }`}
                            >
                              <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                            </button>
                          </div>
                        </div>

                        {/* Requisitos com Barras de Progresso - Compactos em Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* Requisito 1: Membros (mínimo 1.000) */}
                          <div className="bg-[#1e1f22]/90 border border-[#2b2d31] rounded-lg p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[#dbdee1] font-medium flex items-center gap-1.5">
                                <Users className="w-3 h-3 text-[#5865f2]" />
                                Membros Mínimos
                              </span>
                              <span
                                className={`text-[10px] font-bold ${
                                  isMemberEligible ? 'text-[#23a55a]' : 'text-[#f0b232]'
                                }`}
                              >
                                {isMemberEligible ? '✓ Atingido' : `Faltam ${missingMembers.toLocaleString('pt-BR')}`}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-[#2b2d31] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isMemberEligible
                                    ? 'bg-[#23a55a]'
                                    : 'bg-gradient-to-r from-[#5865f2] to-[#00a8fc]'
                                }`}
                                style={{ width: `${memberProgress}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-[#949ba4]">
                              <span>{serverMemberCount.toLocaleString('pt-BR')} atuais</span>
                              <span>Meta: 1.000</span>
                            </div>
                          </div>

                          {/* Requisito 2: Idade do Servidor (mínimo 30 dias / 1 mês) */}
                          <div className="bg-[#1e1f22]/90 border border-[#2b2d31] rounded-lg p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[#dbdee1] font-medium flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-[#00a8fc]" />
                                Idade do Servidor
                              </span>
                              <span
                                className={`text-[10px] font-bold ${
                                  isAgeEligible ? 'text-[#23a55a]' : 'text-[#f0b232]'
                                }`}
                              >
                                {isAgeEligible ? '✓ Atingido' : `Faltam ${missingDays}d`}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-[#2b2d31] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isAgeEligible
                                    ? 'bg-[#23a55a]'
                                    : 'bg-gradient-to-r from-[#00a8fc] to-[#5865f2]'
                                }`}
                                style={{ width: `${ageProgress}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-[#949ba4]">
                              <span>{serverCreatedAtDaysAgo} dias</span>
                              <span>Meta: 30 dias (1 mês)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1">
                      CARACTERÍSTICAS
                    </label>
                    <p className="text-xs text-[#949ba4] mb-3">
                      Adicione até 5 características para mostrar os interesses e a personalidade do seu servidor.
                    </p>
                    <div className="space-y-2">
                      {traits.map((trait, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2.5 bg-[#1e1f22] border border-[#2b2d31] rounded-xl px-3.5 py-2 focus-within:border-[#5865f2] transition-colors shadow-inner"
                        >
                          <span className="text-base select-none">{traitIcons[index]}</span>
                          <input
                            type="text"
                            value={trait}
                            onChange={(e) => {
                              const next = [...traits];
                              next[index] = e.target.value;
                              setTraits(next);
                              setHasChanges(true);
                            }}
                            placeholder={`Característica ${index + 1}`}
                            className="flex-1 bg-transparent text-sm text-white placeholder-[#5c5f66] focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                      DESCRIÇÃO
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setHasChanges(true);
                      }}
                      rows={4}
                      placeholder="Como seu servidor começou? Por que as pessoas devem participar?"
                      className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-xl p-3.5 text-sm text-white placeholder-[#5c5f66] focus:outline-none focus:border-[#5865f2] transition-colors resize-none leading-relaxed shadow-inner"
                    />
                  </div>
                </div>

                {/* Coluna Direita: Server Preview Card */}
                <div className="w-[320px] flex-shrink-0">
                  <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-3">
                    PRÉVIA DO SERVIDOR
                  </label>

                  <div className="w-[320px] rounded-2xl overflow-hidden shadow-2xl border border-[#2b2d31]/80 bg-[#1e1f22]/95 backdrop-blur">
                    <div className="h-28 w-full relative overflow-hidden p-3 flex justify-end items-start">
                      {bannerImage ? (
                        <img
                          src={bannerImage}
                          alt="Banner Preview"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className={`absolute inset-0 w-full h-full bg-gradient-to-r ${currentGradient.gradientClass}`}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />
                    </div>

                    <div className="px-4 pb-4">
                      <div className="relative -mt-10 mb-3 flex items-end justify-between">
                        <div className="w-[72px] h-[72px] rounded-full border-[5px] border-[#1e1f22] bg-[#2b2d31] overflow-hidden flex items-center justify-center shadow-lg">
                          {serverIcon ? (
                            <img
                              src={serverIcon}
                              alt={serverName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl font-bold text-white">
                              {currentServer.initials || serverName.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="pb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#5865f2]/20 text-[#5865f2] border border-[#5865f2]/30">
                            Nível 3
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 min-w-0">
                        <h4 className="text-base font-bold text-white truncate leading-snug">
                          {serverName || currentServer.name}
                        </h4>
                        {isVerified && (
                          <LycVerifiedBadge style={verifiedBadgeStyle} size="sm" showTooltip={true} />
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[#949ba4] font-medium mt-1.5 mb-3">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#23a55a] inline-block" />
                          {serverOnlineCount} online
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#80848e] inline-block" />
                          {serverMemberCount} {serverMemberCount === 1 ? 'membro' : 'membros'}
                        </span>
                      </div>

                      {traits.some((t) => t.trim().length > 0) && (
                        <div className="flex flex-wrap gap-1.5 my-3">
                          {traits
                            .filter((t) => t.trim().length > 0)
                            .map((trait, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#2b2d31] text-[#dbdee1] px-2.5 py-1 rounded-lg border border-[#35373c]"
                              >
                                <span>{traitIcons[idx]}</span>
                                <span>{trait}</span>
                              </span>
                            ))}
                        </div>
                      )}

                      {description && (
                        <p className="text-xs text-[#b5bac1] leading-relaxed line-clamp-3 mb-4 mt-2">
                          {description}
                        </p>
                      )}

                      <div className="pt-3 border-t border-[#2b2d31] flex items-center justify-between text-[11px] text-[#949ba4]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#80848e]" />
                          Desde ago. de 2025
                        </span>
                        <span className="font-mono text-[10px] text-[#80848e]">
                          {currentServer.id}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ── 2. ABA: TAG DO SERVIDOR ────────────────────────────────────────────── */}
          {/* ========================================================================= */}
          {activeTab === 'server-tag' && (() => {
            const isTagBoostUnlocked = (serverBoostCount >= 2) || ((currentServer.boostLevel ?? 0) >= 1);

            return (
              <div className="space-y-7 animate-in fade-in duration-150">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    Tag do servidor
                  </h2>
                  <p className="text-xs text-[#949ba4] mt-1 max-w-xl leading-relaxed">
                    Tags do servidor ajudam outros a encontrar seu servidor e dão aos seus membros uma insígnia exclusiva para exibir no chat e no perfil.
                  </p>
                </div>

                {/* Banner Informativo / Aviso de Bloqueio por Impulso */}
                {!isTagBoostUnlocked ? (
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-[#eb459e]/15 via-[#9b59b6]/15 to-[#5865f2]/15 border border-[#eb459e]/35 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start md:items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#eb459e] via-[#f47fff] to-[#5865f2] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#eb459e]/20">
                        <Lock className="w-6 h-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white tracking-wide">
                            Desbloqueie a Tag do Servidor com Impulso
                          </h3>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f23f43]/20 text-[#f23f43] border border-[#f23f43]/30">
                            Requer Nível 1 ({serverBoostCount}/2 Impulsos)
                          </span>
                        </div>
                        <p className="text-xs text-[#dbdee1] mt-1 leading-relaxed">
                          Este servidor não possui impulsos suficientes para ativar uma Tag. Impulsione o servidor para personalizar a tag de 4 letras, fazer upload de insígnias customizadas e escolher cores exclusivas.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        closeServerSettings();
                        openServerBoostModal();
                      }}
                      className="bg-gradient-to-r from-[#eb459e] via-[#9b59b6] to-[#5865f2] hover:opacity-95 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-transform hover:scale-[1.02] flex-shrink-0 active:scale-95"
                    >
                      {isOfficial ? (
                        <Infinity className="w-4 h-4 text-white" />
                      ) : (
                        <Gem className="w-4 h-4 text-white" />
                      )}
                      <span>Desbloquear com impulso</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-[#5865f2]/15 border border-[#5865f2]/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Info className="w-5 h-5 text-[#5865f2] flex-shrink-0" />
                      <p className="text-xs text-[#dbdee1]">
                        Seu perfil do servidor é privado. Usuários não poderão vê-lo a partir de uma tag do servidor.{' '}
                        <span
                          onClick={() => setActiveTab('server-profile')}
                          className="text-[#5865f2] font-semibold hover:underline cursor-pointer"
                        >
                          Editar configuração
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        closeServerSettings();
                        openServerBoostModal();
                      }}
                      className="text-xs text-[#f47fff] hover:underline font-semibold flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                    >
                      {isOfficial ? (
                        <Infinity className="w-3.5 h-3.5 text-[#f47fff]" />
                      ) : (
                        <Gem className="w-3.5 h-3.5" />
                      )}
                      <span>{serverBoostCount} Impulsos ativos</span>
                    </button>
                  </div>
                )}

                {/* Área de Configuração e Prévia */}
                <div className="flex flex-col lg:flex-row items-start gap-10">
                  {/* Configuração da Tag (Desativada quando sem boost) */}
                  <div className={`flex-1 space-y-6 max-w-md relative transition-all duration-200 ${
                    !isTagBoostUnlocked ? 'opacity-40 pointer-events-none select-none filter grayscale-[35%]' : ''
                  }`}>
                    {/* Badge de bloqueio flutuante contextual quando desativado */}
                    {!isTagBoostUnlocked && (
                      <div className="absolute -top-3 right-0 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111214] border border-[#f23f43]/40 text-[#f23f43] text-[10px] font-bold shadow-lg">
                        <Lock className="w-3 h-3" />
                        <span>Edição bloqueada</span>
                      </div>
                    )}

                    {/* Nome da Tag */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>ESCOLHA UM NOME (MÁX. 4 CARACTERES)</span>
                        {!isTagBoostUnlocked && <Lock className="w-3 h-3 text-[#f23f43]" />}
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-sm select-none flex items-center justify-center w-5 h-5">
                          <img
                            src={currentBadgeIcon}
                            alt="Badge"
                            className="w-5 h-5 object-contain rounded-sm"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </span>
                        <input
                          type="text"
                          maxLength={4}
                          disabled={!isTagBoostUnlocked}
                          value={serverTag}
                          onChange={(e) => {
                            if (!isTagBoostUnlocked) return;
                            setServerTag(e.target.value.toUpperCase());
                            setHasChanges(true);
                          }}
                          placeholder="TAG"
                          className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] pl-10 pr-14 py-2 text-sm font-bold text-white uppercase placeholder-[#5c5f66] focus:outline-none focus:border-[#5865f2] transition-colors disabled:cursor-not-allowed"
                        />
                        <span className="absolute right-3 text-xs font-mono text-[#80848e]">
                          {serverTag.length}/4
                        </span>
                      </div>
                    </div>

                    {/* Escolha uma Insígnia (Híbrida: Upload ou Predefinida) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider flex items-center gap-1.5">
                          <span>INSÍGNIA DA TAG DO SERVIDOR</span>
                          {!isTagBoostUnlocked && <Lock className="w-3 h-3 text-[#f23f43]" />}
                        </label>
                        <span className="text-[11px] text-[#949ba4]">
                          Personalizada ou predefinida
                        </span>
                      </div>

                      {/* Botão de Upload de Imagem */}
                      <div className="flex items-center gap-3 mb-3">
                        <button
                          type="button"
                          disabled={!isTagBoostUnlocked}
                          onClick={() => {
                            if (!isTagBoostUnlocked) return;
                            badgeFileInputRef.current?.click();
                          }}
                          className={`bg-[#5865f2] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow flex items-center gap-2 ${
                            !isTagBoostUnlocked ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#4752c4] cursor-pointer active:scale-95'
                          }`}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Fazer upload de insígnia</span>
                        </button>
                        {serverTagBadgeImage && (
                          <button
                            type="button"
                            disabled={!isTagBoostUnlocked}
                            onClick={() => {
                              if (!isTagBoostUnlocked) return;
                              setServerTagBadgeImage(null);
                              setHasChanges(true);
                            }}
                            className="text-xs text-[#f23f43] hover:underline cursor-pointer transition-colors px-2 py-1 font-medium disabled:cursor-not-allowed"
                          >
                            Remover insígnia customizada
                          </button>
                        )}
                        <input
                          type="file"
                          ref={badgeFileInputRef}
                          disabled={!isTagBoostUnlocked}
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          onChange={(e) => {
                            if (!isTagBoostUnlocked) return;
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                if (ev.target?.result) {
                                  const dataUrl = ev.target.result as string;
                                  setServerTagBadgeImage(dataUrl);
                                  setHasChanges(true);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </div>

                      {/* Card de Insígnia Personalizada Ativa */}
                      {serverTagBadgeImage && (
                        <div className="mb-4 p-4 rounded-2xl bg-[#1e1f22] border-2 border-[#5865f2]/60 flex items-center justify-between gap-4 shadow-xl animate-in fade-in duration-150">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-16 h-16 rounded-xl bg-[#111214] border border-[#35373c] flex items-center justify-center p-2 overflow-hidden shadow-inner flex-shrink-0 relative group">
                              <img
                                src={serverTagBadgeImage}
                                alt="Insígnia personalizada"
                                className="w-full h-full object-contain drop-shadow"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-white truncate">
                                  Insígnia Personalizada
                                </span>
                                <span className="bg-[#5865f2] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Ativa
                                </span>
                              </div>
                              <p className="text-xs text-[#949ba4] leading-relaxed">
                                Preview ampliado em alta fidelidade. Esta imagem é exibida na tag do chat e na lista de membros.
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <button
                              type="button"
                              disabled={!isTagBoostUnlocked}
                              onClick={() => {
                                if (!isTagBoostUnlocked) return;
                                badgeFileInputRef.current?.click();
                              }}
                              className="text-xs text-[#5865f2] hover:text-[#7983f5] font-semibold hover:underline cursor-pointer disabled:cursor-not-allowed"
                            >
                              Trocar imagem
                            </button>
                            <button
                              type="button"
                              disabled={!isTagBoostUnlocked}
                              onClick={() => {
                                if (!isTagBoostUnlocked) return;
                                setServerTagBadgeImage(null);
                                setHasChanges(true);
                              }}
                              className="text-xs text-[#f23f43] hover:underline transition-colors font-medium cursor-pointer disabled:cursor-not-allowed"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Grelha de Insígnias Predefinidas */}
                      <div className="grid grid-cols-5 gap-2.5">
                        {SERVER_TAG_BADGES.map((b) => {
                          const isSelected = !serverTagBadgeImage && selectedBadge === b.id;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              disabled={!isTagBoostUnlocked}
                              onClick={() => {
                                if (!isTagBoostUnlocked) return;
                                setSelectedBadge(b.id);
                                setServerTagBadgeImage(null);
                                setHasChanges(true);
                              }}
                              title={b.name}
                              className={`h-[50px] rounded-lg border flex items-center justify-center p-2 transition-all group ${
                                !isTagBoostUnlocked
                                  ? 'bg-[#1e1f22]/50 border-[#232428] cursor-not-allowed opacity-50'
                                  : isSelected
                                  ? 'bg-[#35373c] border-white shadow scale-105 cursor-pointer ring-1 ring-white/50'
                                  : 'bg-[#1e1f22] border-[#232428] hover:bg-[#2b2d31] hover:border-[#35373c] cursor-pointer'
                              }`}
                            >
                              <img
                                src={b.iconUrl}
                                alt={b.name}
                                className="w-8 h-8 object-contain pointer-events-none select-none transition-transform group-hover:scale-110 drop-shadow-sm"
                                style={{ imageRendering: 'pixelated' }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Escolha Cor com Color Picker Livre */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider flex items-center gap-1.5">
                          <span>ESCOLHA UMA COR</span>
                          {!isTagBoostUnlocked && <Lock className="w-3 h-3 text-[#f23f43]" />}
                        </label>
                        <span className="text-[11px] font-mono text-[#949ba4] font-semibold">
                          {currentTagColorObj.hex.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Cores Predefinidas */}
                        {SERVER_TAG_COLORS.map((col) => {
                          const isSelected = selectedTagColor === col.id;
                          return (
                            <button
                              key={col.id}
                              type="button"
                              disabled={!isTagBoostUnlocked}
                              onClick={() => {
                                if (!isTagBoostUnlocked) return;
                                setSelectedTagColor(col.id);
                                setHasChanges(true);
                              }}
                              title={col.name}
                              className={`w-8 h-8 rounded-full transition-all flex items-center justify-center ${
                                col.bg
                              } ${
                                !isTagBoostUnlocked
                                  ? 'cursor-not-allowed opacity-50'
                                  : isSelected
                                  ? 'ring-2 ring-white scale-110 shadow-lg cursor-pointer'
                                  : 'hover:scale-105 cursor-pointer'
                              }`}
                            >
                              {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                            </button>
                          );
                        })}

                        {/* Divisor vertical */}
                        <div className="h-6 w-[1px] bg-[#3f4147] mx-1" />

                        {/* Seletor de Cor Livre (Color Picker RGB/Hex) */}
                        {(() => {
                          const isCustomColor = selectedTagColor.startsWith('#');
                          return (
                            <div className="flex items-center gap-2">
                              <label
                                title={isTagBoostUnlocked ? 'Seletor de cor personalizada (clique para escolher qualquer tom)' : 'Bloqueado'}
                                className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all overflow-hidden border border-white/20 shadow ${
                                  !isTagBoostUnlocked
                                    ? 'cursor-not-allowed opacity-50'
                                    : isCustomColor
                                    ? 'ring-2 ring-white scale-110 shadow-lg cursor-pointer'
                                    : 'hover:scale-105 cursor-pointer'
                                }`}
                                style={{
                                  backgroundColor: isCustomColor ? selectedTagColor : '#2b2d31',
                                }}
                              >
                                <input
                                  type="color"
                                  disabled={!isTagBoostUnlocked}
                                  value={isCustomColor ? selectedTagColor : '#5865f2'}
                                  onChange={(e) => {
                                    if (!isTagBoostUnlocked) return;
                                    setSelectedTagColor(e.target.value);
                                    setHasChanges(true);
                                  }}
                                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                                />
                                {isCustomColor ? (
                                  <Check className="w-4 h-4 text-white drop-shadow pointer-events-none" />
                                ) : (
                                  <Pipette className="w-3.5 h-3.5 text-[#dbdee1] pointer-events-none" />
                                )}
                              </label>

                              {/* Input Hex manual com validação e prefixo */}
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  maxLength={7}
                                  disabled={!isTagBoostUnlocked}
                                  value={isCustomColor ? selectedTagColor : ''}
                                  placeholder="#HEX"
                                  onChange={(e) => {
                                    if (!isTagBoostUnlocked) return;
                                    let val = e.target.value;
                                    if (val.length > 0 && !val.startsWith('#')) val = '#' + val;
                                    setSelectedTagColor(val);
                                    setHasChanges(true);
                                  }}
                                  className="w-[84px] bg-[#1e1f22] border border-[#2b2d31] rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-white uppercase placeholder-[#5c5f66] focus:outline-none focus:border-[#5865f2] transition-colors disabled:cursor-not-allowed"
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Prévia no Chat */}
                  <div className="w-[340px] flex-shrink-0 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                        PRÉVIA NO CHAT
                      </label>
                      {!isTagBoostUnlocked && (
                        <span className="text-[10px] font-bold text-[#eb459e] uppercase tracking-wide flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          Prévia do Benefício
                        </span>
                      )}
                    </div>
                    <div className="p-4 rounded-xl bg-[#1e1f22] border border-[#2b2d31] shadow-2xl space-y-3 relative overflow-hidden">
                      {!isTagBoostUnlocked && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded bg-[#eb459e]/15 border border-[#eb459e]/30 text-[#eb459e] text-[9px] font-bold">
                          <Gem className="w-2.5 h-2.5" />
                          Requer Boost
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <img
                          src={currentUser.avatar}
                          alt="Avatar"
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            {/* Tag Aplicada (à esquerda do nome) */}
                            <span
                              className="inline-flex items-center gap-1.5 text-[11px] font-black px-2 py-0.5 rounded shadow-sm leading-none flex-shrink-0"
                              style={{
                                backgroundColor: `${currentTagColorObj.hex}25`,
                                color: currentTagColorObj.hex,
                                border: `1px solid ${currentTagColorObj.hex}50`,
                              }}
                            >
                              <img
                                src={currentBadgeIcon}
                                alt="Badge"
                                className="w-5 h-5 object-contain rounded-sm flex-shrink-0"
                                style={{ imageRendering: 'pixelated' }}
                              />
                              <span className="leading-none">{serverTag || 'TAG'}</span>
                            </span>

                            <span className="font-bold text-sm text-white truncate min-w-0">
                              {currentUser.displayName || currentUser.name}
                            </span>

                            <span className="text-[10px] text-[#949ba4]">Hoje às 14:20</span>
                          </div>
                          <p className="text-xs text-[#dbdee1] mt-1 leading-relaxed">
                            {isTagBoostUnlocked
                              ? 'Aqui está como sua tag do servidor é exibida para todos os membros nas conversas!'
                              : 'Esta é uma prévia de como sua tag exclusiva será exibida assim que o servidor for impulsionado.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* ── 3. ABA: ENGAJAMENTO ────────────────────────────────────────────────── */}
          {/* ========================================================================= */}
          {activeTab === 'engagement' && (
            <div className="space-y-8 animate-in fade-in duration-150 max-w-2xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">
                  Engajamento
                </h2>
                <p className="text-xs text-[#949ba4] mt-1 leading-relaxed">
                  Personalize como novos membros são recebidos e gerencie avisos de atividades automáticas.
                </p>
              </div>

              {/* Mensagens do Sistema */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#b5bac1] uppercase tracking-wider">
                  MENSAGENS DO SISTEMA
                </h3>

                <div className="p-4 rounded-lg bg-[#2b2d31] border border-[#232428] space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#dbdee1] mb-1.5">
                      Canal de mensagens do sistema
                    </label>
                    <select
                      value={systemChannelId}
                      onChange={(e) => {
                        setSystemChannelId(e.target.value);
                        setHasChanges(true);
                      }}
                      className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2] transition-colors cursor-pointer"
                    >
                      <option value="none">Nenhum canal de mensagens do sistema</option>
                      {textChannels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          #{ch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="divide-y divide-[#232428] pt-2">
                    {[
                      {
                        title: 'Enviar uma mensagem aleatória de boas-vindas quando alguém entrar nesse servidor.',
                        val: welcomeRandomMsg,
                        set: setWelcomeRandomMsg,
                      },
                      {
                        title: 'Incentive membros a responderem mensagens de boas-vindas com uma figurinha.',
                        val: welcomeStickerPrompt,
                        set: setWelcomeStickerPrompt,
                      },
                      {
                        title: 'Enviar uma mensagem quando alguém impulsionar esse servidor.',
                        val: boostSystemMsg,
                        set: setBoostSystemMsg,
                      },
                      {
                        title: 'Enviar dicas úteis para configuração do servidor.',
                        val: tipsSystemMsg,
                        set: setTipsSystemMsg,
                      },
                    ].map((item, i) => (
                      <div key={i} className="py-2.5 flex items-center justify-between gap-4">
                        <span className="text-xs text-[#dbdee1]">{item.title}</span>
                        <button
                          onClick={() => {
                            item.set(!item.val);
                            setHasChanges(true);
                          }}
                          className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer flex items-center flex-shrink-0 ${
                            item.val ? 'bg-[#23a55a] justify-end' : 'bg-[#4e5058] justify-start'
                          }`}
                        >
                          <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feed de Atividades */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#b5bac1] uppercase tracking-wider">
                  FEED DE ATIVIDADES
                </h3>
                <div className="p-4 rounded-lg bg-[#2b2d31] border border-[#232428] flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-white">
                      Exibir feed de atividade neste servidor
                    </h4>
                    <p className="text-[11px] text-[#949ba4] mt-0.5">
                      Mostra o que os membros estão jogando, transmitindo e ouvindo em um painel lateral.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActivityFeedEnabled(!activityFeedEnabled);
                      setHasChanges(true);
                    }}
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer flex items-center flex-shrink-0 ${
                      activityFeedEnabled ? 'bg-[#23a55a] justify-end' : 'bg-[#4e5058] justify-start'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                  </button>
                </div>
              </div>

              {/* Notificação Padrão */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#b5bac1] uppercase tracking-wider">
                  CONFIGURAÇÕES DE NOTIFICAÇÃO PADRÃO
                </h3>
                <div className="space-y-2">
                  <div
                    onClick={() => {
                      setDefaultNotification('all');
                      setHasChanges(true);
                    }}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${
                      defaultNotification === 'all'
                        ? 'bg-[#35373c] border-[#5865f2]'
                        : 'bg-[#2b2d31] border-[#232428] hover:bg-[#35373c]/50'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        defaultNotification === 'all' ? 'border-[#5865f2]' : 'border-[#949ba4]'
                      }`}
                    >
                      {defaultNotification === 'all' && (
                        <div className="w-2 h-2 rounded-full bg-[#5865f2]" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Todas as mensagens</h4>
                      <p className="text-[11px] text-[#949ba4]">Recomendado apenas para servidores pequenos com amigos.</p>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setDefaultNotification('mentions');
                      setHasChanges(true);
                    }}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${
                      defaultNotification === 'mentions'
                        ? 'bg-[#35373c] border-[#5865f2]'
                        : 'bg-[#2b2d31] border-[#232428] hover:bg-[#35373c]/50'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        defaultNotification === 'mentions' ? 'border-[#5865f2]' : 'border-[#949ba4]'
                      }`}
                    >
                      {defaultNotification === 'mentions' && (
                        <div className="w-2 h-2 rounded-full bg-[#5865f2]" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Apenas @menções</h4>
                      <p className="text-[11px] text-[#949ba4]">Recomendado para servidores públicos e comunidades grandes.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Canal de Ausentes */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#b5bac1] uppercase tracking-wider">
                  CANAL DE AUSENTES (AFK)
                </h3>
                <div className="p-4 rounded-lg bg-[#2b2d31] border border-[#232428] grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#dbdee1] mb-1.5">
                      Canal de ausentes
                    </label>
                    <select
                      value={afkChannelId}
                      onChange={(e) => {
                        setAfkChannelId(e.target.value);
                        setHasChanges(true);
                      }}
                      className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2] transition-colors cursor-pointer"
                    >
                      <option value="none">Nenhum canal de ausentes</option>
                      {voiceChannels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          🔊 {ch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#dbdee1] mb-1.5">
                      Limite de ausência
                    </label>
                    <select
                      value={afkTimeout}
                      onChange={(e) => {
                        setAfkTimeout(e.target.value);
                        setHasChanges(true);
                      }}
                      className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2] transition-colors cursor-pointer"
                    >
                      <option value="1">1 minuto</option>
                      <option value="5">5 minutos</option>
                      <option value="15">15 minutos</option>
                      <option value="30">30 minutos</option>
                      <option value="60">1 hora</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ── 4. ABA: VANTAGENS DE IMPULSO ───────────────────────────────────────── */}
          {/* ========================================================================= */}
          {/* ========================================================================= */}
          {/* ── 4. ABA: VANTAGENS DE IMPULSO ───────────────────────────────────────── */}
          {/* ========================================================================= */}
          {activeTab === 'roles' && !editingRoleId && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Cargos</h2>
                <p className="text-xs text-[#949ba4] mt-1">
                  Use os cargos para agrupar os membros do seu servidor e atribuir permissões.
                </p>
              </div>

              {/* Card de Topo: Permissões Padrão (@everyone) */}
              <div
                onClick={() => {
                  setEditingRoleId(everyoneRole.id);
                  setRoleSubTab('display');
                }}
                className="w-full flex items-center justify-between p-4 rounded-lg bg-[#2b2d31] hover:bg-[#35373c]/70 border border-[#232428] cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-[#1e1f22] flex items-center justify-center text-[#949ba4] group-hover:text-white transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Permissões padrão</h3>
                    <p className="text-xs text-[#949ba4]">
                      @everyone • vale para todos os membros do servidor
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#949ba4] group-hover:text-white transition-colors" />
              </div>

              {/* Barra de Ações: Busca + Botão Criar Cargo */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <input
                      type="text"
                      value={roleSearch}
                      onChange={(e) => setRoleSearch(e.target.value)}
                      placeholder="Buscar cargos"
                      className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] pl-8 pr-3 py-2 text-xs text-white placeholder-[#80848e] focus:outline-none focus:border-[#5865f2] transition-colors"
                    />
                    <Search className="w-4 h-4 text-[#80848e] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>

                  <button
                    onClick={handleCreateRole}
                    className="flex items-center gap-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold px-4 py-2 rounded-[3px] transition-colors cursor-pointer shadow"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Criar cargo</span>
                  </button>
                </div>

                <p className="text-[11px] text-[#949ba4] leading-relaxed">
                  Os membros usam a cor do cargo mais alto que eles possuem nesta lista. Arraste os cargos para reordenar.
                </p>
              </div>

              {/* Tabela de Cargos */}
              <div className="bg-[#2b2d31]/50 border border-[#232428] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#2b2d31] text-[11px] font-bold text-[#949ba4] uppercase tracking-wider border-b border-[#232428]">
                  <span>CARGOS — {roles.length}</span>
                  <span>MEMBROS</span>
                </div>

                <div className="divide-y divide-[#232428]">
                  {filteredRoles.map((role) => {
                    const isEveryone = role.id === 'role-everyone';
                    const isDragging = draggedRoleId === role.id;
                    const isDropAbove = dropTargetRoleId?.id === role.id && dropTargetRoleId.position === 'above';
                    const isDropBelow = dropTargetRoleId?.id === role.id && dropTargetRoleId.position === 'below';
                    const count = Object.values(userRoleMap).filter((arr) =>
                      arr.includes(role.id)
                    ).length;

                    return (
                      <div key={role.id} className="relative">
                        {/* Indicador de soltar acima */}
                        {isDropAbove && (
                          <div className="h-[2px] bg-[#5865f2] rounded-full mx-3 my-0.5 shadow-[0_0_8px_rgba(88,101,242,0.8)] transition-all animate-pulse" />
                        )}

                        <div
                          draggable={!isEveryone}
                          onDragStart={(e) => {
                            if (isEveryone) return;
                            e.dataTransfer.setData('text/plain', role.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedRoleId(role.id);
                          }}
                          onDragEnd={() => {
                            setDraggedRoleId(null);
                            setDropTargetRoleId(null);
                          }}
                          onDragOver={(e) => {
                            if (!draggedRoleId || draggedRoleId === role.id || isEveryone) return;
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = 'move';
                            const rect = e.currentTarget.getBoundingClientRect();
                            const position = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
                            setDropTargetRoleId({ id: role.id, position });
                          }}
                          onDragLeave={(e) => {
                            const related = e.relatedTarget as Node | null;
                            if (!e.currentTarget.contains(related)) {
                              if (dropTargetRoleId?.id === role.id) setDropTargetRoleId(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!draggedRoleId || draggedRoleId === role.id || isEveryone) {
                              setDraggedRoleId(null);
                              setDropTargetRoleId(null);
                              return;
                            }

                            const moveableRoles = roles.filter((r) => r.id !== 'role-everyone');
                            const fromIdx = moveableRoles.findIndex((r) => r.id === draggedRoleId);
                            const toIdx = moveableRoles.findIndex((r) => r.id === role.id);

                            if (fromIdx !== -1 && toIdx !== -1) {
                              let targetIndex = dropTargetRoleId?.position === 'below' ? toIdx + 1 : toIdx;
                              if (fromIdx < targetIndex) {
                                targetIndex = Math.max(0, targetIndex - 1);
                              }
                              moveRoleByIndex(fromIdx, targetIndex);
                            }

                            setDraggedRoleId(null);
                            setDropTargetRoleId(null);
                          }}
                          onClick={() => {
                            setEditingRoleId(role.id);
                            setRoleSubTab('display');
                          }}
                          className={`flex items-center justify-between px-4 py-3 hover:bg-[#35373c]/50 transition-all cursor-pointer group select-none ${
                            isDragging ? 'opacity-40 bg-[#35373c]/80 scale-[0.99]' : ''
                          } ${
                            isDropAbove || isDropBelow ? 'bg-[#5865f2]/10' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Grip handle for reordering */}
                            {!isEveryone ? (
                              <div
                                title="Arraste para reordenar"
                                className="text-[#80848e] group-hover:text-white cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-white/5 transition-colors"
                              >
                                <GripVertical className="w-4 h-4 flex-shrink-0" />
                              </div>
                            ) : (
                              <div title="Cargo bloqueado na base da hierarquia" className="p-0.5 text-[#80848e]">
                                <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                              </div>
                            )}

                            <div
                              className="w-3.5 h-3.5 rounded-full shadow-sm flex-shrink-0"
                              style={{ backgroundColor: role.color }}
                            />
                            <span
                              className="text-sm font-semibold text-white group-hover:underline"
                              style={{ color: role.color !== '#99aab5' ? role.color : '#dbdee1' }}
                            >
                              {role.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-6">
                            <span className="text-xs text-[#949ba4] flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-[#80848e]" />
                              {isEveryone ? serverMemberCount : count || role.memberCount || 0}
                            </span>

                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <button
                                onClick={() => {
                                  setEditingRoleId(role.id);
                                  setRoleSubTab('display');
                                }}
                                title="Editar cargo"
                                className="p-1.5 text-[#949ba4] hover:text-white rounded hover:bg-[#35373c] transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              {!isEveryone && role.base_role !== 'OWNER' && (isOwner || (role.position ?? 0) < Math.max(0, ...roles.filter(r => (userRoleMap[storeCurrentUser?.id] || []).includes(r.id)).map(r => r.position ?? 0))) && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Excluir cargo "${role.name}"?`)) {
                                      deleteRole(role.id);
                                    }
                                  }}
                                  title="Excluir cargo"
                                  className="p-1.5 text-[#949ba4] hover:text-[#f23f43] rounded hover:bg-[#35373c] transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Indicador de soltar abaixo */}
                        {isDropBelow && (
                          <div className="h-[2px] bg-[#5865f2] rounded-full mx-3 my-0.5 shadow-[0_0_8px_rgba(88,101,242,0.8)] transition-all animate-pulse" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* MODO DE EDIÇÃO DO CARGO */}
          {activeTab === 'roles' && editingRoleId && currentEditingRole && (
            <div className="flex items-start gap-8 animate-in fade-in duration-150">
              <div className="w-52 flex-shrink-0 bg-[#2b2d31] rounded-lg p-3 space-y-3 border border-[#232428]">
                <div className="flex items-center justify-between pb-2 border-b border-[#35373c]">
                  <button
                    onClick={() => setEditingRoleId(null)}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#949ba4] hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>VOLTAR</span>
                  </button>
                  <button
                    onClick={handleCreateRole}
                    title="Adicionar cargo"
                    className="p-1 text-[#949ba4] hover:text-white hover:bg-[#35373c] rounded transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-0.5 max-h-[480px] overflow-y-auto scrollbar-thin">
                  {roles.map((r) => {
                    const isSelected = r.id === editingRoleId;
                    const isEveryone = r.id === 'role-everyone';
                    const isDragging = draggedRoleId === r.id;
                    const isDropAbove = dropTargetRoleId?.id === r.id && dropTargetRoleId.position === 'above';
                    const isDropBelow = dropTargetRoleId?.id === r.id && dropTargetRoleId.position === 'below';

                    return (
                      <div key={r.id} className="relative">
                        {isDropAbove && (
                          <div className="h-[2px] bg-[#5865f2] rounded-full mx-1 my-0.5 shadow-[0_0_8px_rgba(88,101,242,0.8)] transition-all animate-pulse" />
                        )}

                        <div
                          draggable={!isEveryone}
                          onDragStart={(e) => {
                            if (isEveryone) return;
                            e.dataTransfer.setData('text/plain', r.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedRoleId(r.id);
                          }}
                          onDragEnd={() => {
                            setDraggedRoleId(null);
                            setDropTargetRoleId(null);
                          }}
                          onDragOver={(e) => {
                            if (!draggedRoleId || draggedRoleId === r.id || isEveryone) return;
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = 'move';
                            const rect = e.currentTarget.getBoundingClientRect();
                            const position = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
                            setDropTargetRoleId({ id: r.id, position });
                          }}
                          onDragLeave={(e) => {
                            const related = e.relatedTarget as Node | null;
                            if (!e.currentTarget.contains(related)) {
                              if (dropTargetRoleId?.id === r.id) setDropTargetRoleId(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!draggedRoleId || draggedRoleId === r.id || isEveryone) {
                              setDraggedRoleId(null);
                              setDropTargetRoleId(null);
                              return;
                            }

                            const moveableRoles = roles.filter((role) => role.id !== 'role-everyone');
                            const fromIdx = moveableRoles.findIndex((role) => role.id === draggedRoleId);
                            const toIdx = moveableRoles.findIndex((role) => role.id === r.id);

                            if (fromIdx !== -1 && toIdx !== -1) {
                              let targetIndex = dropTargetRoleId?.position === 'below' ? toIdx + 1 : toIdx;
                              if (fromIdx < targetIndex) {
                                targetIndex = Math.max(0, targetIndex - 1);
                              }
                              moveRoleByIndex(fromIdx, targetIndex);
                            }

                            setDraggedRoleId(null);
                            setDropTargetRoleId(null);
                          }}
                          onClick={() => {
                            setEditingRoleId(r.id);
                            setRoleSubTab('display');
                          }}
                          className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] text-xs font-semibold transition-all cursor-pointer text-left group select-none ${
                            isDragging ? 'opacity-40 bg-[#35373c]' : ''
                          } ${
                            isSelected
                              ? 'bg-[#35373c] text-white'
                              : 'text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]'
                          }`}
                        >
                          {!isEveryone ? (
                            <GripVertical className="w-3 h-3 text-[#80848e] opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                          ) : (
                            <Lock className="w-3 h-3 text-[#80848e] opacity-40 flex-shrink-0" />
                          )}
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: r.color }}
                          />
                          <span className="truncate">{r.name}</span>
                        </div>

                        {isDropBelow && (
                          <div className="h-[2px] bg-[#5865f2] rounded-full mx-1 my-0.5 shadow-[0_0_8px_rgba(88,101,242,0.8)] transition-all animate-pulse" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    EDITAR CARGO — {editingRoleName.toUpperCase()}
                  </h3>

                  <div className="flex items-center gap-6 border-b border-[#35373c] mt-4 text-xs font-semibold">
                    <button
                      onClick={() => setRoleSubTab('display')}
                      className={`pb-2 transition-colors cursor-pointer border-b-2 ${
                        roleSubTab === 'display'
                          ? 'border-white text-white'
                          : 'border-transparent text-[#949ba4] hover:text-[#dbdee1]'
                      }`}
                    >
                      Exibição
                    </button>
                    <button
                      onClick={() => setRoleSubTab('permissions')}
                      className={`pb-2 transition-colors cursor-pointer border-b-2 ${
                        roleSubTab === 'permissions'
                          ? 'border-white text-white'
                          : 'border-transparent text-[#949ba4] hover:text-[#dbdee1]'
                      }`}
                    >
                      Permissões
                    </button>
                    <button
                      onClick={() => setRoleSubTab('members')}
                      className={`pb-2 transition-colors cursor-pointer border-b-2 ${
                        roleSubTab === 'members'
                          ? 'border-white text-white'
                          : 'border-transparent text-[#949ba4] hover:text-[#dbdee1]'
                      }`}
                    >
                      Gerenciar membros
                    </button>
                    <button
                      onClick={() => setRoleSubTab('links')}
                      className={`pb-2 transition-colors cursor-pointer border-b-2 ${
                        roleSubTab === 'links'
                          ? 'border-white text-white'
                          : 'border-transparent text-[#949ba4] hover:text-[#dbdee1]'
                      }`}
                    >
                      Links
                    </button>
                  </div>
                </div>

                {roleSubTab === 'display' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                        NOME DO CARGO *
                      </label>
                      <input
                        type="text"
                        value={editingRoleName}
                        onChange={(e) => {
                          setEditingRoleName(e.target.value);
                          setHasChanges(true);
                        }}
                        placeholder="Nome do cargo"
                        className="w-full max-w-md bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5865f2] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                        COR DO CARGO *
                      </label>
                      <p className="text-xs text-[#949ba4] mb-3">
                        Os membros usam a cor do cargo mais alto que eles possuem na hierarquia.
                      </p>

                      <div className="flex flex-wrap items-center gap-3 max-w-md mb-4">
                        {DISCORD_ROLE_COLORS.map((col) => {
                          const isSelected = editingRoleColor.toLowerCase() === col.hex.toLowerCase();
                          return (
                            <button
                              key={col.hex}
                              onClick={() => {
                                setEditingRoleColor(col.hex);
                                setHasChanges(true);
                              }}
                              title={col.name}
                              className={`w-8 h-8 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                                isSelected ? 'ring-2 ring-white scale-110 shadow' : 'hover:scale-105'
                              }`}
                              style={{ backgroundColor: col.hex }}
                            >
                              {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                            </button>
                          );
                        })}

                        <div className="flex items-center gap-2 bg-[#1e1f22] border border-[#232428] rounded px-2 py-1">
                          <input
                            type="color"
                            value={editingRoleColor}
                            onChange={(e) => {
                              setEditingRoleColor(e.target.value);
                              setHasChanges(true);
                            }}
                            className="w-6 h-6 rounded bg-transparent border-none cursor-pointer"
                          />
                          <span className="text-xs font-mono text-[#b5bac1] uppercase">
                            {editingRoleColor}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                        PRÉVIA NO CHAT
                      </label>
                      <div className="p-4 rounded-lg bg-[#2b2d31] border border-[#232428] max-w-lg space-y-2 shadow-inner">
                        <div className="flex items-start gap-3">
                          <img
                            src={currentUser.avatar}
                            alt="Avatar"
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span
                                className="font-semibold text-sm hover:underline cursor-pointer"
                                style={{ color: editingRoleColor }}
                              >
                                {currentUser.displayName || currentUser.name}
                              </span>
                              <span className="text-[10px] text-[#949ba4]">Hoje às 13:37</span>
                            </div>
                            <p className="text-xs text-[#dbdee1] mt-0.5 leading-relaxed">
                              Esta é uma mensagem de visualização para testar a legibilidade da cor do cargo contra o fundo escuro do CapyChat.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {roleSubTab === 'permissions' && (
                  <div className="space-y-6 max-w-xl pb-8">
                    <p className="text-xs text-[#949ba4]">
                      Configure os privilégios granulares deste cargo para canais, mensagens, moderação e voz.
                    </p>

                    {ROLE_PERMISSION_CATEGORIES.map((section) => {
                      const userModeration = canUserModerate(storeCurrentUser.id, undefined, currentServer?.id);
                      const isCurrentAdmin = isOwner || userModeration.isAdmin;

                      return (
                        <div key={section.title} className="space-y-3">
                          <div className="border-b border-[#35363c] pb-1.5">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                              {section.title}
                            </h3>
                            <p className="text-[11px] text-[#949ba4] mt-0.5">{section.description}</p>
                          </div>

                          <div className="space-y-2">
                            {section.permissions.map((perm) => {
                              const isChecked = !!(editingRolePermissions as any)[perm.key];
                              const canToggle = isOwner || (perm.key === 'administrator'
                                ? (isCurrentAdmin && hasServerPermission('administrator', currentServer?.id))
                                : (isCurrentAdmin || (!perm.adminOnly && hasServerPermission(perm.key, currentServer?.id))));

                              return (
                                <div
                                  key={perm.key}
                                  className={`p-3 rounded-lg border transition-colors flex items-center justify-between ${
                                    perm.isDanger
                                      ? 'bg-[#f23f43]/10 border-[#f23f43]/30'
                                      : 'bg-[#2b2d31] border-[#232428]'
                                  }`}
                                >
                                  <div className="pr-4">
                                    <h4
                                      className={`text-sm font-semibold flex items-center gap-2 ${
                                        perm.isDanger ? 'text-[#f23f43]' : 'text-white'
                                      }`}
                                    >
                                      <span>{perm.label}</span>
                                      {perm.adminOnly && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#f23f43]/20 text-[#f23f43] font-bold uppercase tracking-wider">
                                          Admin
                                        </span>
                                      )}
                                    </h4>
                                    <p className="text-xs text-[#949ba4] mt-0.5">{perm.desc}</p>
                                    {!canToggle && (
                                      <p className="text-[10px] text-[#f23f43] mt-1 font-medium">
                                        Você não possui permissão para conceder este privilégio.
                                      </p>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    disabled={!canToggle}
                                    onClick={() => {
                                      if (!canToggle) return;
                                      setEditingRolePermissions((prev) => ({
                                        ...prev,
                                        [perm.key]: !isChecked,
                                      }));
                                      setHasChanges(true);
                                    }}
                                    title={!canToggle ? 'Permissão bloqueada por falta de privilégio' : undefined}
                                    className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center flex-shrink-0 ${
                                      !canToggle ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                    } ${
                                      isChecked ? 'bg-[#23a55a] justify-end' : 'bg-[#4e5058] justify-start'
                                    }`}
                                  >
                                    <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {roleSubTab === 'members' && (
                  <div className="space-y-4 max-w-xl">
                    {roleSaveError && (
                      <div className="p-3 bg-[#f23f43]/15 border border-[#f23f43]/30 rounded text-xs text-[#f23f43] font-medium">
                        {roleSaveError}
                      </div>
                    )}
                    <p className="text-xs text-[#949ba4]">
                      Adicione ou remova membros deste cargo diretamente.
                    </p>

                    <div className="divide-y divide-[#232428] bg-[#2b2d31] border border-[#232428] rounded-lg">
                      {activeMemberList.map((user) => {
                        const userRoles = userRoleMap[user.id] || [];
                        const hasRole = userRoles.includes(editingRoleId);

                        return (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-3 hover:bg-[#35373c]/40 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={user.avatar}
                                alt={user.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                              <div>
                                <span className="text-sm font-semibold text-white block">
                                  {user.displayName || user.name}
                                </span>
                                <span className="text-[11px] text-[#949ba4]">@{user.name}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => toggleMemberRole(user.id, editingRoleId)}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-[4px] transition-colors cursor-pointer flex items-center gap-1.5 ${
                                hasRole
                                  ? 'bg-[#f23f43]/15 text-[#f23f43] hover:bg-[#f23f43]/25'
                                  : 'bg-[#5865f2] text-white hover:bg-[#4752c4]'
                              }`}
                            >
                              {hasRole ? (
                                <>
                                  <UserMinus className="w-3.5 h-3.5" />
                                  <span>Remover</span>
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>Adicionar</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {roleSubTab === 'links' && (
                  <div className="p-8 rounded-lg bg-[#2b2d31]/50 border border-[#232428] text-center space-y-2 max-w-lg">
                    <Layers className="w-8 h-8 text-[#5865f2] mx-auto" />
                    <h4 className="text-sm font-bold text-white">Requisitos de Cargo</h4>
                    <p className="text-xs text-[#949ba4]">
                      Permite vincular este cargo a conexões do CapyChat (Twitch, YouTube, Steam) ou códigos de convite específicos.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ── 6. ABA: MEMBROS (LISTA COMPLETA 1:1) ───────────────────────────────── */}
          {/* ========================================================================= */}
          {activeTab === 'members' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {roleSaveError && (
                <div className="p-3 bg-[#f23f43]/15 border border-[#f23f43]/30 rounded text-xs text-[#f23f43] font-medium">
                  {roleSaveError}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    Membros do Servidor — {activeMemberList.length}
                  </h2>
                  <p className="text-xs text-[#949ba4] mt-1">
                    Gerencie os membros do seu servidor, atribua cargos e acompanhe histórico de entrada.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#dbdee1]">Mostrar na lista de canais</span>
                  <button
                    onClick={() => setShowMembersInChannelList(!showMembersInChannelList)}
                    className={`w-10 h-5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                      showMembersInChannelList ? 'bg-[#23a55a] justify-end' : 'bg-[#4e5058] justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                  </button>
                </div>
              </div>

              {/* Barra de Ferramentas */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Pesquisar pelo nome de usuário ou apelido"
                    className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] pl-8 pr-3 py-2 text-xs text-white placeholder-[#80848e] focus:outline-none focus:border-[#5865f2] transition-colors"
                  />
                  <Search className="w-4 h-4 text-[#80848e] absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={memberSort}
                    onChange={(e) => setMemberSort(e.target.value as any)}
                    className="bg-[#2b2d31] border border-[#232428] rounded px-3 py-1.5 text-xs text-white cursor-pointer focus:outline-none"
                  >
                    <option value="oldest">Ordenar: Mais antigo</option>
                    <option value="newest">Ordenar: Mais recente</option>
                  </select>

                  {selectedMemberIds.length > 0 && (
                    <button
                      onClick={() => {
                        if (confirm(`Remover ${selectedMemberIds.length} membros selecionados?`)) {
                          setSelectedMemberIds([]);
                        }
                      }}
                      className="bg-[#f23f43] hover:bg-[#d83a3e] text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors cursor-pointer"
                    >
                      Remover ({selectedMemberIds.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Tabela Completa de Membros */}
              <div className="bg-[#2b2d31]/50 border border-[#232428] rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2.5 bg-[#2b2d31] text-[11px] font-bold text-[#949ba4] uppercase tracking-wider border-b border-[#232428] items-center">
                  <div className="col-span-1 flex items-center">
                    <input
                      type="checkbox"
                      checked={activeMemberList.length > 0 && selectedMemberIds.length === activeMemberList.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMemberIds(activeMemberList.map((u) => u.id));
                        } else {
                          setSelectedMemberIds([]);
                        }
                      }}
                      className="rounded border-[#35373c] bg-[#1e1f22] cursor-pointer"
                    />
                  </div>
                  <div className="col-span-4">NOME</div>
                  <div className="col-span-2">MEMBRO DESDE</div>
                  <div className="col-span-2">INGRESSOU NO CAPYCHAT</div>
                  <div className="col-span-3 text-right">CARGOS</div>
                </div>

                <div className="divide-y divide-[#232428]">
                  {paginatedMembers.map((user: User, idx: number) => {
                      const isSelected = selectedMemberIds.includes(user.id);
                      const isMuted = mutedMemberIds.includes(user.id);
                      const assignedRoleIds = userRoleMap[user.id] || [];
                      const assignedRoles = roles.filter((r) => assignedRoleIds.includes(r.id));

                      const memberSinceText = `${idx * 2 + 1} dias atrás`;
                      const discordJoinText = `${idx + 1} anos atrás`;

                      return (
                        <div
                          key={user.id}
                          className="grid grid-cols-12 px-4 py-3 hover:bg-[#35373c]/40 transition-colors items-center text-xs"
                        >
                          <div className="col-span-1 flex items-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMemberIds([...selectedMemberIds, user.id]);
                                } else {
                                  setSelectedMemberIds(
                                    selectedMemberIds.filter((id) => id !== user.id)
                                  );
                                }
                              }}
                              className="rounded border-[#35373c] bg-[#1e1f22] cursor-pointer"
                            />
                          </div>

                          <div className="col-span-4 flex items-center gap-3 min-w-0">
                            <div className="relative flex-shrink-0">
                              <img
                                src={user.avatar}
                                alt={user.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#2b2d31] ${
                                  user.status === 'online'
                                    ? 'bg-[#23a55a]'
                                    : user.status === 'idle'
                                    ? 'bg-[#f0b232]'
                                    : user.status === 'dnd'
                                    ? 'bg-[#f23f43]'
                                    : 'bg-[#80848e]'
                                }`}
                              />
                            </div>
                            <div className="truncate min-w-0">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-semibold text-white truncate">
                                  {user.displayName || user.name}
                                </span>
                                {isMuted && (
                                  <span className="text-[10px] bg-[#f0b232]/20 text-[#f0b232] font-bold px-1.5 py-0.2 rounded uppercase">
                                    Silenciado
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[#949ba4] truncate block">
                                @{user.name}#{user.tag || '0001'}
                              </span>
                            </div>
                          </div>

                          <div className="col-span-2 text-[#949ba4] text-[11px]">
                            {memberSinceText}
                          </div>

                          <div className="col-span-2 text-[#949ba4] text-[11px]">
                            {discordJoinText}
                          </div>

                          <div className="col-span-3 flex items-center justify-end gap-1.5 flex-wrap">
                            {assignedRoles.map((r) => (
                              <span
                                key={r.id}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1e1f22] border border-[#35373c]"
                                style={{ color: r.color }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: r.color }}
                                />
                                <span className="truncate max-w-[80px]">{r.name}</span>
                              </span>
                            ))}

                            {/* Dropdown de Atribuição de Cargos */}
                            <div className="relative">
                              <button
                                onClick={() => {
                                  setActiveModerationMenu(null);
                                  setActiveMemberRoleMenu(
                                    activeMemberRoleMenu === user.id ? null : user.id
                                  );
                                }}
                                title="Atribuir cargo"
                                className="p-1 rounded bg-[#1e1f22] text-[#949ba4] hover:text-white hover:bg-[#35373c] transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>

                              {activeMemberRoleMenu === user.id && (
                                <div className="absolute right-0 top-7 w-48 bg-[#111214] border border-[#232428] rounded shadow-2xl p-1 z-30 space-y-0.5 text-xs text-left">
                                  {roles.map((r) => {
                                    const hasRole = assignedRoleIds.includes(r.id);
                                    return (
                                      <button
                                        key={r.id}
                                        onClick={() => toggleMemberRole(user.id, r.id)}
                                        className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#5865f2] hover:text-white text-[#dbdee1] transition-colors cursor-pointer"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: r.color }}
                                          />
                                          <span className="truncate">{r.name}</span>
                                        </div>
                                        {hasRole && <Check className="w-3.5 h-3.5" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Menu de Moderação Rápida (Silenciar, Expulsar, Banir) */}
                            <div className="relative">
                              <button
                                onClick={() => {
                                  setActiveMemberRoleMenu(null);
                                  setActiveModerationMenu(
                                    activeModerationMenu === user.id ? null : user.id
                                  );
                                }}
                                title="Ações de Moderação"
                                className="p-1 rounded bg-[#1e1f22] text-[#949ba4] hover:text-white hover:bg-[#35373c] transition-colors cursor-pointer"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {activeModerationMenu === user.id && (
                                <div className="absolute right-0 top-7 w-44 bg-[#111214] border border-[#232428] rounded shadow-2xl p-1 z-30 space-y-0.5 text-xs text-left select-none">
                                  <button
                                    onClick={() => {
                                      setMutedMemberIds((prev) =>
                                        isMuted ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                                      );
                                      addAuditLogEntry(currentServer.id, {
                                        user: storeCurrentUser.displayName || storeCurrentUser.name,
                                        avatar: storeCurrentUser.avatar,
                                        actionType: 'mute',
                                        action: isMuted ? 'removeu silenciamento de' : 'silenciou o membro',
                                        target: user.displayName || user.name,
                                        color: '#f0b232',
                                      });
                                      setActiveModerationMenu(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#35373c] text-[#dbdee1] transition-colors cursor-pointer"
                                  >
                                    <Volume2 className="w-3.5 h-3.5 text-[#f0b232]" />
                                    <span>{isMuted ? 'Desmutar' : 'Silenciar'}</span>
                                  </button>

                                  <div className="h-[1px] bg-[#232428] my-1" />

                                  <button
                                    onClick={() => {
                                      setConfirmActionModal({ type: 'kick', user });
                                      setActiveModerationMenu(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#f23f43] hover:text-white text-[#f23f43] transition-colors cursor-pointer"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                    <span>Expulsar</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setConfirmActionModal({ type: 'ban', user });
                                      setActiveModerationMenu(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#da373c] hover:text-white text-[#da373c] transition-colors cursor-pointer"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                    <span>Banir</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between text-xs text-[#949ba4] pt-2">
                <span>
                  Mostrando {paginatedMembers.length} de {filteredMemberList.length} {filteredMemberList.length === 1 ? 'membro' : 'membros'}
                </span>
                {memberTotalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      disabled={memberPage === 1}
                      onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded bg-[#2b2d31] hover:bg-[#35373c] text-white disabled:opacity-40 cursor-pointer"
                    >
                      Anterior
                    </button>
                    {Array.from({ length: memberTotalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setMemberPage(page)}
                        className={`w-7 h-7 rounded text-xs font-semibold cursor-pointer ${
                          memberPage === page
                            ? 'bg-[#5865f2] text-white'
                            : 'bg-[#2b2d31] text-[#949ba4] hover:bg-[#35373c] hover:text-white'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      disabled={memberPage === memberTotalPages}
                      onClick={() => setMemberPage((p) => Math.min(memberTotalPages, p + 1))}
                      className="px-2.5 py-1 rounded bg-[#2b2d31] hover:bg-[#35373c] text-white disabled:opacity-40 cursor-pointer"
                    >
                      Próximo
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ── 7. ABA: CONVITES ───────────────────────────────────────────────────── */}
          {/* ========================================================================= */}
          {activeTab === 'invites' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                    <LinkIcon className="w-5 h-5 text-[#5865f2]" />
                    <span>Convites</span>
                    <span className="text-xs text-[#949ba4] font-normal bg-[#2b2d31] px-2 py-0.5 rounded-full">
                      {invitesList.length}
                    </span>
                  </h2>
                  <p className="text-xs text-[#949ba4] mt-1">
                    Gerencie os links de convite ativos, controle limites de uso, expiração e permissões de entrada.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => setAreInvitesPaused(!areInvitesPaused)}
                    className={`text-xs font-semibold px-3 py-2 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                      areInvitesPaused
                        ? 'bg-[#f23f43] text-white shadow'
                        : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] border border-[#3f4147]'
                    }`}
                    title={areInvitesPaused ? 'Reativar convites' : 'Pausar novos acessos via link'}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{areInvitesPaused ? 'Convites Pausados' : 'Pausar Convites'}</span>
                  </button>

                  <button
                    onClick={handleCreateInvite}
                    className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer shadow flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Criar Link de Convite</span>
                  </button>
                </div>
              </div>

              {/* Pause Warning Banner */}
              {areInvitesPaused && (
                <div className="bg-[#f23f43]/15 border border-[#f23f43]/40 rounded-xl p-3.5 flex items-start gap-3 animate-in fade-in">
                  <AlertTriangle className="w-5 h-5 text-[#f23f43] flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-[#f23f43] leading-relaxed">
                    <strong className="font-bold">Atenção: Os convites estão pausados temporariamente.</strong>
                    <p className="text-[#dbdee1] text-[11px] mt-0.5">
                      Nenhum novo membro conseguirá entrar no servidor através dos links existentes enquanto a pausa estiver ativa.
                    </p>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {invitesList.length === 0 ? (
                <div className="py-16 px-6 text-center bg-[#2b2d31]/30 rounded-2xl border border-[#232428] space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#5865f2]/15 text-[#5865f2] border border-[#5865f2]/30 flex items-center justify-center mx-auto">
                    <LinkIcon className="w-7 h-7" />
                  </div>
                  <div className="max-w-md mx-auto">
                    <h3 className="font-bold text-white text-base">Nenhum convite ativo</h3>
                    <p className="text-xs text-[#949ba4] mt-1 leading-relaxed">
                      Crie um link de convite personalizado para compartilhar com amigos ou em suas redes e convidar pessoas para este servidor.
                    </p>
                  </div>
                  <button
                    onClick={handleCreateInvite}
                    className="inline-flex items-center gap-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Criar Primeiro Convite</span>
                  </button>
                </div>
              ) : (
                /* Invites Modern Cards List */
                <div className="space-y-3">
                  {invitesList.map((inv) => {
                    const isCopied = copiedInviteCode === inv.code;
                    const percentUsed = inv.maxUses > 0 ? Math.min(100, (inv.uses / inv.maxUses) * 100) : 0;

                    return (
                      <div
                        key={inv.code}
                        className="bg-[#1e1f22] hover:bg-[#232428] border border-[#2b2d31] rounded-xl p-4 transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                      >
                        {/* Info Left */}
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#5865f2]/10 border border-[#5865f2]/30 flex items-center justify-center text-[#5865f2] flex-shrink-0 mt-0.5">
                            <LinkIcon className="w-5 h-5" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-bold text-white bg-[#111214] px-2.5 py-0.5 rounded border border-[#2b2d31] tracking-wide select-all">
                                {inv.code}
                              </span>
                              <span className="text-xs text-[#949ba4] flex items-center gap-1 font-medium bg-[#111214]/60 px-2 py-0.5 rounded border border-[#232428]">
                                <Hash className="w-3 h-3 text-[#80848e]" />
                                {inv.channel.replace('#', '')}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1.5 text-xs text-[#949ba4] flex-wrap">
                              <span>
                                Criado por <strong className="text-[#dbdee1] font-semibold">{inv.creator}</strong>
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-[#b5bac1]">
                                <Clock className="w-3 h-3 text-[#80848e]" />
                                {inv.expires}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Stats & Actions Right */}
                        <div className="flex items-center gap-4 flex-wrap justify-between md:justify-end">
                          {/* Uses Indicator */}
                          <div className="flex flex-col md:items-end min-w-[100px]">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                              <Users className="w-3.5 h-3.5 text-[#5865f2]" />
                              <span>
                                {inv.uses} {inv.maxUses > 0 ? `/ ${inv.maxUses} usos` : 'usos • Ilimitado'}
                              </span>
                            </div>
                            {inv.maxUses > 0 && (
                              <div className="w-24 h-1.5 bg-[#111214] rounded-full overflow-hidden mt-1.5 border border-[#2b2d31]">
                                <div
                                  className="h-full bg-[#5865f2] rounded-full transition-all"
                                  style={{ width: `${percentUsed}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyInvite(inv.code)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                isCopied
                                  ? 'bg-[#23a55a] text-white shadow-md'
                                  : 'bg-[#2b2d31] hover:bg-[#35373c] text-white border border-[#3f4147]'
                              }`}
                              title="Copiar link completo de convite"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copiar Link</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => setInviteToRevoke(inv)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-[#f23f43] hover:bg-[#f23f43]/15 transition-colors cursor-pointer"
                              title="Revogar este convite permanentemente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Revogar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ── 8. ABA: ACESSO ─────────────────────────────────────────────────────── */}
          {/* ========================================================================= */}
          {activeTab === 'access' && (
            <div className="space-y-8 animate-in fade-in duration-150 max-w-2xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Acesso</h2>
                <p className="text-xs text-[#949ba4] mt-1">
                  Defina como novos membros entram no seu servidor e configure as diretrizes de conduta.
                </p>
              </div>

              {/* Seletor de Modo de Entrada */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#b5bac1] uppercase tracking-wider">
                  MODO DE ENTRADA
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { id: 'invite', title: 'Apenas por convite', desc: 'Membros entram apenas com um link válido.', icon: Lock },
                    { id: 'request', title: 'Mediante solicitação', desc: 'Membros solicitam e devem ser aprovados.', icon: Mail },
                    { id: 'discoverable', title: 'Descobrível', desc: 'Aberto para todos na busca da comunidade.', icon: Globe },
                  ].map((mode) => {
                    const isSelected = accessMode === mode.id;
                    const Icon = mode.icon;
                    return (
                      <div
                        key={mode.id}
                        onClick={() => {
                          setAccessMode(mode.id as any);
                          setHasChanges(true);
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                          isSelected
                            ? 'bg-[#35373c] border-[#5865f2] shadow'
                            : 'bg-[#2b2d31] border-[#232428] hover:bg-[#35373c]/50'
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 ${
                            isSelected ? 'text-[#5865f2]' : 'text-[#949ba4]'
                          }`}
                        />
                        <h4 className="text-xs font-bold text-white">{mode.title}</h4>
                        <p className="text-[11px] text-[#949ba4] leading-relaxed">
                          {mode.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Servidor com Restrição de Idade (NSFW) */}
              <div className="p-4 rounded-lg bg-[#2b2d31] border border-[#232428] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">
                    Servidor com restrição de idade (NSFW)
                  </h4>
                  <p className="text-[11px] text-[#949ba4] mt-0.5">
                    Exige confirmação de maioridade (+18) antes que novos membros possam entrar.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsNsfw(!isNsfw);
                    setHasChanges(true);
                  }}
                  className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer flex items-center flex-shrink-0 ${
                    isNsfw ? 'bg-[#f23f43] justify-end' : 'bg-[#4e5058] justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Regras do Servidor */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#b5bac1] uppercase tracking-wider">
                  REGRAS DO SERVIDOR
                </h3>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newRuleInput}
                      onChange={(e) => setNewRuleInput(e.target.value)}
                      placeholder="Insira uma regra para o servidor..."
                      className="flex-1 bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2] transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddRule();
                      }}
                    />
                    <button
                      onClick={handleAddRule}
                      className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold px-4 py-2 rounded-[3px] transition-colors cursor-pointer"
                    >
                      + Adicionar regra
                    </button>
                  </div>

                  {/* Chips de Exemplo */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      'Comporte-se e mostre respeito',
                      'Nada de spam ou correntes',
                      'Sem conteúdo NSFW ou gore',
                      'Sem autopromoção em DMs',
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAddPresetRule(chip)}
                        className="text-[11px] bg-[#1e1f22] hover:bg-[#35373c] text-[#949ba4] hover:text-white px-2.5 py-1 rounded-full border border-[#232428] transition-colors cursor-pointer"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista de Regras Ativas */}
                <div className="divide-y divide-[#232428] bg-[#2b2d31] border border-[#232428] rounded-lg">
                  {rulesList.map((rule, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 text-xs text-[#dbdee1]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#1e1f22] flex items-center justify-center text-[10px] font-bold text-[#949ba4]">
                          {idx + 1}
                        </span>
                        <span>{rule}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveRule(idx)}
                        className="text-[#949ba4] hover:text-[#f23f43] p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ── 9. ABA: EMOJI ──────────────────────────────────────────────────────── */}
          {/* ========================================================================= */}
          {activeTab === 'emoji' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    Emojis do Servidor
                  </h2>
                  <p className="text-xs text-[#949ba4] mt-1">
                    Adicione até 50 emojis personalizados para os membros usarem nos chats deste servidor.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const name = prompt('Digite o nome do emoji (sem espaços):');
                    if (name) {
                      setEmojisList([
                        ...emojisList,
                        { id: `e-${Date.now()}`, name, char: '⭐', uploadedBy: currentUser.name },
                      ]);
                      setHasChanges(true);
                    }
                  }}
                  className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold px-4 py-2 rounded-[3px] transition-colors cursor-pointer shadow"
                >
                  Enviar emoji
                </button>
              </div>

              {/* Contador */}
              <div className="p-3.5 rounded-lg bg-[#2b2d31] border border-[#232428] flex items-center justify-between text-xs">
                <span className="text-[#dbdee1] font-semibold">
                  Emojis: {50 - emojisList.length} espaços restantes de 50
                </span>
                <div className="w-48 bg-[#1e1f22] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#5865f2] h-full rounded-full"
                    style={{ width: `${(emojisList.length / 50) * 100}%` }}
                  />
                </div>
              </div>

              {/* Tabela de Emojis */}
              <div className="bg-[#2b2d31]/50 border border-[#232428] rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2.5 bg-[#2b2d31] text-[11px] font-bold text-[#949ba4] uppercase tracking-wider border-b border-[#232428]">
                  <div className="col-span-2">IMAGEM</div>
                  <div className="col-span-5">NOME</div>
                  <div className="col-span-4">ENVIADO POR</div>
                  <div className="col-span-1 text-right">AÇÕES</div>
                </div>

                <div className="divide-y divide-[#232428]">
                  {emojisList.map((emoji) => (
                    <div
                      key={emoji.id}
                      className="grid grid-cols-12 px-4 py-3 hover:bg-[#35373c]/40 transition-colors items-center text-xs group"
                    >
                      <div className="col-span-2 text-2xl select-none">{emoji.char}</div>
                      <div className="col-span-5 font-mono text-[#5865f2] font-semibold">
                        :{emoji.name}:
                      </div>
                      <div className="col-span-4 text-[#949ba4] flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-[#80848e]" />
                        <span>{emoji.uploadedBy}</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          onClick={() => {
                            setEmojisList(emojisList.filter((e) => e.id !== emoji.id));
                            setHasChanges(true);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-[#949ba4] hover:text-[#f23f43] transition-all cursor-pointer p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ── 10. ABA: FIGURINHAS ────────────────────────────────────────────────── */}
          {/* ========================================================================= */}
          {activeTab === 'stickers' && (() => {
            const isBoostLevel1 = serverBoostCount >= 2;
            const isBoostLevel2 = serverBoostCount >= 7;
            const isBoostLevel3 = serverBoostCount >= 14;
            const totalUnlockedStickerSlots = isBoostLevel3 ? 60 : isBoostLevel2 ? 35 : isBoostLevel1 ? 20 : 5;

            const renderStickerSlot = (index: number) => {
              const sticker = serverStickers[index];
              if (sticker) {
                return (
                  <div
                    key={sticker.id || index}
                    className="h-44 rounded-2xl border border-[#35373c] bg-[#1e1f22] p-3 flex flex-col items-center justify-between shadow-md relative group transition-all duration-200 hover:border-[#5865f2]/80"
                  >
                    <div className="w-full flex justify-between items-center text-[10px] text-[#949ba4] font-bold uppercase tracking-wider">
                      <span>Slot {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setServerStickers((prev) => prev.filter((_, i) => i !== index));
                          setHasChanges(true);
                        }}
                        className="text-[#f23f43] hover:underline font-semibold cursor-pointer text-[10px]"
                      >
                        Remover
                      </button>
                    </div>

                    <div className="w-16 h-16 flex items-center justify-center p-1 overflow-hidden my-auto">
                      <img
                        src={sticker.url}
                        alt={sticker.name}
                        className="w-full h-full object-contain drop-shadow transition-transform duration-200 group-hover:scale-110"
                      />
                    </div>

                    <div className="w-full text-center space-y-0.5">
                      <p className="text-xs font-bold text-white truncate max-w-full" title={sticker.name}>
                        {sticker.name}
                      </p>
                      <p className="text-[10px] text-[#949ba4] truncate">
                        Carregado por: Ares_Admin
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={index}
                  onClick={() => stickerFileInputRef.current?.click()}
                  className="h-44 rounded-2xl border-2 border-dashed border-[#35373c] hover:border-[#5865f2] bg-[#1e1f22]/40 hover:bg-[#2b2d31]/50 flex flex-col items-center justify-center p-3 gap-2.5 cursor-pointer transition-all duration-200 group shadow-sm hover:shadow-md"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#2b2d31] group-hover:bg-[#5865f2] flex items-center justify-center text-[#80848e] group-hover:text-white transition-all shadow-inner">
                    <Upload className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
                  </div>
                  <div className="text-center space-y-0.5">
                    <div className="text-xs font-bold text-[#dbdee1] group-hover:text-white transition-colors">
                      + Slot {index + 1}
                    </div>
                    <div className="text-[11px] text-[#80848e] group-hover:text-[#dbdee1] transition-colors">
                      Enviar figurinha
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <div className="space-y-8 animate-in fade-in duration-150 max-w-4xl pb-10">
                {/* Header com título e botão Enviar figurinha */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                      <Sticker className="w-5 h-5 text-[#8B5CF6]" />
                      <span>Figurinhas do Servidor</span>
                    </h2>
                    <p className="text-xs text-[#949ba4] mt-1 leading-relaxed">
                      Carregue figurinhas personalizadas para todos os membros interagirem nos chats de texto.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      ref={stickerFileInputRef}
                      accept="image/png,image/apng,image/gif,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (serverStickers.length >= totalUnlockedStickerSlots) {
                            alert(`Limite de ${totalUnlockedStickerSlots} espaços atingido para o nível atual de impulso! Impulsione o servidor para desbloquear mais slots.`);
                            e.target.value = '';
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            if (ev.target?.result) {
                              const dataUrl = ev.target.result as string;
                              const baseName = file.name.replace(/\.[^/.]+$/, '').slice(0, 30);
                              setServerStickers((prev) => [
                                ...prev,
                                {
                                  id: `sticker-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                                  name: baseName || `Figurinha #${prev.length + 1}`,
                                  url: dataUrl,
                                  tags: 'servidor, custom',
                                },
                              ]);
                              setHasChanges(true);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => stickerFileInputRef.current?.click()}
                      disabled={serverStickers.length >= totalUnlockedStickerSlots}
                      className={`text-xs font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow flex items-center gap-2 active:scale-95 ${
                        serverStickers.length >= totalUnlockedStickerSlots
                          ? 'bg-[#35373c] text-[#80848e] cursor-not-allowed'
                          : 'bg-[#5865f2] hover:bg-[#4752c4] text-white'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      <span>Enviar figurinha</span>
                    </button>
                  </div>
                </div>

                {/* Linha vertical de progresso lateral à esquerda ligando os níveis */}
                <div className="relative pl-9 sm:pl-11 space-y-8 pt-2">
                  {/* Linha vertical contínua */}
                  <div className="absolute left-3.5 sm:left-4.5 top-4 bottom-8 w-0.5 bg-[#35373c]" />

                  {/* ── 1. NÓ: ESPAÇOS GRÁTIS ── */}
                  <div className="relative space-y-3">
                    {/* Indicador no trilho */}
                    <div className="absolute -left-9 sm:-left-11 top-1 w-7 h-7 rounded-full bg-[#23a55a] text-white flex items-center justify-center ring-4 ring-[#313338] shadow-md z-10">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider flex items-center gap-2">
                          <span>ESPAÇOS GRÁTIS</span>
                          <span className="text-[#949ba4] font-normal normal-case">
                            — {Math.min(5, serverStickers.length)} de 5 utilizados
                          </span>
                        </div>
                        <p className="text-xs text-[#949ba4] mt-0.5">
                          5 espaços inclusos em todos os servidores para figurinhas customizadas.
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-[#57f287] bg-[#57f287]/10 px-2.5 py-0.5 rounded-full">
                        {Math.max(0, 5 - serverStickers.length)} livres
                      </span>
                    </div>

                    {/* Grid com os 5 slots iniciais limpos */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                      {[0, 1, 2, 3, 4].map((idx) => renderStickerSlot(idx))}
                    </div>
                  </div>

                  {/* ── 2. NÓ: NÍVEL 1 ── */}
                  <div className="relative space-y-3">
                    {/* Indicador no trilho */}
                    <div
                      className={`absolute -left-9 sm:-left-11 top-4 w-7 h-7 rounded-full flex items-center justify-center ring-4 ring-[#313338] shadow-md z-10 ${
                        isBoostLevel1
                          ? 'bg-[#ec417a] text-white'
                          : 'bg-[#2b2d31] border border-[#35373c] text-[#80848e]'
                      }`}
                    >
                      {isBoostLevel1 ? <Check className="w-4 h-4 stroke-[3]" /> : <Lock className="w-3.5 h-3.5" />}
                    </div>

                    {/* Bloco colapsado / organizado do Nível 1 */}
                    <div className="rounded-2xl border border-[#2b2d31] bg-[#232428]/95 p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#ec417a]/15 text-[#f47fff] border border-[#ec417a]/30 flex items-center gap-1.5">
                            <Gem className="w-3 h-3 text-[#ec417a] fill-[#ec417a]" />
                            <span>Nível 1</span>
                          </span>
                          {isBoostLevel1 ? (
                            <span className="bg-[#57f287]/15 text-[#57f287] text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" /> DESBLOQUEADO
                            </span>
                          ) : (
                            <span className="bg-[#f23f43]/15 text-[#f23f43] text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Lock className="w-3 h-3" /> REQUER 2 IMPULSOS ({serverBoostCount}/2)
                            </span>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white tracking-wide">
                            +15 espaços de figurinhas (20 total)
                          </h4>
                          <p className="text-xs text-[#949ba4] mt-0.5">
                            {isBoostLevel1
                              ? 'Nível 1 ativo! O servidor conta com 15 espaços adicionais desbloqueados.'
                              : 'Alcance 2 impulsos do servidor para liberar 15 novos espaços de figurinhas.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            closeServerSettings();
                            openServerBoostModal();
                          }}
                          className="bg-[#23a55a] hover:bg-[#1a8345] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                        >
                          {isOfficial ? (
                            <Infinity className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Gem className="w-3.5 h-3.5 fill-white" />
                          )}
                          <span>{isBoostLevel1 ? 'Impulsionar mais' : 'Comprar nível'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Se houver figurinhas enviadas no Nível 1 (slots 5 a 19), exibe-as organizadas */}
                    {isBoostLevel1 && serverStickers.slice(5, 20).length > 0 && (
                      <div className="pt-1">
                        <div className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                          Figurinhas enviadas no Nível 1 ({serverStickers.slice(5, 20).length} de 15)
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                          {serverStickers.slice(5, 20).map((_, i) => renderStickerSlot(i + 5))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── 3. NÓ: NÍVEL 2 ── */}
                  <div className="relative space-y-3">
                    {/* Indicador no trilho */}
                    <div
                      className={`absolute -left-9 sm:-left-11 top-4 w-7 h-7 rounded-full flex items-center justify-center ring-4 ring-[#313338] shadow-md z-10 ${
                        isBoostLevel2
                          ? 'bg-[#ec417a] text-white'
                          : 'bg-[#2b2d31] border border-[#35373c] text-[#80848e]'
                      }`}
                    >
                      {isBoostLevel2 ? <Check className="w-4 h-4 stroke-[3]" /> : <Lock className="w-3.5 h-3.5" />}
                    </div>

                    {/* Bloco colapsado / organizado do Nível 2 */}
                    <div className="rounded-2xl border border-[#2b2d31] bg-[#232428]/95 p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#ec417a]/15 text-[#f47fff] border border-[#ec417a]/30 flex items-center gap-1.5">
                            {isOfficial ? (
                              <Infinity className="w-3.5 h-3.5 text-[#ec417a]" />
                            ) : (
                              <Gem className="w-3.5 h-3.5 text-[#ec417a] fill-[#ec417a]" />
                            )}
                            <span>Nível 2</span>
                          </span>
                          {isBoostLevel2 ? (
                            <span className="bg-[#57f287]/15 text-[#57f287] text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" /> DESBLOQUEADO
                            </span>
                          ) : (
                            <span className="bg-[#f23f43]/15 text-[#f23f43] text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Lock className="w-3 h-3" /> REQUER 7 IMPULSOS ({serverBoostCount}/7)
                            </span>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white tracking-wide">
                            +15 espaços adicionais de figurinhas (35 total)
                          </h4>
                          <p className="text-xs text-[#949ba4] mt-0.5">
                            {isBoostLevel2
                              ? 'Nível 2 ativo! Liberados os slots 21 a 35 para figurinhas oficiais.'
                              : 'Alcance 7 impulsos do servidor para desbloquear mais 15 espaços.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            closeServerSettings();
                            openServerBoostModal();
                          }}
                          className="bg-[#23a55a] hover:bg-[#1a8345] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                        >
                          {isOfficial ? (
                            <Infinity className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Gem className="w-3.5 h-3.5 fill-white" />
                          )}
                          <span>{isBoostLevel2 ? 'Impulsionar mais' : 'Comprar nível'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Se houver figurinhas enviadas no Nível 2 (slots 20 a 34), exibe-as organizadas */}
                    {isBoostLevel2 && serverStickers.slice(20, 35).length > 0 && (
                      <div className="pt-1">
                        <div className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                          Figurinhas enviadas no Nível 2 ({serverStickers.slice(20, 35).length} de 15)
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                          {serverStickers.slice(20, 35).map((_, i) => renderStickerSlot(i + 20))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── 4. NÓ: NÍVEL 3 (MÁXIMO) ── */}
                  <div className="relative space-y-3">
                    {/* Indicador no trilho */}
                    <div
                      className={`absolute -left-9 sm:-left-11 top-4 w-7 h-7 rounded-full flex items-center justify-center ring-4 ring-[#313338] shadow-md z-10 ${
                        isBoostLevel3
                          ? 'bg-gradient-to-r from-[#ec417a] to-[#9b59b6] text-white'
                          : 'bg-[#2b2d31] border border-[#35373c] text-[#80848e]'
                      }`}
                    >
                      {isBoostLevel3 ? <Sparkles className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </div>

                    {/* Bloco colapsado / organizado do Nível 3 */}
                    <div className="rounded-2xl border border-[#2b2d31] bg-[#232428]/95 p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#ec417a]/20 to-[#9b59b6]/20 text-[#f47fff] border border-[#ec417a]/40 flex items-center gap-1.5">
                            {isOfficial ? (
                              <Infinity className="w-3 h-3 text-[#ec417a]" />
                            ) : (
                              <Gem className="w-3 h-3 text-[#ec417a] fill-[#ec417a]" />
                            )}
                            <span>Nível 3 (Máximo)</span>
                          </span>
                          {isBoostLevel3 ? (
                            <span className="bg-[#57f287]/15 text-[#57f287] text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" /> DESBLOQUEADO (MÁXIMO)
                            </span>
                          ) : (
                            <span className="bg-[#f23f43]/15 text-[#f23f43] text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Lock className="w-3 h-3" /> REQUER 14 IMPULSOS ({serverBoostCount}/14)
                            </span>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white tracking-wide">
                            +25 espaços adicionais de figurinhas (60 total)
                          </h4>
                          <p className="text-xs text-[#949ba4] mt-0.5">
                            {isBoostLevel3
                              ? 'Capacidade máxima de 60 figurinhas ativada no servidor!'
                              : 'Alcance 14 impulsos de servidor para desbloquear a capacidade total de 60 figurinhas.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            closeServerSettings();
                            openServerBoostModal();
                          }}
                          className="bg-[#23a55a] hover:bg-[#1a8345] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                        >
                          {isOfficial ? (
                            <Infinity className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Gem className="w-3.5 h-3.5 fill-white" />
                          )}
                          <span>{isBoostLevel3 ? 'Servidor no Máximo' : 'Comprar nível'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Se houver figurinhas enviadas no Nível 3 (slots 35 a 59), exibe-as organizadas */}
                    {isBoostLevel3 && serverStickers.slice(35, 60).length > 0 && (
                      <div className="pt-1">
                        <div className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                          Figurinhas enviadas no Nível 3 ({serverStickers.slice(35, 60).length} de 25)
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                          {serverStickers.slice(35, 60).map((_, i) => renderStickerSlot(i + 35))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* ── 11. ABA: INTEGRAÇÕES ───────────────────────────────────────────────── */}
          {/* ========================================================================= */}
          {activeTab === 'integrations' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Integrações</h2>
                <p className="text-xs text-[#949ba4] mt-1">
                  Gerencie bots, webhooks e canais seguidos no seu servidor.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-[#2b2d31] border border-[#232428] space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#5865f2]/20 text-[#5865f2] flex items-center justify-center">
                      <Webhook className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Webhooks</h4>
                      <p className="text-xs text-[#949ba4]">1 Webhook ativo</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#dbdee1]">
                    Capy Notifier configurado para enviar alertas de atualizações no canal #anuncios-oficiais.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setWebhookManagedNotice(true);
                        setTimeout(() => setWebhookManagedNotice(false), 2500);
                      }}
                      className="text-xs font-semibold px-3 py-1.5 rounded bg-[#35373c] hover:bg-[#4e5058] text-white transition-colors cursor-pointer"
                    >
                      Criar webhook
                    </button>
                    {webhookManagedNotice && (
                      <span className="text-[11px] font-medium text-[#23a55a] animate-in fade-in">
                        ✓ Webhook configurado!
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[#2b2d31] border border-[#232428] space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#23a55a]/20 text-[#23a55a] flex items-center justify-center">
                      <RadioReceiver className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Canais Seguidos</h4>
                      <p className="text-xs text-[#949ba4]">0 canais seguidos</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#dbdee1]">
                    Siga canais de anúncios de outros servidores para receber novidades diretamente.
                  </p>
                  <button
                    onClick={() => setIsFollowedChannelsGuideOpen((prev) => !prev)}
                    className="text-xs font-semibold px-3 py-1.5 rounded bg-[#35373c] hover:bg-[#4e5058] text-white transition-colors cursor-pointer"
                  >
                    {isFollowedChannelsGuideOpen ? 'Ocultar detalhes' : 'Saiba mais'}
                  </button>
                  {isFollowedChannelsGuideOpen && (
                    <div className="p-2.5 bg-[#1e1f22] border border-[#2b2d31] rounded text-[11px] text-[#949ba4] leading-relaxed animate-in fade-in">
                      Para seguir um canal de anúncios, abra o canal desejado em outro servidor e clique no botão <strong>Seguir</strong> no cabeçalho do chat.
                    </div>
                  )}
                </div>
              </div>

              {/* Bots e Apps Conectados */}
              <div className="space-y-3 pt-3">
                <h3 className="text-sm font-bold text-[#b5bac1] uppercase tracking-wider">
                  BOTS E APPS INTEGRADOS
                </h3>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-[#2b2d31] border border-[#232428] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={getAssetUrl('assets/logo-circular.png')}
                        alt="Bot"
                        className="w-10 h-10 rounded-full object-cover bg-[#1e1f22]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">CapyBot Oficial</h4>
                          <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 rounded uppercase">
                            BOT VERIFICADO
                          </span>
                        </div>
                        <p className="text-xs text-[#949ba4] mt-0.5">
                          Assistente oficial do CapyChat • 8 Comandos de barra ativos
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setBotManagedNotice(true);
                          setTimeout(() => setBotManagedNotice(false), 2500);
                        }}
                        className="text-xs font-semibold px-3 py-1.5 rounded bg-[#35373c] hover:bg-[#4e5058] text-white transition-colors cursor-pointer"
                      >
                        Gerenciar &gt;
                      </button>
                      {botManagedNotice && (
                        <span className="text-[11px] font-medium text-[#23a55a] animate-in fade-in">
                          ✓ Permissões sincronizadas!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ── 12. ABA: CONFIGURAÇÕES DE SEGURANÇA ─────────────────────────────────── */}
          {/* ========================================================================= */}
          {activeTab === 'security' && (
            <div className="space-y-8 animate-in fade-in duration-150 max-w-2xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">
                  Configurações de Segurança
                </h2>
                <p className="text-xs text-[#949ba4] mt-1">
                  Proteja sua comunidade contra ataques de spam, bots maliciosos e contas não verificadas.
                </p>
              </div>

              {/* Níveis de Verificação */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#b5bac1] uppercase tracking-wider">
                  NÍVEL DE VERIFICAÇÃO DE CONTA
                </h3>

                <div className="space-y-2">
                  {[
                    { id: 'none', title: 'Nenhum', desc: 'Irrestrito, qualquer usuário pode interagir imediatamente.' },
                    { id: 'low', title: 'Baixo', desc: 'Deve ter um e-mail verificado na conta do CapyChat.' },
                    { id: 'medium', title: 'Médio', desc: 'Também deve estar registrado no CapyChat há mais de 5 minutos.' },
                    { id: 'high', title: 'Alto', desc: 'Também deve ser membro deste servidor há mais de 10 minutos.' },
                    { id: 'highest', title: 'Mais Alto', desc: 'Deve ter um telefone verificado na conta do CapyChat.' },
                  ].map((level) => {
                    const isSelected = verificationLevel === level.id;
                    return (
                      <div
                        key={level.id}
                        onClick={() => {
                          setVerificationLevel(level.id as any);
                          setHasChanges(true);
                        }}
                        className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#35373c] border-[#5865f2] shadow'
                            : 'bg-[#2b2d31] border-[#232428] hover:bg-[#35373c]/50'
                        }`}
                      >
                        <div>
                          <h4 className="text-xs font-bold text-white">{level.title}</h4>
                          <p className="text-[11px] text-[#949ba4] mt-0.5">{level.desc}</p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-[#5865f2]' : 'border-[#949ba4]'
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-[#5865f2]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Toggles de Segurança */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#b5bac1] uppercase tracking-wider">
                  MODERAÇÃO AVANÇADA
                </h3>

                <div className="p-4 rounded-lg bg-[#2b2d31] border border-[#232428] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-white">
                        Requer V2E para ações de moderador(a)
                      </h4>
                      <p className="text-[11px] text-[#949ba4]">
                        Exige autenticação de 2 fatores para qualquer membro com permissões administrativas.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setRequire2FA(!require2FA);
                        setHasChanges(true);
                      }}
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer flex items-center flex-shrink-0 ${
                        require2FA ? 'bg-[#23a55a] justify-end' : 'bg-[#4e5058] justify-start'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#232428]">
                    <div>
                      <h4 className="text-xs font-semibold text-white">
                        Restringir remoções a administradores
                      </h4>
                      <p className="text-[11px] text-[#949ba4]">
                        Impede moderadores juniores de banirem membros sem aprovação prévia.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setRestrictKicksToAdmin(!restrictKicksToAdmin);
                        setHasChanges(true);
                      }}
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer flex items-center flex-shrink-0 ${
                        restrictKicksToAdmin ? 'bg-[#23a55a] justify-end' : 'bg-[#4e5058] justify-start'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ── 13. ABA: REGISTRO DE AUDITORIA ─────────────────────────────────────── */}
          {/* ========================================================================= */}
          {activeTab === 'audit-log' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">
                  Registro de Auditoria
                </h2>
                <p className="text-xs text-[#949ba4] mt-1">
                  Histórico completo de alterações realizadas por administradores e moderadores neste servidor.
                </p>
              </div>

              {/* Filtros por Usuário e Ação */}
              <div className="flex items-center gap-3 flex-wrap bg-[#1e1f22]/70 p-3 rounded-lg border border-[#232428]">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-[#b5bac1] uppercase tracking-wider block mb-1">
                    Filtrar por Moderador / Usuário
                  </label>
                  <select
                    value={auditFilterUser}
                    onChange={(e) => setAuditFilterUser(e.target.value)}
                    className="w-full bg-[#2b2d31] border border-[#232428] rounded px-3 py-1.5 text-xs text-white cursor-pointer focus:outline-none focus:border-[#5865f2]"
                  >
                    <option value="all">Todos os Moderadores {availableAuditUsers.length > 0 ? `(${availableAuditUsers.length})` : ''}</option>
                    {availableAuditUsers.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-[#b5bac1] uppercase tracking-wider block mb-1">
                    Filtrar por Tipo de Ação
                  </label>
                  <select
                    value={auditFilterAction}
                    onChange={(e) => setAuditFilterAction(e.target.value)}
                    className="w-full bg-[#2b2d31] border border-[#232428] rounded px-3 py-1.5 text-xs text-white cursor-pointer focus:outline-none focus:border-[#5865f2]"
                  >
                    <option value="all">Todas as Ações</option>
                    <option value="create_role">Criação de Cargos</option>
                    <option value="update_role">Atualização de Cargos</option>
                    <option value="channel_create">Criação de Canais</option>
                    <option value="channel_update">Edição de Canais</option>
                    <option value="kick">Expulsões de Membros</option>
                    <option value="ban">Banimentos</option>
                    <option value="mute">Silenciamentos</option>
                    <option value="member_join">Novos Membros</option>
                    <option value="webhook_create">Webhooks & Integrações</option>
                    <option value="invite_create">Convites</option>
                  </select>
                </div>

                {(auditFilterUser !== 'all' || auditFilterAction !== 'all') && (
                  <button
                    onClick={() => {
                      setAuditFilterUser('all');
                      setAuditFilterAction('all');
                    }}
                    className="self-end px-3 py-1.5 bg-[#2b2d31] hover:bg-[#35373c] text-xs text-[#dbdee1] rounded transition-colors cursor-pointer"
                  >
                    Limpar Filtros
                  </button>
                )}
              </div>

              {/* Lista Filtrada de Auditoria (Estilo Discord 1:1) */}
              <div className="space-y-2.5">
                {auditLogList
                  .filter((item) => {
                    const matchUser = auditFilterUser === 'all' || item.user === auditFilterUser;
                    const matchAction = auditFilterAction === 'all' || item.actionType === auditFilterAction;
                    return matchUser && matchAction;
                  })
                  .map((item) => {
                    const getActionInfo = (type: string) => {
                      switch (type) {
                        case 'create_role':
                        case 'update_role':
                        case 'delete_role':
                          return { icon: ShieldCheck, color: '#2ecc71', label: 'Cargo' };
                        case 'channel_create':
                        case 'channel_update':
                        case 'channel_delete':
                          return { icon: Hash, color: '#5865f2', label: 'Canal' };
                        case 'ban':
                          return { icon: Ban, color: '#da373c', label: 'Banimento' };
                        case 'kick':
                          return { icon: UserX, color: '#f23f43', label: 'Expulsão' };
                        case 'mute':
                          return { icon: VolumeX, color: '#f0b232', label: 'Silenciamento' };
                        case 'member_join':
                          return { icon: UserPlus, color: '#57f287', label: 'Novo Membro' };
                        case 'webhook_create':
                        case 'webhook_update':
                          return { icon: Webhook, color: '#00b0f4', label: 'Webhook' };
                        case 'invite_create':
                          return { icon: LinkIcon, color: '#eb459e', label: 'Convite' };
                        case 'server_update':
                          return { icon: Sliders, color: '#f47fff', label: 'Servidor' };
                        default:
                          return { icon: FileText, color: '#949ba4', label: 'Auditoria' };
                      }
                    };

                    const getAvatar = (userName: string, explicitAvatar?: string) => {
                      if (explicitAvatar) return explicitAvatar;
                      const found = mockUsers.find((u) => u.name === userName || u.displayName?.includes(userName));
                      if (found?.avatar) return found.avatar;
                      if (userName.toLowerCase().includes('bot')) return getAssetUrl('assets/logo-circular.png');
                      return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80';
                    };

                    const actionInfo = getActionInfo(item.actionType);
                    const ActionIcon = actionInfo.icon;
                    const avatarUrl = getAvatar(item.user, (item as any).avatar);

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl bg-[#2b2d31]/50 hover:bg-[#2b2d31]/90 border border-[#232428] hover:border-[#35373c] p-3.5 flex items-center justify-between gap-4 transition-all duration-150 shadow-sm group cursor-pointer"
                      >
                        {/* Lado Esquerdo: Avatar do Moderador/Admin + Badge de Ícone Contextual */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="relative flex-shrink-0">
                            <img
                              src={avatarUrl}
                              alt={item.user}
                              className="w-10 h-10 rounded-full object-cover border border-[#1e1f22] shadow"
                            />
                            {/* Ícone contextual de tipo de evento em badge sobreposto */}
                            <div
                              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-[#2b2d31] shadow"
                              style={{ backgroundColor: actionInfo.color }}
                              title={actionInfo.label}
                            >
                              <ActionIcon className="w-2.5 h-2.5 text-white stroke-[2.5]" />
                            </div>
                          </div>

                          {/* Detalhes do Log */}
                          <div className="min-w-0 space-y-0.5">
                            <div className="text-xs text-[#dbdee1] flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-white hover:underline cursor-pointer">
                                {item.user}
                              </span>
                              <span className="text-[#949ba4] font-medium">
                                {item.action}
                              </span>
                              <span
                                className="font-bold px-2 py-0.5 rounded-md text-xs inline-flex items-center gap-1"
                                style={{
                                  color: item.color,
                                  backgroundColor: `${item.color}18`,
                                }}
                              >
                                {item.target}
                              </span>
                            </div>

                            {/* Informações complementares ou Razão */}
                            {(item as any).details && (
                              <p className="text-[11px] text-[#80848e] font-mono truncate leading-relaxed">
                                {(item as any).details}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Lado Direito: Carimbo de Data/Hora Detalhado + Seta Indicativa */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-[11px] font-medium text-[#80848e] group-hover:text-[#b5bac1] transition-colors whitespace-nowrap">
                            {item.time}
                          </span>
                          <ChevronRight className="w-4 h-4 text-[#80848e] group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                        </div>
                      </div>
                    );
                  })}

                {auditLogList.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#80848e] bg-[#2b2d31]/30 rounded-xl border border-[#232428] space-y-2">
                    <FileText className="w-10 h-10 text-[#80848e]/50 mx-auto mb-2" />
                    <p className="font-bold text-white text-sm">Nenhum evento registrado ainda neste servidor</p>
                    <p className="text-[#949ba4] max-w-sm mx-auto">
                      As ações de gerenciamento de canais, cargos e moderação realizadas pelos administradores ficarão registradas aqui.
                    </p>
                  </div>
                ) : auditLogList.filter((item) => {
                  const matchUser = auditFilterUser === 'all' || item.user === auditFilterUser;
                  const matchAction = auditFilterAction === 'all' || item.actionType === auditFilterAction;
                  return matchUser && matchAction;
                }).length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#80848e] bg-[#2b2d31]/30 rounded-xl border border-[#232428] space-y-1">
                    <FileText className="w-8 h-8 text-[#80848e]/50 mx-auto mb-2" />
                    <p className="font-bold text-white">Nenhum registro encontrado</p>
                    <p>Tente ajustar os filtros por usuário ou tipo de ação.</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ── 14. ABA: BANIMENTOS ────────────────────────────────────────────────── */}
          {/* ========================================================================= */}
          {activeTab === 'bans' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">
                  Banimentos — {bannedUsers.length}
                </h2>
                <p className="text-xs text-[#949ba4] mt-1">
                  Usuários permanentemente proibidos de ingressar ou visualizar este servidor.
                </p>
              </div>

              <div className="divide-y divide-[#232428] bg-[#2b2d31] border border-[#232428] rounded-lg">
                {bannedUsers.map((banned) => (
                  <div
                    key={banned.id}
                    className="flex items-center justify-between p-3 hover:bg-[#35373c]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={banned.avatar}
                        alt={banned.name}
                        className="w-9 h-9 rounded-full object-cover grayscale opacity-70"
                      />
                      <div>
                        <span className="text-sm font-semibold text-white block">
                          {banned.name}#{banned.tag}
                        </span>
                        <span className="text-xs text-[#f23f43]">{banned.reason}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRevokeBan(banned.id)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-[4px] bg-[#35373c] text-white hover:bg-[#4e5058] transition-colors cursor-pointer"
                    >
                      Revogar Banimento
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ── 15. ABA: AUTOMOD ───────────────────────────────────────────────────── */}
          {activeTab === 'automod' && (
            <div className="space-y-6 animate-in fade-in duration-150 max-w-2xl">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">AutoMod</h2>
                <p className="text-xs text-[#949ba4] mt-1">
                  Filtre mensagens automaticamente antes que os membros as vejam.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { title: 'Bloquear menções em massa', desc: 'Impede mensagens com mais de 5 menções @ de uma só vez.', active: true },
                  { title: 'Bloquear conteúdo de spam suspeito', desc: 'Identifica e silencia links de phishing ou cópias repetidas de texto.', active: true },
                  { title: 'Filtrar palavras proibidas', desc: 'Impede o envio de palavras contidas na lista de termos censurados.', active: false },
                ].map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-[#2b2d31] border border-[#232428] flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-white">{rule.title}</h4>
                      <p className="text-xs text-[#949ba4] mt-0.5">{rule.desc}</p>
                    </div>
                    <button
                      className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors cursor-pointer ${
                        rule.active
                          ? 'bg-[#23a55a] text-white'
                          : 'bg-[#35373c] text-[#dbdee1] hover:bg-[#4e5058]'
                      }`}
                    >
                      {rule.active ? 'Ativo' : 'Configurar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ── 16. ABA: HABILITAR COMUNIDADE ──────────────────────────────────────── */}
          {activeTab === 'enable-community' && (() => {
            const isCommunityActive = Boolean(currentServer?.isCommunity);
            const canManage =
              currentServer?.ownerId === storeCurrentUser.id ||
              storeCurrentUser.role === 'OWNER' ||
              canUserModerate(storeCurrentUser.id, undefined, currentServer.id).isAdmin;

            const allChs = (currentServer.categories || []).flatMap((c) => c.channels || []);
            const rulesChannel = allChs.find((c) => c.id === currentServer.rulesChannelId || c.name === 'regras');
            const updatesChannel = allChs.find((c) => c.id === currentServer.publicUpdatesChannelId || c.name === 'avisos');

            return (
              <div className="space-y-6 animate-in fade-in duration-150 max-w-2xl">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    Habilitar Comunidade
                  </h2>
                  <p className="text-xs text-[#949ba4] mt-1">
                    Transforme seu servidor em uma Comunidade Oficial para ter acesso a Canais de Anúncios, Fóruns, Insights de Servidor e Descoberta de Servidores.
                  </p>
                </div>

                {!canManage && (
                  <div className="p-4 rounded-lg bg-[#f23f43]/10 border border-[#f23f43]/30 flex items-center gap-3 text-[#f23f43] text-xs font-medium">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    <span>Apenas o proprietário ou administradores autorizados podem habilitar ou gerenciar recursos de comunidade neste servidor.</span>
                  </div>
                )}

                {communityActionError && (
                  <div className="p-3 rounded bg-[#f23f43]/15 border border-[#f23f43]/30 text-[#f23f43] text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{communityActionError}</span>
                  </div>
                )}

                {communityActionSuccess && (
                  <div className="p-3 rounded bg-[#23a55a]/15 border border-[#23a55a]/30 text-[#23a55a] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{communityActionSuccess}</span>
                  </div>
                )}

                {isCommunityActive ? (
                  /* Comunidade já Ativada */
                  <div className="space-y-4">
                    <div className="p-5 rounded-xl bg-[#23a55a]/10 border border-[#23a55a]/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#23a55a] text-white flex items-center justify-center font-bold text-sm shadow">
                            ✓
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white">Comunidade Oficial Ativada</h3>
                            <p className="text-[11px] text-[#949ba4]">Este servidor está operando como uma Comunidade Oficial do CapyChat.</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[#23a55a]/20 text-[#23a55a] px-2.5 py-1 rounded">
                          ATIVO
                        </span>
                      </div>
                    </div>

                    <div className="p-5 rounded-lg bg-[#2b2d31] border border-[#232428] space-y-4">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Canais Dedicados da Comunidade</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded bg-[#1e1f22] border border-[#232428] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#5865f2]" />
                            <div>
                              <span className="text-xs font-bold text-white block">Canal de Regras</span>
                              <span className="text-[11px] text-[#949ba4]">#{rulesChannel?.name || 'regras'}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-[#23a55a] bg-[#23a55a]/10 px-2 py-0.5 rounded">Vinculado</span>
                        </div>
                        <div className="p-3 rounded bg-[#1e1f22] border border-[#232428] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Radio className="w-4 h-4 text-[#f0b232]" />
                            <div>
                              <span className="text-xs font-bold text-white block">Canal de Avisos</span>
                              <span className="text-[11px] text-[#949ba4]">#{updatesChannel?.name || 'avisos'}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-[#23a55a] bg-[#23a55a]/10 px-2 py-0.5 rounded">Vinculado</span>
                        </div>
                      </div>

                      {canManage && (
                        <div className="pt-2 border-t border-[#232428] flex items-center justify-between">
                          <span className="text-[11px] text-[#949ba4]">Deseja reverter este servidor para o modo padrão?</span>
                          <button
                            onClick={async () => {
                              const res = await disableCommunity(currentServer.id);
                              if (res.success) {
                                setCommunityActionSuccess('Recursos de comunidade desativados com sucesso.');
                                setTimeout(() => setCommunityActionSuccess(null), 3500);
                              } else {
                                setCommunityActionError(res.error || 'Erro ao desativar comunidade.');
                              }
                            }}
                            className="text-xs font-medium text-[#f23f43] hover:underline cursor-pointer"
                          >
                            Desativar Comunidade
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Comunidade Não Ativada: Onboarding e Ativação Real */
                  <div className="p-6 rounded-xl bg-gradient-to-r from-[#5865f2] to-[#4752c4] text-white space-y-4">
                    <h3 className="text-base font-bold">Pronto para expandir seu servidor?</h3>
                    <ul className="text-xs space-y-2 opacity-95">
                      <li className="flex items-center gap-2">✓ Canal de Regras e Diretrizes públicas (criação automática ou vinculação de #regras)</li>
                      <li className="flex items-center gap-2">✓ Canal de Avisos e Anúncios oficiais para toda a comunidade (#avisos)</li>
                      <li className="flex items-center gap-2">✓ Análise de métricas, filtros de proteção contra spam e moderação de membros</li>
                    </ul>
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        disabled={!canManage || isEnablingCommunity}
                        onClick={async () => {
                          setIsEnablingCommunity(true);
                          setCommunityActionError(null);
                          const res = await enableCommunity(currentServer.id);
                          setIsEnablingCommunity(false);
                          if (res.success) {
                            if (res.remoteSynced) {
                              setCommunityActionSuccess('✓ Comunidade Oficial ativada e persistida no Supabase Cloud!');
                            } else if (res.remoteStatus === 'schema_missing') {
                              setCommunityActionSuccess('✓ Comunidade Oficial ativada no aplicativo! (Sincronização remota aguardando execução da migração no Supabase)');
                            } else {
                              setCommunityActionSuccess(
                                res.createdChannels && res.createdChannels.length > 0
                                  ? `✓ Comunidade Oficial ativada! Canais criados: ${res.createdChannels.join(', ')}`
                                  : '✓ Comunidade Oficial ativada com sucesso!'
                              );
                            }
                            setTimeout(() => setCommunityActionSuccess(null), 4500);
                          } else {
                            setCommunityActionError(res.error || 'Não foi possível habilitar a comunidade.');
                          }
                        }}
                        className="bg-white text-[#5865f2] font-bold text-xs px-5 py-2.5 rounded-md hover:bg-white/90 transition-colors cursor-pointer shadow disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isEnablingCommunity ? 'Configurando...' : 'Começar Configuração'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* ── 17. ABA: MODELO DO SERVIDOR ────────────────────────────────────────── */}
          {activeTab === 'server-template' && (() => {
            const catCount = currentServer.categories?.length || 0;
            const chCount = currentServer.categories?.reduce((acc, c) => acc + (c.channels?.length || 0), 0) || 0;
            const customRoleCount = roles.filter((r) => r.name.toLowerCase() !== '@everyone' && !r.isDefault).length;

            return (
              <div className="space-y-6 animate-in fade-in duration-150 max-w-2xl">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    Modelo do Servidor
                  </h2>
                  <p className="text-xs text-[#949ba4] mt-1">
                    Gere um link para que outras pessoas criem cópias idênticas dos canais, categorias e cargos deste servidor.
                  </p>
                </div>

                <div className="p-5 rounded-lg bg-[#2b2d31] border border-[#232428] space-y-4">
                  {/* Title & Desc */}
                  <div>
                    <label className="block text-xs font-semibold text-[#dbdee1] mb-1">
                      Título do Modelo
                    </label>
                    <input
                      type="text"
                      value={templateTitle}
                      onChange={(e) => setTemplateTitle(e.target.value)}
                      placeholder="Nome do modelo"
                      className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#dbdee1] mb-1">
                      Descrição do Modelo
                    </label>
                    <textarea
                      value={templateDesc}
                      onChange={(e) => setTemplateDesc(e.target.value)}
                      placeholder="Descreva a finalidade desta estrutura de servidor..."
                      rows={2}
                      className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2] resize-none"
                    />
                  </div>

                  {/* Summary Badges */}
                  <div className="flex items-center gap-3 text-xs text-[#949ba4] bg-[#1e1f22] p-3 rounded border border-[#232428]">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#5865f2]" />
                      <span className="font-semibold text-white">{catCount}</span> Categorias
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-[#57f287]" />
                      <span className="font-semibold text-white">{chCount}</span> Canais
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-[#f0b232]" />
                      <span className="font-semibold text-white">{customRoleCount}</span> Cargos
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      disabled={isGeneratingTemplate || !templateTitle.trim()}
                      onClick={async () => {
                        setIsGeneratingTemplate(true);
                        const templateData = exportServerToTemplate(currentServer, {
                          name: templateTitle,
                          description: templateDesc,
                          creatorName: storeCurrentUser.displayName || storeCurrentUser.name,
                          customRoles: roles,
                        });
                        const res = await saveServerTemplate(templateData, storeCurrentUser.id);
                        setIsGeneratingTemplate(false);
                        if (res.success) {
                          setGeneratedTemplateUrl(res.url);
                          try {
                            await navigator.clipboard.writeText(res.url);
                          } catch {}
                          setTemplateCopied(true);
                          setTimeout(() => setTemplateCopied(false), 2500);
                        }
                      }}
                      className={`text-xs font-semibold px-4 py-2 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                        templateCopied
                          ? 'bg-[#23a55a] text-white shadow'
                          : 'bg-[#5865f2] hover:bg-[#4752c4] text-white'
                      }`}
                    >
                      {templateCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Link do Modelo Copiado!</span>
                        </>
                      ) : (
                        <>
                          <LinkIcon className="w-3.5 h-3.5" />
                          <span>{isGeneratingTemplate ? 'Gerando...' : 'Gerar Link do Modelo'}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        const templateData = exportServerToTemplate(currentServer, {
                          name: templateTitle,
                          description: templateDesc,
                          creatorName: storeCurrentUser.displayName || storeCurrentUser.name,
                          customRoles: roles,
                        });
                        downloadTemplateAsJson(templateData);
                      }}
                      className="text-xs font-semibold px-4 py-2 rounded bg-[#2b2d31] hover:bg-[#35373c] text-white border border-[#3f4147] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar Arquivo JSON</span>
                    </button>
                  </div>

                  {/* Generated Link Box */}
                  {generatedTemplateUrl && (
                    <div className="p-3 bg-[#1e1f22] border border-[#232428] rounded space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-xs font-mono text-[#5865f2]">
                          {generatedTemplateUrl}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedTemplateUrl).catch(() => {});
                            setTemplateCopied(true);
                            setTimeout(() => setTemplateCopied(false), 2000);
                          }}
                          className="text-xs bg-[#2b2d31] hover:bg-[#35373c] text-white px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1 flex-shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copiar Link</span>
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#949ba4] border-t border-[#232428]/60 pt-1.5">
                        <span>Código do Modelo: <strong className="text-white font-mono">{generatedTemplateUrl.split('/').pop()}</strong></span>
                        <span className="text-[10px] text-[#80848e]">Uso interno no CapyChat Oficial</span>
                      </div>
                    </div>
                  )}

                  {/* Channels & Roles Included Preview */}
                  <div className="pt-2 border-t border-[#232428]">
                    <span className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block mb-2">
                      Estrutura incluída neste modelo
                    </span>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin text-xs">
                      {(currentServer.categories || []).map((cat) => (
                        <div key={cat.id} className="bg-[#1e1f22] p-2 rounded border border-[#232428]/60">
                          <span className="font-bold text-[#949ba4] text-[10px] uppercase tracking-wider block mb-1">
                            {cat.name}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(cat.channels || []).map((ch) => (
                              <span key={ch.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#2b2d31] text-[#dbdee1] rounded text-[11px]">
                                {ch.type === 'voice' ? <Volume2 className="w-3 h-3 text-[#949ba4]" /> : <Hash className="w-3 h-3 text-[#949ba4]" />}
                                {ch.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* ── 18. DEMAIS ABAS (ex: soundboard, app-directory) ────────────────────── */}
          {![
            'server-profile',
            'server-tag',
            'engagement',
            'roles',
            'members',
            'invites',
            'access',
            'emoji',
            'stickers',
            'integrations',
            'security',
            'audit-log',
            'bans',
            'automod',
            'enable-community',
            'server-template',
          ].includes(activeTab) && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <h2 className="text-xl font-bold text-white capitalize tracking-wide">
                {activeTab.replace('-', ' ')}
              </h2>
              <p className="text-xs text-[#949ba4]">
                Gerencie as opções de {activeTab} para este servidor.
              </p>
              <div className="p-8 rounded-lg bg-[#2b2d31]/60 border border-[#232428] text-center space-y-3">
                <Sparkles className="w-8 h-8 text-[#5865f2] mx-auto" />
                <h4 className="text-sm font-bold text-white">Configuração Ativa</h4>
                <p className="text-xs text-[#949ba4] max-w-md mx-auto">
                  Este recurso está sincronizado e totalmente integrado ao ecossistema da LYC Arena.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. BOTÃO ESC FLUTUANTE NO CANTO SUPERIOR DIREITO ───── */}
      <div className="fixed top-10 right-10 flex flex-col items-center gap-1 z-50">
        <button
          onClick={() => {
            if (editingRoleId) {
              setEditingRoleId(null);
            } else {
              closeServerSettings();
            }
          }}
          title="Fechar (ESC)"
          className="w-9 h-9 rounded-full border-2 border-[#b5bac1] flex items-center justify-center text-[#b5bac1] hover:bg-[#b5bac1]/10 hover:border-white hover:text-white transition-all cursor-pointer group shadow-lg"
        >
          <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
        <span className="text-[11px] font-bold text-[#b5bac1] tracking-wider select-none">
          ESC
        </span>
      </div>

      {/* ── 4. BARRA DE ALTERAÇÕES NÃO SALVAS (Floating Save Bar) ───── */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#111214]/95 backdrop-blur-md text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-6 border border-[#2b2d31]/80 animate-in slide-in-from-bottom duration-200">
          <span className="text-xs text-[#dbdee1] font-medium">
            Cuidado — você tem alterações não salvas!
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetAll}
              className="text-xs text-white hover:underline cursor-pointer font-medium px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              Redefinir
            </button>
            <button
              onClick={handleSaveAll}
              className="bg-[#23a55a] hover:bg-[#1a8345] text-white text-xs font-semibold px-5 py-2 rounded-xl transition-all cursor-pointer shadow-lg active:scale-95"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Expulsão / Banimento */}
      {confirmActionModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm select-none animate-in fade-in duration-150">
          <div className="bg-[#313338] rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl border border-[#232428] space-y-4">
            <h3 className="text-lg font-bold text-white">
              {confirmActionModal.type === 'kick'
                ? `Expulsar ${confirmActionModal.user.displayName || confirmActionModal.user.name}?`
                : `Banir ${confirmActionModal.user.displayName || confirmActionModal.user.name}?`}
            </h3>
            <p className="text-xs text-[#dbdee1] leading-relaxed">
              {confirmActionModal.type === 'kick'
                ? `Tem certeza que deseja expulsar @${confirmActionModal.user.name} do servidor? O usuário poderá retornar através de um novo convite.`
                : `Tem certeza que deseja banir @${confirmActionModal.user.name}? O usuário será impedido de retornar ao servidor e suas mensagens recentes poderão ser excluídas.`}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmActionModal(null)}
                className="px-4 py-2 text-xs font-semibold text-white hover:underline cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const u = confirmActionModal.user;
                  if (confirmActionModal.type === 'kick') {
                    setActiveMemberList((prev) => prev.filter((m) => m.id !== u.id));
                    addAuditLogEntry(currentServer.id, {
                      user: storeCurrentUser.displayName || storeCurrentUser.name,
                      avatar: storeCurrentUser.avatar,
                      actionType: 'kick',
                      action: 'expulsou o membro',
                      target: u.displayName || u.name,
                      color: '#f23f43',
                    });
                  } else {
                    setActiveMemberList((prev) => prev.filter((m) => m.id !== u.id));
                    setBannedUsers((prev) => [
                      ...prev,
                      {
                        id: `ban-${Date.now()}`,
                        name: u.name,
                        tag: u.tag || '0001',
                        avatar: u.avatar,
                        reason: 'Banido pela moderação através do painel de membros',
                      },
                    ]);
                    addAuditLogEntry(currentServer.id, {
                      user: storeCurrentUser.displayName || storeCurrentUser.name,
                      avatar: storeCurrentUser.avatar,
                      actionType: 'ban',
                      action: 'baniu o usuário',
                      target: u.displayName || u.name,
                      color: '#da373c',
                    });
                  }
                  setConfirmActionModal(null);
                }}
                className="px-4 py-2 text-xs font-semibold rounded bg-[#da373c] hover:bg-[#c02e34] text-white cursor-pointer shadow transition-colors"
              >
                {confirmActionModal.type === 'kick' ? 'Expulsar Membro' : 'Banir Membro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação de Link de Convite */}
      {isCreateInviteModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm select-none animate-in fade-in duration-150">
          <div className="bg-[#313338] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-[#232428] space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-[#5865f2]" />
                <h3 className="text-lg font-bold text-white">Criar Link de Convite</h3>
              </div>
              <button
                onClick={() => setIsCreateInviteModalOpen(false)}
                className="text-[#949ba4] hover:text-white p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#dbdee1] leading-relaxed">
              Configure as propriedades do convite para definir para qual canal o novo membro será direcionado e as restrições de uso.
            </p>

            <div className="space-y-4">
              {/* Canal de Destino */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#b5bac1] block mb-1.5">
                  ENVIAR NOVO MEMBRO PARA
                </label>
                <select
                  value={newInviteChannel}
                  onChange={(e) => setNewInviteChannel(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#232428] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2] cursor-pointer"
                >
                  {(currentServer?.categories?.flatMap((c) => c.channels.filter((ch) => ch.type === 'text')) || []).map((ch) => (
                    <option key={ch.id} value={`#${ch.name}`}>
                      #{ch.name}
                    </option>
                  ))}
                  {(!currentServer?.categories || currentServer.categories.length === 0) && (
                    <option value="#chat-geral">#chat-geral</option>
                  )}
                </select>
              </div>

              {/* Expiração */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#b5bac1] block mb-1.5">
                  EXPIRA APÓS
                </label>
                <select
                  value={newInviteExpires}
                  onChange={(e) => setNewInviteExpires(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#232428] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2] cursor-pointer"
                >
                  <option value="30m">30 minutos</option>
                  <option value="1h">1 hora</option>
                  <option value="6h">6 horas</option>
                  <option value="12h">12 horas</option>
                  <option value="1d">1 dia</option>
                  <option value="7d">7 dias (Recomendado)</option>
                  <option value="never">Nunca expira</option>
                </select>
              </div>

              {/* Quantidade Máxima de Usos */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#b5bac1] block mb-1.5">
                  NÚMERO MÁXIMO DE USOS
                </label>
                <select
                  value={newInviteMaxUses}
                  onChange={(e) => setNewInviteMaxUses(Number(e.target.value))}
                  className="w-full bg-[#1e1f22] border border-[#232428] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2] cursor-pointer"
                >
                  <option value={0}>Sem limite</option>
                  <option value={1}>1 uso</option>
                  <option value={5}>5 usos</option>
                  <option value={10}>10 usos</option>
                  <option value={25}>25 usos</option>
                  <option value={50}>50 usos</option>
                  <option value={100}>100 usos</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-[#232428]">
              <button
                onClick={() => setIsCreateInviteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-white hover:underline cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerateCustomInvite}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-[#5865f2] hover:bg-[#4752c4] text-white cursor-pointer shadow-md transition-colors"
              >
                Gerar Novo Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Revogação de Convite */}
      {inviteToRevoke && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm select-none animate-in fade-in duration-150">
          <div className="bg-[#313338] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-[#232428] space-y-4">
            <div className="flex items-center gap-2 text-[#f23f43]">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-lg font-bold text-white">Revogar Link de Convite?</h3>
            </div>
            <p className="text-xs text-[#dbdee1] leading-relaxed">
              Tem certeza que deseja revogar o convite <code className="font-mono text-white bg-[#1e1f22] px-1.5 py-0.5 rounded border border-[#2b2d31]">{inviteToRevoke.code}</code>?
            </p>
            <p className="text-[11px] text-[#949ba4] leading-relaxed">
              Qualquer pessoa que tentar entrar usando este link não terá mais acesso ao servidor. Esta ação é irreversível.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setInviteToRevoke(null)}
                className="px-4 py-2 text-xs font-semibold text-white hover:underline cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRevokeInvite}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-[#da373c] hover:bg-[#c02e34] text-white cursor-pointer shadow transition-colors"
              >
                Revogar Convite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Server Irreversible Confirmation Modal */}
      {isDeleteServerModalOpen && (
        <DiscordDeleteServerModal
          isOpen={isDeleteServerModalOpen}
          server={currentServer}
          isOwner={
            currentServer.ownerId === (storeCurrentUser?.id || currentUser.id) ||
            ((storeCurrentUser?.role || currentUser.role) === 'OWNER' && (storeCurrentUser?.id || currentUser.id) === 'f8fcd139-cf43-4873-bd7d-a807ecd73567')
          }
          onConfirm={async () => {
            const res = await deleteServer(currentServer.id);
            if (res.success) {
              closeServerSettings();
            }
            return res;
          }}
          onCancel={() => setIsDeleteServerModalOpen(false)}
        />
      )}
    </div>
  );
};
