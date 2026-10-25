import React, { useState, useEffect, useRef } from 'react';
import { useDiscord } from '../../store/discordStore';
import { useVoiceStreamStore } from '../../store/voiceStreamStore';
import { UserStatus } from '../../types/discord';
import { getAvatarUrl } from '../../utils/avatar';
import { getUserUnlockedBadgeIds, getDisplayedBadgeIds } from '../../types/badges';
import { CapyBadgeIcon } from './CapyBadgeIcon';
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
  Sparkles,
  Award,
  Users,
  ChevronRight,
  Circle,
  ExternalLink,
  Radio,
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
    openSettingsModal,
    setActiveSettingsTab,
    setActiveView,
    isLoggingOut,
    logout,
    savedAccounts,
    switchAccount,
    removeSavedAccount,
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

  if (!isOpen) return null;

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
    setActiveSettingsTab('profiles');
    openSettingsModal();
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

  return (
    <div
      ref={popoutRef}
      style={{ left: `${position.left}px`, bottom: `${position.bottom}px` }}
      className="fixed z-[9999] w-[340px] max-h-[calc(100vh-80px)] overflow-y-auto bg-[#111214] border border-[#222327] rounded-2xl shadow-2xl text-left select-none animate-in fade-in zoom-in-95 duration-150 scrollbar-thin scrollbar-thumb-[#232428] scrollbar-track-transparent"
    >
      {/* 1. Header Banner */}
      <div
        className="h-24 w-full relative overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: currentUser.bannerColor || '#5865f2' }}
      >
        {currentUser.bannerImage && (
          <img
            src={currentUser.bannerImage}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        )}

        {/* Quick Edit Profile Button over Banner */}
        <button
          onClick={handleEditProfile}
          className="absolute top-2.5 right-2.5 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-all cursor-pointer backdrop-blur-xs flex items-center justify-center group shadow-md"
          title="Editar Perfil"
        >
          <Pencil className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* 2. Avatar & Badges Section */}
      <div className="px-4 pb-4 relative">
        <div className="relative -top-11 mb-[-36px] flex justify-between items-end">
          {/* Avatar with Status Overlap */}
          <div className="relative group">
            <img
              src={getAvatarUrl(currentUser.avatar)}
              alt={currentUser.name}
              className="w-20 h-20 rounded-full border-[6px] border-[#111214] object-cover bg-[#1e1f22] shadow-xl"
            />
            {/* Status dot / Mascot sleep */}
            {currentUser.status === 'idle' ? (
              <img
                src="/brand/04_Recortes_PNG_Alta_Resolucao/Mascotes_Expressoes/06_Dormindo.png"
                alt="Ausente"
                title="Ausente (Dormindo)"
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full border-[2.5px] border-[#111214] bg-[#1F1F26] object-cover shadow"
              />
            ) : currentUser.status === 'dnd' ? (
              <div
                title="Não perturbar"
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full border-[2.5px] border-[#111214] bg-[#f23f43] flex items-center justify-center shadow"
              >
                <div className="w-2.5 h-0.5 bg-[#111214] rounded-full" />
              </div>
            ) : currentUser.status === 'offline' ? (
              <div
                title="Invisível"
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full border-[2.5px] border-[#111214] bg-[#80848e] flex items-center justify-center shadow"
              >
                <div className="w-2 h-2 rounded-full bg-[#111214]" />
              </div>
            ) : (
              <span
                title="Disponível"
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full border-[2.5px] border-[#111214] bg-[#23a55a] shadow"
              />
            )}
          </div>

          {/* Badges Container */}
          {(() => {
            const displayedBadgeIds = getDisplayedBadgeIds(
              getUserUnlockedBadgeIds(currentUser),
              currentUser.displayedBadges
            );
            if (displayedBadgeIds.length === 0) return null;
            return (
              <div className="flex items-center gap-1.5 p-1 bg-[#18191c] rounded-lg border border-[#2b2d31] mb-2 shadow-sm">
                {displayedBadgeIds.map((id) => (
                  <CapyBadgeIcon key={id} badgeId={id} size={18} showTooltip />
                ))}
              </div>
            );
          })()}
        </div>

        {/* 3. User Info Card */}
        <div className="mt-4 bg-[#18191c] rounded-xl p-3 border border-[#202225] space-y-3 shadow-inner">
          {/* Display Name & Tag */}
          <div>
            <h3 className="font-bold text-lg text-white leading-tight">
              {currentUser.displayName || currentUser.name}
            </h3>
            <span className="text-xs text-[#949ba4] font-medium">
              @{currentUser.name}
            </span>
          </div>

          {/* Custom Status */}
          {currentUser.customStatus && (
            <div className="text-xs text-[#dbdee1] flex items-center gap-1.5 bg-[#111214] px-2.5 py-1.5 rounded-lg border border-[#232428]">
              <Radio className="w-3 h-3 text-[#23a55a] flex-shrink-0" />
              <span className="truncate">{currentUser.customStatus}</span>
            </div>
          )}

          <div className="h-[1px] bg-[#232428]" />

          {/* About Me / Biografia */}
          <div>
            <h4 className="text-[11px] font-bold uppercase text-[#949ba4] tracking-wider mb-1">
              Sobre Mim
            </h4>
            <p className="text-xs text-[#dbdee1] leading-relaxed whitespace-pre-wrap">
              {currentUser.aboutMe || 'Nenhuma biografia configurada.'}
            </p>
          </div>

          {/* 4. Voice Connection Section (Conditional) */}
          {voiceState.isConnected && (
            <div className="mt-2 p-2.5 bg-[#111214] rounded-lg border border-[#232428] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[#23a55a] text-xs font-bold">
                  <Signal className="w-3.5 h-3.5 animate-pulse" />
                  <span>EM VOZ</span>
                </div>
                <span className="text-[10px] text-[#949ba4]">
                  {voiceState.pingMs || 24}ms
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#949ba4] flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate">
                    {voiceState.channelName}
                  </div>
                  <div className="text-[10px] text-[#949ba4] truncate">
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
              <div className="flex items-center justify-center gap-1.5 pt-1 border-t border-[#232428]">
                <button
                  onClick={toggleMute}
                  title={isMicMuted ? 'Desmutar' : 'Mutar'}
                  className={`p-1.5 rounded hover:bg-[#35373c] text-xs transition-colors ${
                    isMicMuted ? 'text-[#f23f43]' : 'text-[#b5bac1]'
                  }`}
                >
                  {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleDeafen}
                  title={isDeafened ? 'Reativar Áudio' : 'Ensurdecer'}
                  className={`p-1.5 rounded hover:bg-[#35373c] text-xs transition-colors ${
                    isDeafened ? 'text-[#f23f43]' : 'text-[#b5bac1]'
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
        </div>

        {/* 5. Action Buttons & Quick Menus */}
        <div className="mt-3 space-y-1">
          {/* Button: Editar Perfil */}
          <button
            onClick={handleEditProfile}
            className="w-full py-2 px-3 bg-[#4e5058]/30 hover:bg-[#4e5058]/50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#35373c]"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar perfil
          </button>

          {/* Status Selector Dropdown / Submenu */}
          <div className="relative pt-1">
            <button
              onClick={() => setIsStatusSubmenuOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-[#dbdee1] hover:bg-[#35373c]/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${currentStatusConfig.color}`} />
                <span>{currentStatusConfig.label}</span>
              </div>
              <ChevronRight
                className={`w-4 h-4 text-[#949ba4] transition-transform ${
                  isStatusSubmenuOpen ? 'rotate-90' : ''
                }`}
              />
            </button>

            {/* Status Options */}
            {isStatusSubmenuOpen && (
              <div className="mt-1 p-1 bg-[#18191c] border border-[#2b2d31] rounded-lg space-y-0.5 shadow-xl animate-in fade-in duration-100">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleSetStatus(opt.key)}
                    className="w-full flex items-start gap-2.5 p-2 rounded-md hover:bg-[#35373c]/60 text-left transition-colors cursor-pointer group"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${opt.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white group-hover:text-white">
                          {opt.label}
                        </span>
                        {currentUser.status === opt.key && (
                          <Check className="w-3.5 h-3.5 text-[#23a55a]" />
                        )}
                      </div>
                      <p className="text-[10px] text-[#949ba4] leading-tight mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-[1px] bg-[#232428] my-1" />

          {/* Button: Mudar de conta */}
          <button
            onClick={() => setIsSwitchAccountOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-[#dbdee1] hover:bg-[#35373c]/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#949ba4]" />
              <span>Mudar de conta</span>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-[#949ba4] transition-transform ${
                isSwitchAccountOpen ? 'rotate-90' : ''
              }`}
            />
          </button>

          {/* Switch Account Info */}
          {isSwitchAccountOpen && (
            <div className="p-2.5 bg-[#18191c] border border-[#2b2d31] rounded-lg text-xs space-y-2 animate-in fade-in duration-100">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#949ba4] px-1">
                Contas no Dispositivo ({Math.max(1, savedAccounts.length)})
              </div>

              {/* Contas Salvas */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {/* 1. Conta Ativa */}
                <div className="flex items-center gap-2 p-1.5 rounded-md bg-[#232428] border border-[#35373c]/50">
                  <img
                    src={getAvatarUrl(currentUser.avatar)}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-full object-cover border border-[#23a55a]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white truncate text-xs">
                      {currentUser.displayName || currentUser.name}
                    </div>
                    <div className="text-[10px] text-[#23a55a] font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#23a55a]" />
                      Ativa agora
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-[#23a55a] flex-shrink-0" />
                </div>

                {/* 2. Outras Contas Salvas */}
                {savedAccounts
                  .filter((acc) => acc.id !== currentUser.id)
                  .map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center gap-2 p-1.5 rounded-md hover:bg-[#2b2d31] transition-colors group"
                    >
                      <img
                        src={getAvatarUrl(acc.avatar)}
                        alt={acc.name}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[#dbdee1] truncate text-xs group-hover:text-white">
                          {acc.displayName || acc.name}
                        </div>
                        <div className="text-[10px] text-[#949ba4] truncate">
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
                className="w-full py-1.5 px-2 bg-[#2b2d31] hover:bg-[#35373c] text-white rounded-md text-center text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[#3f4147]"
              >
                <Plus className="w-3.5 h-3.5 text-[#5865f2]" />
                <span>Adicionar outra conta</span>
              </button>
            </div>
          )}

          {/* Button: Copiar ID do usuário */}
          <button
            onClick={handleCopyId}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-[#dbdee1] hover:bg-[#35373c]/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {copiedId ? (
                <Check className="w-4 h-4 text-[#23a55a]" />
              ) : (
                <Copy className="w-4 h-4 text-[#949ba4]" />
              )}
              <span className={copiedId ? 'text-[#23a55a] font-semibold' : ''}>
                {copiedId ? 'ID copiado!' : 'Copiar ID do usuário'}
              </span>
            </div>
            <span className="text-[10px] text-[#80848e] font-mono">
              {currentUser.id}
            </span>
          </button>

          <div className="h-[1px] bg-[#232428] my-1" />

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
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold text-[#f23f43] hover:bg-[#f23f43]/15 transition-colors cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2">
              <LogOut className="w-4 h-4 text-[#f23f43] transition-transform group-hover:scale-110" />
              <span>{isLoggingOut ? 'Saindo...' : 'Sair da Conta'}</span>
            </div>
            <span className="text-[10px] text-[#f23f43]/70 font-medium">Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
