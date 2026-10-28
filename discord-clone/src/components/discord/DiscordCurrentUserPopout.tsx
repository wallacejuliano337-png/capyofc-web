import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDiscord } from '../../store/discordStore';
import { useVoiceStreamStore } from '../../store/voiceStreamStore';
import { UserStatus, resolveServerTagColor, resolveServerTagBadgeIcon } from '../../types/discord';
import { getAvatarUrl, handleAvatarError } from '../../utils/avatar';
import { getAssetUrl } from '../../utils/assets';
import { DiscordBadgesGroup } from './DiscordBadgesGroup';
import { getStyledNameCSS, getFontClassName } from '../../utils/nameStyle';
import {
  Pencil,
  Copy,
  Check,
  Volume2,
  Signal,
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Award,
  Users,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  LogOut,
  Plus,
  Trash2,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

function getLuminance(hex?: string): number {
  if (!hex || !hex.startsWith('#')) return 0.2;
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length !== 6) return 0.2;
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return 0.2;
  const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

const renderFormattedText = (text: string, isLight: boolean) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`hover:underline cursor-pointer font-medium ${
            isLight ? 'text-[#0056b3]' : 'text-[#00a8fc]'
          }`}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export const DiscordCurrentUserPopout: React.FC<Props> = ({
  isOpen,
  onClose,
  anchorRef,
}) => {
  const {
    currentUser,
    updateCurrentUser,
    voiceState,
    isMicMuted,
    isDeafened,
    toggleMute,
    toggleDeafen,
    disconnectFromVoice,
    openUserProfileModal,
    setActiveView,
    isLoggingOut,
    logout,
    savedAccounts,
    switchAccount,
    removeSavedAccount,
    servers,
    activeServerId,
  } = useDiscord();

  const { disconnectAll } = useVoiceStreamStore();

  const popoutRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [isStatusSubmenuOpen, setIsStatusSubmenuOpen] = useState(false);
  const [isSwitchAccountOpen, setIsSwitchAccountOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; bottom: number }>({
    left: 78,
    bottom: 58,
  });

  const currentServer = activeServerId !== '@me' ? servers.find((s) => s.id === activeServerId) : null;
  const currentTagColor = currentServer?.serverTag ? resolveServerTagColor(currentServer.serverTagColor) : null;
  const currentTagBadge = currentServer?.serverTag
    ? resolveServerTagBadgeIcon(currentServer.serverTagBadge, currentServer.serverTagBadgeImage)
    : null;

  // Calculate position relative to the user footer card
  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const left = Math.max(8, rect.left);
      const bottom = Math.max(8, window.innerHeight - rect.top + 8);
      setPosition({ left, bottom });
    }
  }, [isOpen, anchorRef]);

  // Global listener to close on click outside or ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoutRef.current &&
        !popoutRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleResize = () => {
      if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        setPosition({
          left: Math.max(8, rect.left),
          bottom: Math.max(8, window.innerHeight - rect.top + 8),
        });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, onClose, anchorRef]);

  // Scroll to top when opened
  useEffect(() => {
    if (isOpen && popoutRef.current) {
      popoutRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentUser.id).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSetStatus = (status: UserStatus) => {
    updateCurrentUser({ status });
    setIsStatusSubmenuOpen(false);
  };

  const handleEditProfile = () => {
    openUserProfileModal(currentUser);
    onClose();
  };

  const statusOptions: {
    key: UserStatus;
    label: string;
    description: string;
    color: string;
  }[] = [
    {
      key: 'online',
      label: 'Disponível',
      description: 'Você aparecerá como conectado.',
      color: 'bg-[#23a55a]',
    },
    {
      key: 'idle',
      label: 'Ausente',
      description: 'Você está temporariamente ausente.',
      color: 'bg-[#f0b232]',
    },
    {
      key: 'dnd',
      label: 'Não perturbar',
      description: 'Você não receberá notificações na área de trabalho.',
      color: 'bg-[#f23f43]',
    },
    {
      key: 'offline',
      label: 'Invisível',
      description: 'Você não aparecerá como disponível, mas terá acesso a tudo.',
      color: 'bg-[#80848e]',
    },
  ];

  const currentStatusConfig =
    statusOptions.find((s) => s.key === currentUser.status) || statusOptions[0];

  // Theme calculations with fallback to localStorage
  const savedPrimary = typeof window !== 'undefined' ? window.localStorage.getItem('lyc_themePrimaryColor') : null;
  const savedSecondary = typeof window !== 'undefined' ? window.localStorage.getItem('lyc_themeSecondaryColor') : null;

  const primaryTheme = (savedPrimary && savedPrimary.trim() !== '')
    ? savedPrimary
    : (currentUser.themePrimaryColor && currentUser.themePrimaryColor !== '#000000' ? currentUser.themePrimaryColor : undefined);

  const secondaryTheme = (savedSecondary && savedSecondary.trim() !== '')
    ? savedSecondary
    : (currentUser.themeSecondaryColor && currentUser.themeSecondaryColor !== '#000000' ? currentUser.themeSecondaryColor : undefined);

  const effectiveBanner = currentUser.bannerImage || (typeof window !== 'undefined' ? window.localStorage.getItem('lyc_bannerImage') : null) || undefined;

  const hasTheme = Boolean(primaryTheme && secondaryTheme);
  const avgLuminance = hasTheme
    ? (getLuminance(primaryTheme) + getLuminance(secondaryTheme)) / 2
    : 0.1;
  const isPopoutLight = hasTheme && avgLuminance > 0.42;

  const popoutBackground = hasTheme
    ? `linear-gradient(180deg, ${primaryTheme} 0%, ${secondaryTheme} 100%)`
    : '#111214';

  const cardBgClass = hasTheme
    ? (isPopoutLight
        ? 'bg-white/80 backdrop-blur-md border-black/10'
        : 'bg-[#111214]/65 backdrop-blur-md border-white/10')
    : 'bg-[#232428] border-[#2e3035]/50';

  const itemClass = hasTheme
    ? (isPopoutLight
        ? 'text-[#2e3338] hover:bg-black/5 hover:text-[#060607]'
        : 'text-[#dbdee1] hover:bg-white/10 hover:text-white')
  : 'text-[#dbdee1] hover:bg-[#35373c]/60 hover:text-white';

  const itemIconClass = hasTheme
    ? (isPopoutLight ? 'text-[#5c5f66]' : 'text-[#b5bac1]')
    : 'text-[#949ba4]';

  const submenuBgClass = hasTheme
    ? (isPopoutLight
        ? 'bg-white/95 border-black/10 text-[#2e3338]'
        : 'bg-[#18191c]/95 border-white/10 text-[#dbdee1]')
    : 'bg-[#18191c] border-[#2b2d31] text-[#dbdee1]';

  const separatorClass = hasTheme
    ? (isPopoutLight ? 'bg-black/10' : 'bg-white/10')
    : 'bg-[#2e3035]/60';

  return createPortal(
    <div
      ref={popoutRef}
      style={{
        left: `${position.left}px`,
        bottom: `${position.bottom}px`,
        maxHeight: `calc(100vh - ${position.bottom + 16}px)`,
        background: popoutBackground,
        borderColor: hasTheme
          ? (isPopoutLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)')
          : '#222327',
      }}
      className="fixed z-[9999] w-[316px] overflow-y-auto rounded-2xl shadow-2xl text-left select-none animate-in fade-in zoom-in-95 duration-150 scrollbar-thin scrollbar-thumb-black/20 scrollbar-track-transparent border"
    >
      {/* Ambient watermark of the banner across entire background */}
      {effectiveBanner && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-0"
          style={{
            backgroundImage: `url(${effectiveBanner})`,
            backgroundPosition: 'top right',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            opacity: isPopoutLight ? 0.20 : 0.16,
            mixBlendMode: isPopoutLight ? 'multiply' : 'screen',
            maskImage: 'radial-gradient(circle at 80% 20%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0) 85%)',
            WebkitMaskImage: 'radial-gradient(circle at 80% 20%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0) 85%)',
          }}
        />
      )}

      {/* 1. Header Banner */}
      <div
        className="h-[84px] w-full relative overflow-hidden flex items-center justify-center flex-shrink-0 z-10"
        style={{ backgroundColor: currentUser.bannerColor || primaryTheme || '#5865f2' }}
      >
        {effectiveBanner && (
          <img
            src={effectiveBanner}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        )}

        {/* Quick Edit Profile Button over Banner */}
        <button
          onClick={handleEditProfile}
          className="absolute top-2.5 right-2.5 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition-all cursor-pointer backdrop-blur-xs flex items-center justify-center group shadow-md z-20"
          title="Editar Perfil"
        >
          <Pencil className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* 2. Avatar & Badges Section */}
      <div className="px-3 pb-3 relative z-10">
        <div className="relative -top-9 mb-[-24px] flex justify-between items-end min-w-0">
          {/* Avatar with Status Overlap */}
          <div
            onClick={() => {
              openUserProfileModal(currentUser);
              onClose();
            }}
            className="relative group cursor-pointer flex-shrink-0"
            title="Ver perfil completo"
          >
            <img
              src={getAvatarUrl(currentUser.avatar)}
              alt={currentUser.name}
              onError={handleAvatarError}
              className={`w-[72px] h-[72px] rounded-full border-[5px] object-cover bg-[#1e1f22] shadow-xl group-hover:brightness-110 transition-all ${
                isPopoutLight ? 'border-white' : 'border-[#111214]'
              }`}
            />
            {/* View profile indicator */}
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
              <span className="text-[9px] font-bold text-white uppercase tracking-wider bg-black/60 px-1.5 py-0.5 rounded-full">
                Ver
              </span>
            </div>
            {/* Status dot / Mascot sleep */}
            {currentUser.status === 'idle' ? (
              <img
                src={getAssetUrl('brand/04_Recortes_PNG_Alta_Resolucao/Mascotes_Expressoes/06_Dormindo.png')}
                alt="Ausente"
                title="Ausente (Dormindo)"
                className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-[2.5px] bg-[#1F1F26] object-cover shadow ${
                  isPopoutLight ? 'border-white' : 'border-[#111214]'
                }`}
              />
            ) : currentUser.status === 'dnd' ? (
              <div
                title="Não perturbar"
                className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-[2.5px] bg-[#f23f43] flex items-center justify-center shadow ${
                  isPopoutLight ? 'border-white' : 'border-[#111214]'
                }`}
              >
                <div className="w-2 h-0.5 bg-white rounded-full" />
              </div>
            ) : currentUser.status === 'offline' ? (
              <div
                title="Invisível"
                className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-[2.5px] bg-[#80848e] flex items-center justify-center shadow ${
                  isPopoutLight ? 'border-white' : 'border-[#111214]'
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#111214]" />
              </div>
            ) : (
              <span
                title="Disponível"
                className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-[2.5px] bg-[#23a55a] shadow ${
                  isPopoutLight ? 'border-white' : 'border-[#111214]'
                }`}
              />
            )}
          </div>

          {/* Server Tag / Status Pill next to Avatar */}
          {currentServer?.serverTag && currentTagColor && (
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap justify-end">
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-xs select-none leading-none max-w-[150px] truncate border ${
                  isPopoutLight
                    ? 'bg-black/10 border-black/10 text-[#111214]'
                    : 'bg-black/40 border-white/10 text-white'
                }`}
                title={`Tag do servidor: ${currentServer.serverTag}`}
              >
                {currentTagBadge && (
                  <img
                    src={currentTagBadge}
                    alt="Tag"
                    className="w-3.5 h-3.5 object-contain rounded-xs flex-shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                  />
                )}
                <span className="truncate">{currentServer.serverTag}</span>
              </span>
            </div>
          )}
        </div>

        {/* 3. User Identity & Bio (Direct on ambient background) */}
        <div className="mt-3 min-w-0">
          {/* Display Name */}
          {(() => {
            const fontClass = getFontClassName(currentUser.nameFont);
            const styledCSS = getStyledNameCSS(
              currentUser.nameFont,
              currentUser.nameEffect,
              currentUser.nameColor || (isPopoutLight ? '#111214' : '#ffffff')
            );
            return (
              <h3
                className={`font-bold text-[18px] leading-tight break-words min-w-0 [overflow-wrap:anywhere] ${
                  isPopoutLight ? 'text-[#111214]' : 'text-white'
                } ${fontClass}`}
                style={styledCSS}
              >
                {currentUser.displayName || currentUser.name}
              </h3>
            );
          })()}

          {/* Username & Badges inline */}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap min-w-0">
            <span
              className={`text-[13px] font-medium break-all truncate ${
                isPopoutLight ? 'text-[#4e5058]' : 'text-[#949ba4]'
              }`}
            >
              {currentUser.name}
            </span>
            <DiscordBadgesGroup user={currentUser} size={15} />
          </div>

          {/* Custom Status */}
          {currentUser.customStatus && (
            <div
              className={`text-[12px] leading-snug mt-2 break-words [overflow-wrap:anywhere] max-h-20 overflow-y-auto ${
                isPopoutLight ? 'text-[#2e3338]' : 'text-[#dbdee1]'
              }`}
            >
              {renderFormattedText(currentUser.customStatus, isPopoutLight)}
            </div>
          )}

          {/* About Me / Biografia (if distinct from status) */}
          {currentUser.aboutMe && currentUser.aboutMe !== currentUser.customStatus && (
            <div className="mt-2 min-w-0">
              <div
                className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
                  isPopoutLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'
                }`}
              >
                Sobre Mim
              </div>
              <p
                className={`text-[12px] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-28 overflow-y-auto ${
                  isPopoutLight ? 'text-[#2e3338]' : 'text-[#dbdee1]'
                }`}
              >
                {renderFormattedText(currentUser.aboutMe, isPopoutLight)}
              </p>
            </div>
          )}
        </div>

        {/* 4. Voice Connection Section (Conditional) */}
        {voiceState.isConnected && (
          <div className={`mt-2.5 p-2.5 rounded-xl border space-y-2 shadow-sm ${cardBgClass}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#23a55a] text-xs font-bold">
                <Signal className="w-3.5 h-3.5 animate-pulse" />
                <span>EM VOZ</span>
              </div>
              <span className={`text-[10px] ${isPopoutLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>
                {voiceState.pingMs || 24}ms
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Volume2 className={`w-4 h-4 flex-shrink-0 ${isPopoutLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`} />
              <div className="min-w-0 flex-1">
                <div className={`text-xs font-semibold truncate ${isPopoutLight ? 'text-[#111214]' : 'text-white'}`}>
                  {voiceState.channelName}
                </div>
                <div className={`text-[10px] truncate ${isPopoutLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>
                  {voiceState.serverName}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveView('voice-stage');
                onClose();
              }}
              className="w-full py-1.5 px-3 bg-[#23a55a]/15 hover:bg-[#23a55a]/25 text-[#23a55a] border border-[#23a55a]/30 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir chamada de voz
            </button>

            {/* Quick Voice Controls */}
            <div className={`flex items-center justify-center gap-1.5 pt-1 border-t ${separatorClass}`}>
              <button
                onClick={toggleMute}
                title={isMicMuted ? 'Desmutar' : 'Mutar'}
                className={`p-1.5 rounded hover:bg-black/10 text-xs transition-colors ${
                  isMicMuted ? 'text-[#f23f43]' : (isPopoutLight ? 'text-[#5c5f66]' : 'text-[#b5bac1]')
                }`}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleDeafen}
                title={isDeafened ? 'Reativar Áudio' : 'Ensurdecer'}
                className={`p-1.5 rounded hover:bg-black/10 text-xs transition-colors ${
                  isDeafened ? 'text-[#f23f43]' : (isPopoutLight ? 'text-[#5c5f66]' : 'text-[#b5bac1]')
                }`}
              >
                <Headphones className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  disconnectFromVoice();
                  disconnectAll();
                }}
                title="Desconectar"
                className="p-1.5 rounded hover:bg-[#f23f43]/20 text-[#f23f43] text-xs transition-colors"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 5. Grouped Menu: Card 1 (Profile & Status) */}
        <div className={`mt-3 rounded-xl p-1 border shadow-sm ${cardBgClass}`}>
          {/* Button: Editar Perfil */}
          <button
            onClick={handleEditProfile}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${itemClass}`}
          >
            <div className="flex items-center gap-2.5">
              <Pencil className={`w-4 h-4 ${itemIconClass}`} />
              <span>Editar perfil</span>
            </div>
          </button>

          {/* Status Selector Dropdown / Submenu */}
          <div className="relative">
            <button
              onClick={() => setIsStatusSubmenuOpen((prev) => !prev)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${itemClass}`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${currentStatusConfig.color}`} />
                <span>{currentStatusConfig.label}</span>
              </div>
              <ChevronRight
                className={`w-4 h-4 ${itemIconClass} transition-transform ${
                  isStatusSubmenuOpen ? 'rotate-90' : ''
                }`}
              />
            </button>

            {/* Status Options */}
            {isStatusSubmenuOpen && (
              <div className={`mt-1 p-1 rounded-lg border space-y-0.5 shadow-xl animate-in fade-in duration-100 ${submenuBgClass}`}>
                {statusOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleSetStatus(opt.key)}
                    className={`w-full flex items-start gap-2.5 p-2 rounded-md text-left transition-colors cursor-pointer group ${itemClass}`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${opt.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">
                          {opt.label}
                        </span>
                        {currentUser.status === opt.key && (
                          <Check className="w-3.5 h-3.5 text-[#23a55a]" />
                        )}
                      </div>
                      <p className={`text-[10px] leading-tight mt-0.5 ${isPopoutLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>
                        {opt.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Insígnias Button (matches Discord reference!) */}
          <button
            onClick={() => {
              openUserProfileModal(currentUser);
              onClose();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${itemClass}`}
          >
            <div className="flex items-center gap-2.5">
              <Award className={`w-4 h-4 ${itemIconClass}`} />
              <span>Insígnias</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DiscordBadgesGroup user={currentUser} size={14} />
              <ChevronRight className={`w-4 h-4 ${itemIconClass}`} />
            </div>
          </button>
        </div>

        {/* 6. Grouped Menu: Card 2 (Account Management) */}
        <div className={`mt-2 rounded-xl p-1 border shadow-sm ${cardBgClass}`}>
          {/* Button: Mudar de conta */}
          <div className="relative">
            <button
              onClick={() => setIsSwitchAccountOpen((prev) => !prev)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${itemClass}`}
            >
              <div className="flex items-center gap-2.5">
                <Users className={`w-4 h-4 ${itemIconClass}`} />
                <span>Mudar de conta</span>
              </div>
              <ChevronRight
                className={`w-4 h-4 ${itemIconClass} transition-transform ${
                  isSwitchAccountOpen ? 'rotate-90' : ''
                }`}
              />
            </button>

            {/* Switch Account Info */}
            {isSwitchAccountOpen && (
              <div className={`p-2.5 rounded-lg border text-xs space-y-2 animate-in fade-in duration-100 ${submenuBgClass}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider px-1 ${isPopoutLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>
                  Contas no Dispositivo ({Math.max(1, savedAccounts.length)})
                </div>

                {/* Contas Salvas */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {/* Conta Ativa */}
                  <div className={`flex items-center gap-2 p-1.5 rounded-md border ${
                    isPopoutLight ? 'bg-black/5 border-black/10' : 'bg-[#232428] border-[#35373c]/50'
                  }`}>
                    <img
                      src={getAvatarUrl(currentUser.avatar)}
                      alt={currentUser.name}
                      onError={handleAvatarError}
                      className="w-7 h-7 rounded-full object-cover border border-[#23a55a]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold truncate text-xs ${isPopoutLight ? 'text-[#111214]' : 'text-white'}`}>
                        {currentUser.displayName || currentUser.name}
                      </div>
                      <div className="text-[10px] text-[#23a55a] font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#23a55a]" />
                        Ativa agora
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-[#23a55a] flex-shrink-0" />
                  </div>

                  {/* Outras Contas Salvas */}
                  {savedAccounts
                    .filter((acc) => acc.id !== currentUser.id)
                    .map((acc) => (
                      <div
                        key={acc.id}
                        className={`flex items-center gap-2 p-1.5 rounded-md transition-colors group ${
                          isPopoutLight ? 'hover:bg-black/5' : 'hover:bg-[#2b2d31]'
                        }`}
                      >
                        <img
                          src={getAvatarUrl(acc.avatar)}
                          alt={acc.name}
                          onError={handleAvatarError}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className={`font-medium truncate text-xs ${isPopoutLight ? 'text-[#2e3338]' : 'text-[#dbdee1]'}`}>
                            {acc.displayName || acc.name}
                          </div>
                          <div className={`text-[10px] truncate ${isPopoutLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>
                            @{acc.name}
                          </div>
                        </div>

                        <button
                          onClick={async () => {
                            const res = await switchAccount(acc.id);
                            if (res.requiresLogin) {
                              onClose();
                              await logout({ skipSupabaseSignOut: true });
                            } else if (res.success) {
                              onClose();
                            }
                          }}
                          className="px-2 py-1 text-[11px] font-semibold bg-[#5865f2] hover:bg-[#4752c4] text-white rounded transition-colors cursor-pointer"
                          title="Alternar para esta conta"
                        >
                          Alternar
                        </button>

                        <button
                          onClick={() => removeSavedAccount(acc.id)}
                          className="p-1 text-[#949ba4] hover:text-[#f23f43] rounded hover:bg-[#f23f43]/10 transition-colors cursor-pointer"
                          title="Remover do dispositivo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>

                {/* + Adicionar outra conta */}
                <button
                  onClick={async () => {
                    onClose();
                    await logout({ skipSupabaseSignOut: true });
                  }}
                  className={`w-full py-1.5 px-2 rounded-md text-center text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                    isPopoutLight
                      ? 'bg-black/5 hover:bg-black/10 text-[#111214] border-black/10'
                      : 'bg-[#2b2d31] hover:bg-[#35373c] text-white border-[#3f4147]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-[#5865f2]" />
                  <span>Adicionar outra conta</span>
                </button>
              </div>
            )}
          </div>

          {/* Button: Copiar ID do usuário */}
          <button
            onClick={handleCopyId}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${itemClass}`}
          >
            <div className="flex items-center gap-2.5">
              {copiedId ? (
                <Check className="w-4 h-4 text-[#23a55a]" />
              ) : (
                <Copy className={`w-4 h-4 ${itemIconClass}`} />
              )}
              <span className={copiedId ? 'text-[#23a55a] font-semibold' : ''}>
                {copiedId ? 'ID copiado!' : 'Copiar ID do usuário'}
              </span>
            </div>
          </button>

          <div className={`h-[1px] my-1 mx-2 ${separatorClass}`} />

          {/* Button: Sair da conta (Logout) */}
          <button
            onClick={async () => {
              if (isLoggingOut) return;
              onClose();
              try {
                await logout();
              } catch (err) {
                console.error('[DiscordCurrentUserPopout] Logout error:', err);
              }
            }}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-semibold text-[#f23f43] hover:bg-[#f23f43]/15 transition-colors cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2.5">
              <LogOut className="w-4 h-4 text-[#f23f43] transition-transform group-hover:scale-110" />
              <span>{isLoggingOut ? 'Saindo...' : 'Sair da Conta'}</span>
            </div>
            <span className="text-[11px] text-[#f23f43]/70 font-medium">Log out</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
