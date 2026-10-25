import React, { useState, useEffect } from 'react';
import { useDiscord, mockServers, currentUser } from '../../store/discordStore';
import { getServerBannerGradient, User, Channel, ChannelCategory } from '../../types/discord';
import { DiscordUserFooter } from './DiscordUserFooter';
import { DiscordUserContextMenu } from './DiscordUserContextMenu';
import { getAvatarUrl } from '../../utils/avatar';
import { DiscordChannelContextMenu } from './DiscordChannelContextMenu';
import { DiscordCategoryContextMenu } from './DiscordCategoryContextMenu';
import { DiscordDeleteConfirmModal } from './DiscordDeleteConfirmModal';
import { DiscordEditChannelModal } from './DiscordEditChannelModal';
import { DiscordEditCategoryModal } from './DiscordEditCategoryModal';
import { DiscordLeaveServerModal } from './DiscordLeaveServerModal';
import { LycVerifiedBadge } from './LycVerifiedBadge';
import { getCommunityBoostLevel, getCommunityLevelMedal, isOfficialCommunity } from '../../services/communityLevel';
import {
  ChevronDown,
  ChevronUp,
  Hash,
  Volume2,
  Megaphone,
  MessagesSquare,
  Plus,
  Users,
  Sparkles,
  Gem,
  Infinity,
  Store,
  Search,
  Settings,
  UserPlus,
  Bell,
  BellOff,
  ShieldAlert,
  FolderPlus,
  Monitor,
  MicOff,
  X,
  Target,
  Lock,
  Check,
  Copy,
  Crown,
} from 'lucide-react';

export const DiscordChannelsSidebar: React.FC = () => {
  const {
    activeServerId,
    activeChannelId,
    activeHomeTab,
    setActiveChannel,
    setActiveHomeTab,
    collapsedCategories,
    toggleCategory,
    voiceState,
    connectToVoice,
    servers,
    folders,
    openServerSettings,
    openServerBoostModal,
    openCreateChannel,
    openCreateCategory,
    reorderChannels,
    reorderCategories,
    openMemberPopout,
    editChannel,
    deleteChannel,
    duplicateChannel,
    markChannelAsRead,
    markCategoryAsRead,
    toggleMuteChannel,
    toggleMuteCategory,
    editCategory,
    deleteCategory,
    moveChannel,
    moveCategory,
    communityMembers,
    currentUser: storeCurrentUser,
    leaveServer,
  } = useDiscord();

  const [isServerMenuOpen, setIsServerMenuOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [voiceContextMenu, setVoiceContextMenu] = useState<{
    user: User;
    position: { x: number; y: number };
  } | null>(null);
  const [channelContextMenu, setChannelContextMenu] = useState<{
    channel: Channel & { categoryId: string };
    position: { x: number; y: number };
  } | null>(null);
  const [categoryContextMenu, setCategoryContextMenu] = useState<{
    category: ChannelCategory;
    position: { x: number; y: number };
  } | null>(null);
  const [deleteChannelModal, setDeleteChannelModal] = useState<{
    channel: Channel & { categoryId: string };
  } | null>(null);
  const [deleteCategoryModal, setDeleteCategoryModal] = useState<ChannelCategory | null>(null);
  const [editingCategory, setEditingCategory] = useState<ChannelCategory | null>(null);
  const [editingChannel, setEditingChannel] = useState<{
    channel: Channel;
    categoryId: string;
  } | null>(null);

  // Drag and Drop state for Channels and Categories
  const [draggedItem, setDraggedItem] = useState<{
    type: 'channel' | 'category';
    channelId?: string;
    sourceCategoryId: string;
  } | null>(null);

  const [dropTarget, setDropTarget] = useState<{
    id: string;
    type: 'channel' | 'category';
    position: 'above' | 'below' | 'inside';
  } | null>(null);

  // Floating Context Menu para área vazia da sidebar
  const [sidebarContextMenu, setSidebarContextMenu] = useState<{
    position: { x: number; y: number };
  } | null>(null);
  const [hideMutedChannels, setHideMutedChannels] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Fechar menus de contexto ao clicar fora ou pressionar ESC
  useEffect(() => {
    const handleGlobalClick = () => {
      setSidebarContextMenu(null);
      setCategoryContextMenu(null);
      setChannelContextMenu(null);
      setVoiceContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarContextMenu(null);
        setCategoryContextMenu(null);
        setChannelContextMenu(null);
        setVoiceContextMenu(null);
        setIsInviteModalOpen(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const isHome = activeServerId === '@me';
  const currentServer =
    servers.find((s) => s.id === activeServerId) ||
    (folders || []).flatMap((f) => f.servers).find((s) => s.id === activeServerId) ||
    servers[0];

  const handleChannelClick = (channel: any) => {
    if (channel.type === 'voice') {
      // Connect to voice immediately and open voice stage
      connectToVoice(channel.id, channel.name, currentServer.id, currentServer.name);
    } else {
      setActiveChannel(channel.id);
    }
  };

  return (
    <aside className="w-60 h-full bg-[#2b2d31] flex flex-col flex-shrink-0 select-none border-r border-[#1f2023] z-20">
      {/* 1. Header (Search Bar in Home or Server Header) */}
      {isHome ? (
        <div className="h-12 px-3 flex items-center border-b border-[#1f2023] shadow-sm flex-shrink-0">
          <button className="w-full h-7 px-2 bg-[#1e1f22] text-[#949ba4] text-xs font-medium rounded-[4px] flex items-center justify-between hover:text-[#dbdee1] transition-colors cursor-pointer">
            <span className="flex items-center gap-1.5 truncate">
              <Search className="w-3.5 h-3.5" />
              <span>Encontre ou comece...</span>
            </span>
            <kbd className="bg-[#2b2d31] text-[10px] px-1 py-0.5 rounded text-[#949ba4] font-sans">
              Ctrl+K
            </kbd>
          </button>
        </div>
      ) : (
        <div className="relative flex-shrink-0">
          {currentServer.bannerImage || currentServer.banner ? (
            <div className="w-full h-32 relative overflow-hidden flex flex-col justify-end">
              <img
                src={(currentServer.bannerImage || currentServer.banner) as string}
                alt={currentServer.name}
                className="absolute inset-0 w-full h-32 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2b2d31] via-[#2b2d31]/30 to-black/20 pointer-events-none" />
              <button
                onClick={() => setIsServerMenuOpen(!isServerMenuOpen)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setIsServerMenuOpen(true);
                }}
                className="relative z-10 w-full h-12 px-4 flex items-center justify-between font-semibold text-[15px] text-white hover:bg-black/20 transition-colors cursor-pointer border-b border-[#1f2023] shadow-sm"
              >
                <span className="truncate drop-shadow-md flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{currentServer.name}</span>
                  {currentServer.isVerified && (
                    <LycVerifiedBadge style={currentServer.verifiedBadgeStyle || 'blue'} size="sm" />
                  )}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-white drop-shadow transition-transform duration-200 ${
                    isServerMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsServerMenuOpen(!isServerMenuOpen)}
              onContextMenu={(e) => {
                e.preventDefault();
                setIsServerMenuOpen(true);
              }}
              className="w-full h-12 px-4 flex items-center justify-between font-semibold text-[15px] text-white border-b border-[#1f2023] hover:bg-white/[0.04] transition-colors cursor-pointer shadow-sm"
            >
              <span className="truncate tracking-tight flex items-center gap-1.5 min-w-0">
                <span className="truncate">{currentServer.name}</span>
                {currentServer.isVerified && (
                  <LycVerifiedBadge style={currentServer.verifiedBadgeStyle || 'blue'} size="sm" />
                )}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-[#949ba4] transition-transform duration-200 ${
                  isServerMenuOpen ? 'rotate-180 text-white' : ''
                }`}
              />
            </button>
          )}

          {/* Server Dropdown Popover */}
          {isServerMenuOpen && (
            <div
              className={`absolute ${currentServer.bannerImage || currentServer.banner ? 'top-32' : 'top-12'} left-2 right-2 bg-[#111214] p-1.5 rounded-md shadow-2xl border border-[#202225] z-50 text-xs space-y-0.5 animate-in fade-in duration-100`}
              onClick={() => setIsServerMenuOpen(false)}
            >
              <button
                onClick={() => {
                  setIsServerMenuOpen(false);
                  openServerBoostModal();
                }}
                className="w-full flex items-center justify-between px-2 py-2 rounded text-[#eb459e] hover:bg-[#eb459e] hover:text-white transition-colors cursor-pointer font-semibold group"
              >
                <span>Impulso de Servidor</span>
                {isOfficialCommunity(currentServer) ? (
                  <Infinity className="w-4 h-4 text-[#eb459e] group-hover:text-white" />
                ) : (
                  <Gem className="w-4 h-4 text-[#eb459e] group-hover:text-white fill-[#eb459e] group-hover:fill-white" />
                )}
              </button>
              <div className="h-[1px] bg-[#232428] my-1" />
              <button
                onClick={() => {
                  setIsServerMenuOpen(false);
                  setIsInviteModalOpen(true);
                }}
                className="w-full flex items-center justify-between px-2 py-2 rounded text-[#949ba4] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer"
              >
                <span>Convidar Pessoas</span>
                <UserPlus className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsServerMenuOpen(false);
                  openServerSettings();
                }}
                className="w-full flex items-center justify-between px-2 py-2 rounded text-[#949ba4] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer"
              >
                <span>Configurações do Servidor</span>
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsServerMenuOpen(false);
                  openCreateChannel();
                }}
                className="w-full flex items-center justify-between px-2 py-2 rounded text-[#949ba4] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer"
              >
                <span>Criar Canal</span>
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsServerMenuOpen(false);
                  openCreateCategory();
                }}
                className="w-full flex items-center justify-between px-2 py-2 rounded text-[#949ba4] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer"
              >
                <span>Criar Categoria</span>
                <FolderPlus className="w-4 h-4" />
              </button>
              <div className="h-[1px] bg-[#232428] my-1" />
              <button className="w-full flex items-center justify-between px-2 py-2 rounded text-[#949ba4] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer">
                <span>Config. de Notificações</span>
                <Bell className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsServerMenuOpen(false);
                  setIsLeaveModalOpen(true);
                }}
                className="w-full flex items-center justify-between px-2 py-2 rounded text-[#f23f43] hover:bg-[#f23f43] hover:text-white transition-colors cursor-pointer"
              >
                <span>Sair do Servidor</span>
                <ShieldAlert className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Main Scroll Area for Channels or DMs */}
      <div
        onContextMenu={(e) => {
          if (isHome) return;
          e.preventDefault();
          setChannelContextMenu(null);
          setVoiceContextMenu(null);
          setCategoryContextMenu(null);
          setSidebarContextMenu({
            position: { x: e.clientX, y: e.clientY },
          });
        }}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-3 scrollbar-thin"
      >
        {isHome ? (
          /* Home Navigation Tabs & Direct Messages */
          <div className="space-y-3">
            <div className="space-y-0.5">
              {/* 1. Amigos (Capivaras) */}
              <button
                onClick={() => setActiveHomeTab('friends')}
                title="Amigos"
                className={`w-full h-11 flex items-center gap-3.5 px-2.5 rounded-lg font-medium text-[14px] transition-all cursor-pointer group select-none ${
                  activeHomeTab === 'friends'
                    ? 'bg-[#404249] text-white shadow-sm'
                    : 'text-[#949ba4] hover:bg-[#35373c]/60 hover:text-[#dbdee1]'
                }`}
              >
                <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                  <img
                    src="/amigos.svg"
                    alt="Amigos"
                    className="w-6 h-6 object-contain transition-transform duration-200 group-hover:scale-110 drop-shadow-sm"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.fallback) {
                        target.dataset.fallback = '1';
                        target.src = '/brand/03_UI_Icons_SVG/icon_amigos.svg';
                      }
                    }}
                  />
                </div>
                <span className={activeHomeTab === 'friends' ? 'font-semibold text-white' : ''}>Amigos</span>
              </button>

              {/* 2. Ultra Pass (Coroa Estilizada) */}
              <button
                onClick={() => setActiveHomeTab('ultra-pass')}
                title="Ultra Pass"
                className={`w-full h-11 flex items-center gap-3.5 px-2.5 rounded-lg font-medium text-[14px] transition-all cursor-pointer group select-none ${
                  activeHomeTab === 'ultra-pass' || activeHomeTab === 'nitro'
                    ? 'bg-[#3b236d] text-white shadow-md shadow-[#3b236d]/40'
                    : 'text-[#949ba4] hover:bg-[#35373c]/60 hover:text-[#dbdee1]'
                }`}
              >
                <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                  <Crown
                    className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                      activeHomeTab === 'ultra-pass' || activeHomeTab === 'nitro'
                        ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                        : 'text-[#949ba4] group-hover:text-white'
                    }`}
                  />
                </div>
                <span className={activeHomeTab === 'ultra-pass' || activeHomeTab === 'nitro' ? 'font-semibold text-white' : ''}>
                  Ultra Pass
                </span>
              </button>

              {/* 3. Loja (Sacola com Focinho) */}
              <button
                onClick={() => setActiveHomeTab('shop')}
                title="Loja"
                className={`w-full h-11 flex items-center gap-3.5 px-2.5 rounded-lg font-medium text-[14px] transition-all cursor-pointer group select-none ${
                  activeHomeTab === 'shop'
                    ? 'bg-[#404249] text-white shadow-sm'
                    : 'text-[#949ba4] hover:bg-[#35373c]/60 hover:text-[#dbdee1]'
                }`}
              >
                <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                  <img
                    src="/loja.svg"
                    alt="Loja"
                    className="w-6 h-6 object-contain transition-transform duration-200 group-hover:scale-110 drop-shadow-sm"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.fallback) {
                        target.dataset.fallback = '1';
                        target.src = '/brand/03_UI_Icons_SVG/icon_loja.svg';
                      }
                    }}
                  />
                </div>
                <span className={activeHomeTab === 'shop' ? 'font-semibold text-white' : ''}>Loja</span>
              </button>

              {/* 4. Missões (Alvo Verde com Patinha) */}
              <button
                onClick={() => setActiveHomeTab('missions')}
                title="Missões"
                className={`w-full h-11 flex items-center gap-3.5 px-2.5 rounded-lg font-medium text-[14px] transition-all cursor-pointer group select-none ${
                  activeHomeTab === 'missions'
                    ? 'bg-[#404249] text-white shadow-sm'
                    : 'text-[#949ba4] hover:bg-[#35373c]/60 hover:text-[#dbdee1]'
                }`}
              >
                <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                  <img
                    src="/missoes.svg"
                    alt="Missões"
                    className="w-6 h-6 object-contain transition-transform duration-200 group-hover:scale-110 drop-shadow-sm"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.fallback) {
                        target.dataset.fallback = '1';
                        target.src = '/brand/03_UI_Icons_SVG/icon_missoes.svg';
                      }
                    }}
                  />
                </div>
                <span className={activeHomeTab === 'missions' ? 'font-semibold text-white' : ''}>Missões</span>
              </button>
            </div>

            {/* Direct Messages Section */}
            <div>
              <div className="flex items-center justify-between px-2 pt-3 pb-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wide group hover:text-[#dbdee1]">
                <span>Mensagens Diretas</span>
                <button
                  title="Criar conversa privada"
                  className="p-0.5 hover:text-white transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-0.5 space-y-0.5">
                {(communityMembers || [])
                  .filter((u) => u.id !== (storeCurrentUser?.id || currentUser.id) && u.id !== 'user-me')
                  .slice(0, 8).map((user) => {
                  const isDmActive = activeChannelId === `dm-${user.id}`;

                  return (
                    <div
                      key={user.id}
                      onClick={() => setActiveChannel(`dm-${user.id}`)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setVoiceContextMenu({
                          user,
                          position: { x: e.clientX, y: e.clientY },
                        });
                      }}
                      className={`w-full h-10 flex items-center justify-between px-2 rounded text-[14px] transition-colors group cursor-pointer ${
                        isDmActive
                          ? 'bg-[#404249] text-white'
                          : 'text-[#949ba4] hover:bg-[#35373c]/60 hover:text-[#dbdee1]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate min-w-0">
                        <div className="relative flex-shrink-0">
                          <img
                            src={getAvatarUrl(user.avatar)}
                            alt={user.name}
                            className="w-7 h-7 rounded-full object-cover"
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
                        <div className="flex flex-col text-left truncate flex-1 leading-tight">
                          <span className="truncate font-semibold text-xs">
                            {user.displayName || user.name}
                          </span>
                          <span className="text-[11px] text-[#80848e] truncate">
                            {user.activity?.name || user.customStatus || `@${user.name}`}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        title="Fechar DM"
                        className="opacity-0 group-hover:opacity-100 p-1 text-[#949ba4] hover:text-white transition-opacity cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Server Categories & Channels */
          <>
            {/* 2.0 Barra de Progresso do Impulso (Server Boost Pill) */}
            {currentServer.showBoostProgressBar !== false && (() => {
              const boostLevel = getCommunityBoostLevel(currentServer);
              const medal = getCommunityLevelMedal(boostLevel);
              const boostCount = currentServer.boostCount ?? 0;
              const progressPercent = boostLevel >= 3 ? 100 : Math.min(100, Math.round((boostCount / 14) * 100));

              return (
                <div className="px-1 pt-1 pb-1.5">
                  <div
                    onClick={() => openServerBoostModal()}
                    title={`Vantagens de Impulso: ${medal.label} (Medalha de ${medal.name}) — Clique para gerenciar`}
                    className="group relative overflow-hidden rounded-xl bg-[#232428]/90 hover:bg-[#2b2d31] border border-[#2b2d31] hover:border-[#ec417a]/50 p-2.5 cursor-pointer transition-all duration-200 shadow-sm"
                  >
                    {/* Fundo com leve gradiente de brilho ao passar o mouse */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#ec417a]/0 via-[#f47fff]/0 to-[#5865f2]/0 group-hover:from-[#ec417a]/5 group-hover:via-[#f47fff]/5 group-hover:to-[#5865f2]/5 transition-colors duration-300 pointer-events-none" />

                    <div className="flex items-center justify-between gap-2 mb-1.5 relative z-10">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <img
                          src={medal.medalUrl}
                          alt={`Medalha de ${medal.name}`}
                          className="w-5 h-5 object-contain flex-shrink-0 drop-shadow-sm group-hover:scale-110 transition-transform duration-200 select-none pointer-events-none"
                        />
                        <span className="text-[12px] font-bold text-white tracking-wide truncate group-hover:text-[#f47fff] transition-colors">
                          {boostLevel >= 3
                            ? 'Nível 3 • Máximo'
                            : boostLevel === 0
                            ? 'Sem Nível'
                            : `Nível ${boostLevel}`}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-[#ec417a] group-hover:text-[#f47fff] transition-colors flex-shrink-0 flex items-center gap-1">
                        {isOfficialCommunity(currentServer) ? (
                          <Infinity className="w-3.5 h-3.5 text-[#ec417a] group-hover:text-[#f47fff]" />
                        ) : (
                          <>
                            <Gem className="w-3.5 h-3.5 text-[#ec417a] group-hover:text-[#f47fff] fill-[#ec417a]" />
                            <span>{boostCount} Impulsos</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Barra de Progresso Arredondada em Gradiente Rosa/Roxo */}
                    <div className="relative w-full h-2 rounded-full bg-[#111214] overflow-hidden p-0.5 border border-[#1e1f22] z-10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ec417a] via-[#f47fff] to-[#5865f2] transition-all duration-500 shadow-[0_0_8px_rgba(236,65,122,0.6)]"
                        style={{
                          width: `${progressPercent}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {currentServer.categories.map((category) => {
            const isCollapsed = !!collapsedCategories[category.id];
            const isCategoryBeingDragged =
              draggedItem?.type === 'category' && draggedItem.sourceCategoryId === category.id;
            const isCategoryDropAbove =
              dropTarget?.id === category.id && dropTarget.type === 'category' && dropTarget.position === 'above';
            const isCategoryDropBelow =
              dropTarget?.id === category.id && dropTarget.type === 'category' && dropTarget.position === 'below';
            const isCategoryDropInside =
              dropTarget?.id === category.id && dropTarget.position === 'inside';

            return (
              <div key={category.id} className="pt-2 first:pt-0 relative">
                {/* Visual Line Indicator Above Category */}
                {isCategoryDropAbove && (
                  <div className="h-[2px] bg-[#5865f2] rounded-full mx-1 mb-1 shadow-[0_0_8px_rgba(88,101,242,0.8)] transition-all animate-pulse" />
                )}

                {/* 2.1 Category Header */}
                <div
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'text/plain',
                      JSON.stringify({ type: 'category', sourceCategoryId: category.id })
                    );
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedItem({ type: 'category', sourceCategoryId: category.id });
                  }}
                  onDragEnd={() => {
                    setDraggedItem(null);
                    setDropTarget(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    if (draggedItem?.type === 'category') {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const position = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
                      setDropTarget({ id: category.id, type: 'category', position });
                    } else if (draggedItem?.type === 'channel') {
                      setDropTarget({ id: category.id, type: 'category', position: 'inside' });
                    }
                  }}
                  onDragLeave={(e) => {
                    const related = e.relatedTarget as Node | null;
                    if (!e.currentTarget.contains(related)) {
                      if (dropTarget?.id === category.id) setDropTarget(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedItem?.type === 'category') {
                      const targetIdx = currentServer.categories.findIndex((c) => c.id === category.id);
                      if (targetIdx !== -1) {
                        const insertIdx = dropTarget?.position === 'below' ? targetIdx + 1 : targetIdx;
                        moveCategory(currentServer.id, draggedItem.sourceCategoryId, insertIdx);
                      }
                    } else if (draggedItem?.type === 'channel' && draggedItem.channelId) {
                      moveChannel(currentServer.id, draggedItem.sourceCategoryId, category.id, draggedItem.channelId, 0);
                    }
                    setDraggedItem(null);
                    setDropTarget(null);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setChannelContextMenu(null);
                    setVoiceContextMenu(null);
                    setSidebarContextMenu(null);
                    setCategoryContextMenu({
                      category,
                      position: { x: e.clientX, y: e.clientY },
                    });
                  }}
                  className={`w-full h-6 flex items-center justify-between px-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wide group/cat cursor-pointer select-none theme-cat-header transition-all duration-150 ${
                    isCategoryBeingDragged ? 'opacity-50' : ''
                  } ${
                    category.isMuted ? 'opacity-50' : ''
                  } ${
                    isCategoryDropInside ? 'ring-1 ring-[#5865f2] bg-[#5865f2]/10 rounded' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center gap-1 hover:text-[#dbdee1] transition-colors cursor-pointer select-none truncate flex-1 text-left"
                  >
                    <ChevronDown
                      className={`w-3 h-3 text-[#949ba4] transition-transform duration-200 flex-shrink-0 ${
                        isCollapsed ? '-rotate-90' : ''
                      }`}
                    />
                    <span className="truncate">{category.name}</span>
                    {category.isMuted && (
                      <BellOff className="w-3 h-3 text-[#80848e] flex-shrink-0 ml-1" />
                    )}
                  </button>
                  <div className="opacity-0 group-hover/cat:opacity-100 flex items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderCategories(currentServer.id, category.id, 'up');
                      }}
                      title="Mover categoria para cima"
                      className="p-0.5 hover:text-[#dbdee1] transition-colors cursor-pointer"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderCategories(currentServer.id, category.id, 'down');
                      }}
                      title="Mover categoria para baixo"
                      className="p-0.5 hover:text-[#dbdee1] transition-colors cursor-pointer"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openCreateChannel(category.id);
                      }}
                      title="Criar canal"
                      className="p-0.5 hover:text-[#dbdee1] rounded transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Visual Line Indicator Below Category */}
                {isCategoryDropBelow && (
                  <div className="h-[2px] bg-[#5865f2] rounded-full mx-1 mt-1 shadow-[0_0_8px_rgba(88,101,242,0.8)] transition-all animate-pulse" />
                )}

                {/* 2.2 Channels List */}
                {!isCollapsed && (
                  <div className="space-y-[2px] mt-0.5">
                    {category.channels
                      .filter((channel) => !hideMutedChannels || !channel.isMuted)
                      .map((channel) => {
                      const isVoice = channel.type === 'voice';
                      const isAnnouncement = channel.type === 'announcement';
                      const isForum = channel.type === 'forum';
                      const isVoiceConnectedHere =
                        isVoice &&
                        voiceState.isConnected &&
                        voiceState.channelId === channel.id;

                      const isActive =
                        activeChannelId === channel.id || isVoiceConnectedHere;

                      const isChannelBeingDragged =
                        draggedItem?.type === 'channel' && draggedItem.channelId === channel.id;
                      const isChannelDropAbove =
                        dropTarget?.id === channel.id && dropTarget.type === 'channel' && dropTarget.position === 'above';
                      const isChannelDropBelow =
                        dropTarget?.id === channel.id && dropTarget.type === 'channel' && dropTarget.position === 'below';

                      return (
                        <div key={channel.id} className="space-y-0.5 relative">
                          {/* Visual Indicator Line Above Channel */}
                          {isChannelDropAbove && (
                            <div className="h-[2px] bg-[#5865f2] rounded-full mx-1 my-0.5 shadow-[0_0_8px_rgba(88,101,242,0.8)] transition-all animate-pulse" />
                          )}

                          {/* Channel Item Row */}
                          <div
                            role="button"
                            tabIndex={0}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                'text/plain',
                                JSON.stringify({
                                  type: 'channel',
                                  channelId: channel.id,
                                  sourceCategoryId: category.id,
                                })
                              );
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedItem({
                                type: 'channel',
                                channelId: channel.id,
                                sourceCategoryId: category.id,
                              });
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDropTarget(null);
                            }}
                            onDragOver={(e) => {
                              if (draggedItem?.type === 'channel') {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = 'move';
                                const rect = e.currentTarget.getBoundingClientRect();
                                const position = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
                                setDropTarget({ id: channel.id, type: 'channel', position });
                              }
                            }}
                            onDragLeave={(e) => {
                              const related = e.relatedTarget as Node | null;
                              if (!e.currentTarget.contains(related)) {
                                if (dropTarget?.id === channel.id) setDropTarget(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (draggedItem?.type === 'channel' && draggedItem.channelId) {
                                const targetIdx = category.channels.findIndex((c) => c.id === channel.id);
                                if (targetIdx !== -1) {
                                  const insertIdx = dropTarget?.position === 'below' ? targetIdx + 1 : targetIdx;
                                  moveChannel(
                                    currentServer.id,
                                    draggedItem.sourceCategoryId,
                                    category.id,
                                    draggedItem.channelId,
                                    insertIdx
                                  );
                                }
                              }
                              setDraggedItem(null);
                              setDropTarget(null);
                            }}
                            onClick={() => handleChannelClick(channel)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleChannelClick(channel);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCategoryContextMenu(null);
                              setVoiceContextMenu(null);
                              setSidebarContextMenu(null);
                              setChannelContextMenu({
                                channel: { ...channel, categoryId: category.id },
                                position: { x: e.clientX, y: e.clientY },
                              });
                            }}
                            className={`w-full h-8 flex items-center justify-between px-2 rounded text-[14px] font-medium transition-colors cursor-pointer group select-none ${
                              isChannelBeingDragged ? 'opacity-50' : ''
                            } ${
                              channel.isMuted ? 'opacity-50' : ''
                            } ${
                              isActive
                                ? 'bg-[#404249] text-white'
                                : 'text-[#949ba4] hover:bg-[#35373c]/60 hover:text-[#dbdee1]'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                              {/* Channel Icon (with superimposed lock for private channels) */}
                              <div className="relative w-5 h-5 flex items-center justify-center flex-shrink-0 select-none">
                                {isVoice ? (
                                  <Volume2
                                    className={`w-4 h-4 transition-colors ${
                                      isActive
                                        ? 'text-white'
                                        : 'text-[#80848e] group-hover:text-[#dbdee1]'
                                    }`}
                                  />
                                ) : isAnnouncement ? (
                                  <Megaphone
                                    className={`w-4 h-4 transition-colors ${
                                      isActive
                                        ? 'text-white'
                                        : 'text-[#80848e] group-hover:text-[#dbdee1]'
                                    }`}
                                  />
                                ) : isForum ? (
                                  <MessagesSquare
                                    className={`w-4 h-4 transition-colors ${
                                      isActive
                                        ? 'text-white'
                                        : 'text-[#80848e] group-hover:text-[#dbdee1]'
                                    }`}
                                  />
                                ) : (
                                  <Hash
                                    className={`w-4 h-4 transition-colors ${
                                      isActive
                                        ? 'text-white'
                                        : 'text-[#80848e] group-hover:text-[#dbdee1]'
                                    }`}
                                  />
                                )}

                                {channel.isPrivate && (
                                  <Lock
                                    className={`w-2.5 h-2.5 absolute -top-0.5 -right-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition-colors ${
                                      isActive
                                        ? 'text-white'
                                        : 'text-[#80848e] group-hover:text-[#dbdee1]'
                                    }`}
                                    strokeWidth={2.5}
                                  />
                                )}
                              </div>
                              <span className="truncate leading-none">{channel.name}</span>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Reorder Buttons on hover */}
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    reorderChannels(currentServer.id, category.id, channel.id, 'up');
                                  }}
                                  title="Mover canal para cima"
                                  className="p-0.5 hover:text-white text-[#949ba4] cursor-pointer"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    reorderChannels(currentServer.id, category.id, channel.id, 'down');
                                  }}
                                  title="Mover canal para baixo"
                                  className="p-0.5 hover:text-white text-[#949ba4] cursor-pointer"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingChannel({ channel, categoryId: category.id });
                                  }}
                                  title="Editar canal"
                                  className="p-0.5 hover:text-white text-[#949ba4] transition-colors cursor-pointer"
                                >
                                  <Settings className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Muted Icon */}
                              {channel.isMuted && (
                                <BellOff className="w-3.5 h-3.5 text-[#80848e] mr-0.5" />
                              )}

                              {/* Unread / Mention Badge */}
                              {channel.mentionCount ? (
                                <span className="bg-[#f23f43] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                                  {channel.mentionCount}
                                </span>
                              ) : channel.unread ? (
                                <span className="w-2 h-2 rounded-full bg-white" />
                              ) : null}
                            </div>
                          </div>

                          {/* Visual Indicator Line Below Channel */}
                          {isChannelDropBelow && (
                            <div className="h-[2px] bg-[#5865f2] rounded-full mx-1 my-0.5 shadow-[0_0_8px_rgba(88,101,242,0.8)] transition-all animate-pulse" />
                          )}

                          {/* 2.3 Connected Voice Participants List inside Voice Channel */}
                          {isVoiceConnectedHere && (
                            <div className="pl-6 pr-1 py-1 space-y-1">
                              {voiceState.participants.map((p) => (
                                <div
                                  key={p.user.id}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    setVoiceContextMenu({
                                      user: p.user,
                                      position: { x: e.clientX, y: e.clientY },
                                    });
                                  }}
                                  className="flex items-center justify-between py-1 px-2 rounded-[4px] hover:bg-[#35373c]/40 text-xs transition-colors cursor-pointer group/vp"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <div className="relative">
                                      <img
                                        src={getAvatarUrl(p.user.avatar)}
                                        alt={p.user.name}
                                        className={`w-6 h-6 rounded-full object-cover ${
                                          p.isSpeaking
                                            ? 'ring-2 ring-[#23a55a] shadow-[0_0_8px_rgba(35,165,90,0.5)]'
                                            : ''
                                        }`}
                                      />
                                    </div>
                                    <span
                                      className={`truncate font-medium ${
                                        p.isSpeaking
                                          ? 'text-[#23a55a]'
                                          : 'text-[#dbdee1]'
                                      }`}
                                    >
                                      {p.user.displayName || p.user.name}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 text-[#80848e]">
                                    {p.isScreenSharing && (
                                      <span className="bg-[#5865f2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                        <Monitor className="w-2.5 h-2.5" />
                                        AO VIVO
                                      </span>
                                    )}
                                    {p.isMuted && (
                                      <MicOff className="w-3.5 h-3.5 text-[#f23f43]" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Empty Category Drop Zone */}
                    {category.channels.length === 0 && (
                      <div
                        onDragOver={(e) => {
                          if (draggedItem?.type === 'channel') {
                            e.preventDefault();
                            setDropTarget({ id: category.id, type: 'category', position: 'inside' });
                          }
                        }}
                        onDragLeave={() => {
                          if (dropTarget?.id === category.id) setDropTarget(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedItem?.type === 'channel' && draggedItem.channelId) {
                            moveChannel(
                              currentServer.id,
                              draggedItem.sourceCategoryId,
                              category.id,
                              draggedItem.channelId,
                              0
                            );
                          }
                          setDraggedItem(null);
                          setDropTarget(null);
                        }}
                        className={`h-7 mx-1 my-0.5 rounded border border-dashed flex items-center justify-center text-[10px] transition-colors ${
                          dropTarget?.id === category.id && dropTarget.position === 'inside'
                            ? 'border-[#5865f2] bg-[#5865f2]/10 text-[#5865f2]'
                            : 'border-[#35373c] text-[#80848e]'
                        }`}
                      >
                        <span>Solte um canal aqui</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
      </div>

      {/* 3. User Profile Footer with Voice Connection RTC Bar */}
      <DiscordUserFooter />

      {/* 4. User / Voice Participant Context Menu */}
      {voiceContextMenu && (
        <DiscordUserContextMenu
          user={voiceContextMenu.user}
          position={voiceContextMenu.position}
          context="voice"
          onClose={() => setVoiceContextMenu(null)}
          onOpenProfile={(u) => {
            setVoiceContextMenu(null);
            openMemberPopout(u, {
              top: voiceContextMenu.position.y,
              right: window.innerWidth - voiceContextMenu.position.x,
            });
          }}
        />
      )}

      {/* 5. Channel Context Menu */}
      {channelContextMenu && (
        <DiscordChannelContextMenu
          channel={channelContextMenu.channel}
          categoryId={channelContextMenu.channel.categoryId}
          position={channelContextMenu.position}
          onClose={() => setChannelContextMenu(null)}
          onMarkAsRead={() => {
            markChannelAsRead(
              currentServer.id,
              channelContextMenu.channel.categoryId,
              channelContextMenu.channel.id
            );
            setChannelContextMenu(null);
          }}
          onToggleMute={() => {
            toggleMuteChannel(
              currentServer.id,
              channelContextMenu.channel.categoryId,
              channelContextMenu.channel.id
            );
            setChannelContextMenu(null);
          }}
          onInvite={() => {
            setIsInviteModalOpen(true);
            setChannelContextMenu(null);
          }}
          onCopyLink={() => {
            const serverSlug = currentServer.id === 'server-lyc' ? 'capychat-oficial' : (currentServer.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'capychat-oficial');
            const link = `https://capy.ofc/invite/${serverSlug}/${channelContextMenu.channel.id}`;
            navigator.clipboard.writeText(link).catch(() => {});
            setChannelContextMenu(null);
          }}
          onCopyId={() => {
            navigator.clipboard.writeText(channelContextMenu.channel.id).catch(() => {});
            setChannelContextMenu(null);
          }}
          onCreateChannel={() => {
            openCreateChannel(channelContextMenu.channel.categoryId);
            setChannelContextMenu(null);
          }}
          onDuplicate={() => {
            duplicateChannel(
              currentServer.id,
              channelContextMenu.channel.categoryId,
              channelContextMenu.channel.id
            );
            setChannelContextMenu(null);
          }}
          onMoveUp={() => {
            reorderChannels(
              currentServer.id,
              channelContextMenu.channel.categoryId,
              channelContextMenu.channel.id,
              'up'
            );
            setChannelContextMenu(null);
          }}
          onMoveDown={() => {
            reorderChannels(
              currentServer.id,
              channelContextMenu.channel.categoryId,
              channelContextMenu.channel.id,
              'down'
            );
            setChannelContextMenu(null);
          }}
          onEdit={() => {
            setEditingChannel({
              channel: channelContextMenu.channel,
              categoryId: channelContextMenu.channel.categoryId,
            });
            setChannelContextMenu(null);
          }}
          onDelete={() => {
            setDeleteChannelModal({ channel: channelContextMenu.channel });
            setChannelContextMenu(null);
          }}
        />
      )}

      {/* 5.5. Category Context Menu */}
      {categoryContextMenu && (
        <DiscordCategoryContextMenu
          category={categoryContextMenu.category}
          isCollapsed={!!collapsedCategories[categoryContextMenu.category.id]}
          position={categoryContextMenu.position}
          onClose={() => setCategoryContextMenu(null)}
          onMarkAsRead={() => {
            markCategoryAsRead(currentServer.id, categoryContextMenu.category.id);
            setCategoryContextMenu(null);
          }}
          onToggleCollapse={() => {
            toggleCategory(categoryContextMenu.category.id);
            setCategoryContextMenu(null);
          }}
          onToggleMute={() => {
            toggleMuteCategory(currentServer.id, categoryContextMenu.category.id);
            setCategoryContextMenu(null);
          }}
          onCreateChannel={() => {
            openCreateChannel(categoryContextMenu.category.id);
            setCategoryContextMenu(null);
          }}
          onEdit={() => {
            setEditingCategory(categoryContextMenu.category);
            setCategoryContextMenu(null);
          }}
          onDelete={() => {
            setDeleteCategoryModal(categoryContextMenu.category);
            setCategoryContextMenu(null);
          }}
        />
      )}

      {/* 6. Edit Channel Modal */}
      {editingChannel && (
        <DiscordEditChannelModal
          isOpen={!!editingChannel}
          channel={editingChannel.channel}
          categoryId={editingChannel.categoryId}
          serverId={currentServer.id}
          onClose={() => setEditingChannel(null)}
          onDeleteRequest={() => {
            setDeleteChannelModal({
              channel: { ...editingChannel.channel, categoryId: editingChannel.categoryId },
            });
            setEditingChannel(null);
          }}
        />
      )}

      {/* 6.2. Edit Category Modal */}
      {editingCategory && (
        <DiscordEditCategoryModal
          isOpen={!!editingCategory}
          category={editingCategory}
          serverId={currentServer.id}
          onClose={() => setEditingCategory(null)}
          onDeleteRequest={() => {
            setDeleteCategoryModal(editingCategory);
            setEditingCategory(null);
          }}
        />
      )}

      {/* 6.5. Delete Channel Confirmation Modal */}
      <DiscordDeleteConfirmModal
        isOpen={!!deleteChannelModal}
        title={`Excluir #${deleteChannelModal?.channel.name || ''}`}
        description={`Tem certeza que deseja excluir o canal #${deleteChannelModal?.channel.name || ''}? Todas as mensagens serão perdidas permanentemente.`}
        confirmLabel="Excluir Canal"
        onConfirm={() => {
          if (deleteChannelModal) {
            deleteChannel(currentServer.id, deleteChannelModal.channel.categoryId, deleteChannelModal.channel.id);
          }
          setDeleteChannelModal(null);
        }}
        onCancel={() => setDeleteChannelModal(null)}
      />

      {/* 6.6. Delete Category Confirmation Modal */}
      <DiscordDeleteConfirmModal
        isOpen={!!deleteCategoryModal}
        title={`Excluir Categoria ${deleteCategoryModal?.name || ''}`}
        description={`Tem certeza que deseja excluir a categoria ${deleteCategoryModal?.name || ''}? Todos os canais contidos nesta categoria serão removidos permanentemente.`}
        confirmLabel="Excluir Categoria"
        onConfirm={() => {
          if (deleteCategoryModal) {
            deleteCategory(currentServer.id, deleteCategoryModal.id);
          }
          setDeleteCategoryModal(null);
        }}
        onCancel={() => setDeleteCategoryModal(null)}
      />

      {/* 7. Sidebar Empty Area Floating Context Menu */}
      {sidebarContextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed bg-[#111214] border border-[#222327] rounded-lg p-1.5 shadow-2xl z-[9999] min-w-[210px] text-xs animate-in fade-in zoom-in-95 duration-75 select-none"
          style={{
            top: Math.min(sidebarContextMenu.position.y, window.innerHeight - 200),
            left: Math.min(sidebarContextMenu.position.x, window.innerWidth - 230),
          }}
        >
          {/* Option 1: Ocultar canais silenciados */}
          <button
            onClick={() => {
              setHideMutedChannels(!hideMutedChannels);
              setSidebarContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded text-[13px] font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer group"
          >
            <span>Ocultar canais silenciados</span>
            <div
              className={`w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors ${
                hideMutedChannels
                  ? 'bg-[#5865f2] border-[#5865f2] group-hover:bg-white group-hover:border-white'
                  : 'border-[#4e5058] group-hover:border-white'
              }`}
            >
              {hideMutedChannels && (
                <Check className="w-3 h-3 text-white group-hover:text-[#5865f2] stroke-[3]" />
              )}
            </div>
          </button>

          <div className="h-[1px] bg-[#222327] my-1" />

          {/* Option 2: Criar canal */}
          <button
            onClick={() => {
              openCreateChannel();
              setSidebarContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded text-[13px] font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer group"
          >
            <span>Criar canal</span>
            <Plus className="w-4 h-4 text-[#949ba4] group-hover:text-white" />
          </button>

          {/* Option 3: Criar categoria */}
          <button
            onClick={() => {
              openCreateCategory();
              setSidebarContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded text-[13px] font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer group"
          >
            <span>Criar categoria</span>
            <FolderPlus className="w-4 h-4 text-[#949ba4] group-hover:text-white" />
          </button>

          <div className="h-[1px] bg-[#222327] my-1" />

          {/* Option 4: Convidar para o servidor */}
          <button
            onClick={() => {
              setIsInviteModalOpen(true);
              setSidebarContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded text-[13px] font-medium text-[#5865f2] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer group"
          >
            <span>Convidar para o servidor</span>
            <UserPlus className="w-4 h-4 text-[#5865f2] group-hover:text-white" />
          </button>
        </div>
      )}

      {/* 8. Modal de Convite para o Servidor */}
      {isInviteModalOpen && (
        <div
          onClick={() => setIsInviteModalOpen(false)}
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#313338] rounded-lg shadow-2xl border border-[#202225] p-6 space-y-4 animate-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-lg">Convidar amigos para {currentServer.name}</h3>
                <p className="text-xs text-[#949ba4]">Compartilhe o link abaixo para convidar pessoas para o servidor.</p>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-[#949ba4] hover:text-white p-1 rounded hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                Link de Convite do Servidor
              </label>
              <div className="flex items-center gap-2 bg-[#1e1f22] p-2 rounded border border-[#202225]">
                <input
                  type="text"
                  readOnly
                  value={`https://capy.ofc/invite/${currentServer.id === 'server-lyc' ? 'capychat-oficial' : (currentServer.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'capychat-oficial')}`}
                  className="bg-transparent text-sm text-[#dbdee1] flex-1 outline-none select-all font-mono"
                />
                <button
                  onClick={() => {
                    const link = `https://capy.ofc/invite/${currentServer.id === 'server-lyc' ? 'capychat-oficial' : (currentServer.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'capychat-oficial')}`;
                    navigator.clipboard.writeText(link).catch(() => {});
                    setCopiedInvite(true);
                    setTimeout(() => setCopiedInvite(false), 2000);
                  }}
                  className={`px-4 py-1.5 rounded text-xs font-semibold text-white transition-colors cursor-pointer ${
                    copiedInvite ? 'bg-[#23a55a]' : 'bg-[#5865f2] hover:bg-[#4752c4]'
                  }`}
                >
                  {copiedInvite ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="text-[11px] text-[#80848e]">Seu link de convite está configurado para nunca expirar.</p>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal de Confirmação para Sair do Servidor */}
      <DiscordLeaveServerModal
        isOpen={isLeaveModalOpen}
        server={currentServer}
        isOwner={
          currentServer.ownerId === storeCurrentUser.id ||
          (currentServer.id === 'server-lyc' &&
            (storeCurrentUser.role === 'OWNER' || storeCurrentUser.id === 'f8fcd139-cf43-4873-bd7d-a807ecd73567'))
        }
        onConfirm={async () => {
          return await leaveServer(currentServer.id);
        }}
        onCancel={() => setIsLeaveModalOpen(false)}
      />
    </aside>
  );
};
