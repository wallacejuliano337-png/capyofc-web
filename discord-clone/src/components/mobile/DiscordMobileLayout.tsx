import React, { useState, useEffect } from 'react';
import { useDiscord } from '../../store/discordStore';
import { useTheme } from '../../store/themeStore';
import { getAvatarUrl } from '../../utils/avatar';
import { getAssetUrl } from '../../utils/assets';
import { isOfficialCommunity, getCommunityBoostLevel, getCommunityLevelMedal } from '../../services/communityLevel';
import { OfflineBanner } from './OfflineBanner';
import { PWAInstallGuideModal } from './PWAInstallGuideModal';
import { DiscordChatView } from '../discord/DiscordChatView';
import { DiscordMembersSidebar } from '../discord/DiscordMembersSidebar';
import {
  MessageSquare,
  Compass,
  Bell,
  User as UserIcon,
  ChevronLeft,
  Users,
  Hash,
  Volume2,
  ChevronDown,
  ChevronRight,
  LogOut,
  Smartphone,
  Sparkles,
  Settings,
  Shield,
  Circle,
  Plus,
} from 'lucide-react';

export const DiscordMobileLayout: React.FC = () => {
  const {
    activeServerId,
    activeChannelId,
    setActiveServer,
    setActiveChannel,
    servers,
    folders,
    currentUser,
    communityMembers,
    messages,
    collapsedCategories,
    toggleCategory,
    logout,
    openSettingsModal,
    openServerSettings,
    openServerBoostModal,
    updateCurrentUser,
  } = useDiscord();

  const { theme, setTheme } = useTheme();

  // Abas inferiores móveis: 'servers' | 'dms' | 'notifications' | 'you'
  const [mobileTab, setMobileTab] = useState<'servers' | 'dms' | 'notifications' | 'you'>('servers');
  
  // Se o usuário está dentro de um chat específico (tela cheia)
  const [isInChat, setIsInChat] = useState<boolean>(() => {
    // Se já estiver em um canal específico não-home, começa no chat
    return activeServerId !== '@me' || activeChannelId.startsWith('dm-');
  });

  // Gaveta lateral de membros no chat
  const [isMembersDrawerOpen, setIsMembersDrawerOpen] = useState(false);

  // Gaveta lateral de servidores (rail)
  const [isServersRailOpen, setIsServersRailOpen] = useState(false);

  // Modal do guia de instalação PWA para iPhone
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);

  // Detecta se já está rodando como PWA instalado (standalone)
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isPWA =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(Boolean(isPWA));
    }
  }, []);

  const currentServer =
    servers.find((s) => s.id === activeServerId) ||
    (folders || []).flatMap((f) => f.servers).find((s) => s.id === activeServerId) ||
    servers[0];

  const isHome = activeServerId === '@me';
  const isDm = isHome && activeChannelId.startsWith('dm-');
  const isOfficial = currentServer ? isOfficialCommunity(currentServer.id) : false;

  // Lista de amigos para a aba DMs
  const dmUsers = (communityMembers || []).filter((u) => u.id !== currentUser.id);

  // Ao selecionar um canal
  const handleSelectChannel = (channelId: string) => {
    setActiveChannel(channelId);
    setIsInChat(true);
    setIsServersRailOpen(false);
  };

  // Ao selecionar um amigo nas DMs
  const handleSelectDM = (userId: string) => {
    setActiveServer('@me');
    setActiveChannel(`dm-${userId}`);
    setIsInChat(true);
  };

  return (
    <div
      data-theme={theme}
      className={`theme-${theme} flex flex-col h-full w-full overflow-hidden bg-[#1e1f22] text-[#dbdee1] font-sans antialiased select-none fixed inset-0`}
    >
      {/* 1. Banner Offline */}
      <OfflineBanner />

      {/* 2. Top Banner PWA para iPhone (se não estiver em modo standalone e não estiver em chat) */}
      {!isStandalone && !isInChat && (
        <aside
          aria-label="Instalar aplicativo"
          className="bg-gradient-to-r from-[#5865f2] to-[#7c3aed] text-white px-3 py-2 flex items-center justify-between text-xs font-semibold pt-safe shadow-sm z-30"
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 flex-shrink-0" />
            <span>Instale o CapyChat na Tela Inicial do iPhone!</span>
          </div>
          <button
            onClick={() => setIsPwaModalOpen(true)}
            className="px-2.5 py-1 bg-white text-[#5865f2] rounded-full text-[11px] font-bold shadow-sm active:scale-95"
          >
            Instalar
          </button>
        </aside>
      )}

      {/* 3. Área Principal do Conteúdo */}
      <div className="flex-1 w-full flex overflow-hidden relative">
        {/* MODO 1: CHAT EM TELA CHEIA (Quando isInChat é true) */}
        {isInChat ? (
          <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-[#313338] relative">
            {/* Visualização de Chat 100% responsiva com header unificado */}
            <div className="flex-1 w-full flex overflow-hidden relative">
              <DiscordChatView onBack={() => setIsInChat(false)} isMobile={true} />

              {/* Gaveta Lateral de Membros (Desliza da Direita) */}
              {isMembersDrawerOpen && (
                <div className="absolute inset-0 z-50 flex justify-end animate-in fade-in duration-200">
                  <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-xs"
                    onClick={() => setIsMembersDrawerOpen(false)}
                  />
                  <div className="relative w-72 max-w-[80vw] h-full bg-[#2b2d31] shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
                    <div className="p-3 bg-[#1e1f22] border-b border-[#232428] flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Membros — {currentServer?.name || 'CapyChat'}
                      </span>
                      <button
                        onClick={() => setIsMembersDrawerOpen(false)}
                        className="text-[#949ba4] hover:text-white text-xs font-bold px-2 py-1"
                      >
                        Fechar
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <DiscordMembersSidebar />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* MODO 2: LISTAGEM DE ABAS MÓVEIS (Servidores, DMs, Notificações, Você) */
          <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-[#2b2d31]">
            
            {/* ABA 1: SERVIDORES & COMUNIDADES */}
            {mobileTab === 'servers' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header da Comunidade */}
                <div className="p-3 bg-[#1e1f22] border-b border-[#111214] flex items-center justify-between pt-safe">
                  <div className="flex items-center gap-2 truncate">
                    <img
                      src={getAssetUrl('logos/capy-white.png')}
                      alt=""
                      className="w-6 h-6 object-contain rounded bg-[#5865f2] p-0.5 flex-shrink-0"
                    />
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white truncate">
                          {currentServer?.name || 'CapyChat Oficial'}
                        </span>
                        {isOfficial && (
                          <span className="text-[#f47fff] font-bold text-xs" title="Comunidade Oficial">
                            ∞
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#949ba4]">
                        {currentServer?.memberCount || 24} membros
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Botão de Trocar Servidor (Gaveta) */}
                    <button
                      onClick={() => setIsServersRailOpen(!isServersRailOpen)}
                      className="px-2.5 py-1 rounded bg-[#313338] text-xs font-semibold text-[#dbdee1] active:bg-[#383a40]"
                    >
                      Servidores
                    </button>
                  </div>
                </div>

                {/* Lista Categorizada de Canais */}
                <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 mobile-scrollbar-none">
                  {/* Pílula de Impulso da Comunidade */}
                  <div className="bg-[#1e1f22] p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Nível 3</span>
                      <span className="text-xs text-[#949ba4]">•</span>
                      <span className="text-xs text-[#f47fff] font-bold">
                        {isOfficial ? '∞' : '24 Impulsos'}
                      </span>
                    </div>
                    <button
                      onClick={() => openServerBoostModal()}
                      className="px-2.5 py-1 bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-white text-[11px] font-bold rounded-lg shadow-sm"
                    >
                      Impulsionar
                    </button>
                  </div>

                  {/* Categorias e Canais */}
                  {currentServer?.categories.map((category) => {
                    const isCollapsed = collapsedCategories[category.id];
                    return (
                      <div key={category.id} className="space-y-1">
                        {/* Título da Categoria */}
                        <button
                          onClick={() => toggleCategory(category.id)}
                          className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider"
                        >
                          <div className="flex items-center gap-1">
                            {isCollapsed ? (
                              <ChevronRight className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                            <span>{category.name}</span>
                          </div>
                          <span className="text-[10px] font-normal lowercase">
                            {category.channels.length} canais
                          </span>
                        </button>

                        {/* Canais dentro da Categoria */}
                        {!isCollapsed && (
                          <div className="space-y-0.5">
                            {category.channels.map((channel) => {
                              const isActive = activeChannelId === channel.id;
                              const isVoiceCh = channel.type === 'voice';
                              return (
                                <button
                                  key={channel.id}
                                  onClick={() => handleSelectChannel(channel.id)}
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                                    isActive
                                      ? 'bg-[#404249] text-white font-semibold'
                                      : 'text-[#949ba4] hover:bg-[#35373c] active:bg-[#3b3e45] hover:text-[#dbdee1]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 truncate">
                                    {isVoiceCh ? (
                                      <Volume2 className="w-4 h-4 text-[#949ba4] flex-shrink-0" />
                                    ) : (
                                      <Hash className="w-4 h-4 text-[#949ba4] flex-shrink-0" />
                                    )}
                                    <span className="truncate text-sm">{channel.name}</span>
                                  </div>
                                  {(channel.unread || (channel.mentionCount && channel.mentionCount > 0)) ? (
                                    <span className="px-1.5 py-0.5 bg-[#f23f43] text-white text-[10px] font-bold rounded-full">
                                      {channel.mentionCount || 1}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ABA 2: MENSAGENS DIRETAS (DMs) */}
            {mobileTab === 'dms' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-3 bg-[#1e1f22] border-b border-[#111214] pt-safe flex items-center justify-between">
                  <h1 className="text-base font-bold text-white">Mensagens Diretas</h1>
                  <span className="text-xs text-[#949ba4]">{dmUsers.length} contatos</span>
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 mobile-scrollbar-none">
                  {dmUsers.length === 0 ? (
                    <div className="p-8 text-center text-[#949ba4]">
                      <p className="text-sm">Nenhuma conversa direta ainda.</p>
                      <p className="text-xs mt-1 text-[#80848e]">
                        Acesse a comunidade e inicie uma conversa com seus amigos!
                      </p>
                    </div>
                  ) : (
                    dmUsers.map((friend) => {
                      const dmKey = `dm-${friend.id}`;
                      const lastMsg = (messages[dmKey] || []).slice(-1)[0];
                      const isOnline = friend.status === 'online';

                      return (
                        <button
                          key={friend.id}
                          onClick={() => handleSelectDM(friend.id)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#35373c] active:bg-[#3b3e45] text-left transition-colors"
                        >
                          <div className="relative flex-shrink-0">
                            <img
                              src={getAvatarUrl(friend.avatar)}
                              alt={friend.displayName || friend.name}
                              className="w-11 h-11 rounded-full object-cover bg-[#1e1f22]"
                            />
                            <span
                              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#2b2d31] ${
                                isOnline ? 'bg-[#23a55a]' : 'bg-[#80848e]'
                              }`}
                            />
                          </div>
                          <div className="flex-1 truncate">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-white truncate">
                                {friend.displayName || friend.name}
                              </span>
                              {lastMsg && (
                                <span className="text-[10px] text-[#80848e]">
                                  {lastMsg.timestamp}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#949ba4] truncate mt-0.5">
                              {lastMsg ? lastMsg.content : friend.customStatus || 'Toque para conversar'}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ABA 3: NOTIFICAÇÕES */}
            {mobileTab === 'notifications' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-3 bg-[#1e1f22] border-b border-[#111214] pt-safe">
                  <h1 className="text-base font-bold text-white">Notificações</h1>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 mobile-scrollbar-none">
                  <div className="bg-[#1e1f22] p-3.5 rounded-xl border border-white/5 space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#f47fff]" />
                      <span className="text-xs font-bold text-white">CapyChat Oficial</span>
                    </div>
                    <p className="text-xs text-[#dbdee1] leading-relaxed">
                      Bem-vindo à versão Web Mobile do CapyChat no iPhone! Você agora pode conversar, acompanhar canais e receber atualizações em qualquer lugar.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 4: VOCÊ (PERFIL E CONFIGURAÇÕES) */}
            {mobileTab === 'you' && (
              <div className="flex-1 flex flex-col h-full overflow-y-auto mobile-scrollbar-none bg-[#1e1f22]">
                <div className="p-4 pt-safe space-y-4">
                  {/* Card do Usuário */}
                  <div className="bg-[#2b2d31] p-4 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={getAvatarUrl(currentUser.avatar)}
                          alt={currentUser.displayName || currentUser.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-[#5865f2]"
                        />
                        <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#23a55a] border-2 border-[#2b2d31]" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-white leading-tight">
                          {currentUser.displayName || currentUser.name}
                        </h2>
                        <span className="text-xs text-[#949ba4]">@{currentUser.name}</span>
                        {currentUser.tag && (
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#5865f2]/20 text-[#5865f2] border border-[#5865f2]/30">
                            <span>{currentUser.tag}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Seletor de Presença */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs text-[#949ba4]">Status:</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => updateCurrentUser({ status: 'online' })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                            currentUser.status === 'online'
                              ? 'bg-[#23a55a] text-white'
                              : 'bg-[#1e1f22] text-[#949ba4]'
                          }`}
                        >
                          <Circle className="w-2.5 h-2.5 fill-current" />
                          <span>Online</span>
                        </button>
                        <button
                          onClick={() => updateCurrentUser({ status: 'idle' })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                            currentUser.status === 'idle'
                              ? 'bg-[#f0b232] text-white'
                              : 'bg-[#1e1f22] text-[#949ba4]'
                          }`}
                        >
                          <span>Ausente</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Atalho Instalação PWA iPhone */}
                  <button
                    onClick={() => setIsPwaModalOpen(true)}
                    className="w-full bg-gradient-to-r from-[#5865f2] to-[#7c3aed] p-3.5 rounded-xl text-left flex items-center justify-between text-white shadow-lg shadow-[#5865f2]/20 active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-bold">Instalar CapyChat no iPhone</div>
                        <div className="text-[11px] text-white/80">
                          Passo a passo para adicionar à Tela de Início
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  {/* Configurações da Conta */}
                  <div className="bg-[#2b2d31] rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                    <button
                      onClick={() => openSettingsModal()}
                      className="w-full p-3.5 flex items-center justify-between text-sm text-white hover:bg-white/5 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Settings className="w-4 h-4 text-[#949ba4]" />
                        <span>Configurações do Usuário</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#949ba4]" />
                    </button>

                    <button
                      onClick={() => setTheme(theme === 'dark' ? 'oled' : 'dark')}
                      className="w-full p-3.5 flex items-center justify-between text-sm text-white hover:bg-white/5 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-4 h-4 text-[#949ba4]" />
                        <span>Tema: {theme === 'oled' ? 'OLED Puro' : 'Escuro Padrão'}</span>
                      </div>
                      <span className="text-xs text-[#5865f2] font-semibold">Alternar</span>
                    </button>

                    <button
                      onClick={() => void logout()}
                      className="w-full p-3.5 flex items-center justify-between text-sm text-[#f23f43] hover:bg-[#f23f43]/10 text-left font-semibold"
                    >
                      <div className="flex items-center gap-3">
                        <LogOut className="w-4 h-4" />
                        <span>Sair da Conta</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GAVETA LATERAL DE SERVIDORES (quando aberta) */}
        {isServersRailOpen && (
          <div className="absolute inset-0 z-50 flex animate-in fade-in duration-200">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setIsServersRailOpen(false)}
            />
            <div className="relative w-64 max-w-[75vw] h-full bg-[#1e1f22] p-3 shadow-2xl flex flex-col z-10 pt-safe animate-in slide-in-from-left duration-200 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#2b2d31]">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Comunidades
                </span>
                <button
                  onClick={() => setIsServersRailOpen(false)}
                  className="text-xs font-bold text-[#949ba4] px-2 py-1"
                >
                  Fechar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 mobile-scrollbar-none">
                {servers.map((server) => {
                  const isActive = activeServerId === server.id;
                  const isOff = isOfficialCommunity(server.id);
                  return (
                    <button
                      key={server.id}
                      onClick={() => {
                        setActiveServer(server.id);
                        setIsServersRailOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                        isActive
                          ? 'bg-[#5865f2] text-white font-bold'
                          : 'bg-[#2b2d31] text-[#dbdee1] hover:bg-[#35373c]'
                      }`}
                    >
                      <img
                        src={getAssetUrl('logos/capy-white.png')}
                        alt=""
                        className="w-8 h-8 rounded-lg p-1 bg-black/20 object-contain flex-shrink-0"
                      />
                      <div className="flex-1 truncate text-left">
                        <div className="text-xs font-bold truncate flex items-center gap-1">
                          <span>{server.name}</span>
                          {isOff && <span className="text-[#f47fff]">∞</span>}
                        </div>
                        <span className="text-[10px] text-white/70">
                          {server.memberCount || 24} membros
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. BARRA DE NAVEGAÇÃO INFERIOR ESTILO DISCORD MOBILE */}
      {/* Visível somente quando NÃO estiver em tela cheia no chat */}
      {!isInChat && (
        <nav
          aria-label="Navegação mobile"
          className="mobile-bottom-nav h-14 w-full bg-[#111214] border-t border-[#1e1f22] pb-safe z-40 flex-shrink-0 select-none shadow-lg"
        >
          {/* Aba 1: Servidores */}
          <button
            onClick={() => setMobileTab('servers')}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors ${
              mobileTab === 'servers' ? 'text-[#5865f2]' : 'text-[#949ba4] hover:text-[#dbdee1]'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-0.5">Servidores</span>
          </button>

          {/* Aba 2: Mensagens Diretas */}
          <button
            onClick={() => setMobileTab('dms')}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors ${
              mobileTab === 'dms' ? 'text-[#5865f2]' : 'text-[#949ba4] hover:text-[#dbdee1]'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-0.5">Mensagens</span>
          </button>

          {/* Aba 3: Notificações */}
          <button
            onClick={() => setMobileTab('notifications')}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors ${
              mobileTab === 'notifications' ? 'text-[#5865f2]' : 'text-[#949ba4] hover:text-[#dbdee1]'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-0.5">Notificações</span>
          </button>

          {/* Aba 4: Você */}
          <button
            onClick={() => setMobileTab('you')}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors ${
              mobileTab === 'you' ? 'text-[#5865f2]' : 'text-[#949ba4] hover:text-[#dbdee1]'
            }`}
          >
            <div className="relative">
              <img
                src={getAvatarUrl(currentUser.avatar)}
                alt=""
                className={`w-5 h-5 rounded-full object-cover ${
                  mobileTab === 'you' ? 'ring-2 ring-[#5865f2]' : ''
                }`}
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#23a55a] ring-1 ring-[#111214]" />
            </div>
            <span className="text-[10px] font-bold mt-0.5">Você</span>
          </button>
        </nav>
      )}

      {/* 5. Modal do Guia de Instalação PWA */}
      <PWAInstallGuideModal
        isOpen={isPwaModalOpen}
        onClose={() => setIsPwaModalOpen(false)}
      />
    </div>
  );
};
