import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { User, Role } from '../../types/discord';
import { useDiscord } from '../../store/discordStore';
import { getAvatarUrl } from '../../utils/avatar';
import {
  User as UserIcon,
  MessageSquare,
  AtSign,
  Phone,
  Video,
  UserPlus,
  UserMinus,
  Pencil,
  FileText,
  Share2,
  Volume2,
  VolumeX,
  Headphones,
  VideoOff,
  Copy,
  Check,
  Shield,
  MicOff,
  ArrowRightCircle,
  PhoneOff,
  UserX,
  Ban,
  ChevronRight,
  AlertTriangle,
  X,
} from 'lucide-react';

interface DiscordUserContextMenuProps {
  user: User;
  position: { x: number; y: number };
  context?: 'member' | 'friend' | 'voice' | 'chat';
  onClose: () => void;
  onOpenProfile?: (user: User) => void;
  onMentionUser?: (user: User) => void;
  onOpenInvite?: () => void;
}

export const DiscordUserContextMenu: React.FC<DiscordUserContextMenuProps> = ({
  user,
  position,
  context = 'member',
  onClose,
  onOpenProfile,
  onMentionUser,
  onOpenInvite,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    currentUser,
    activeServerId,
    servers,
    roles,
    userRoleMap,
    setUserRoles,
    getUserRole,
    getUserRoleColor,
    setActiveChannel,
    voiceState,
    connectToVoice,
    canUserModerate,
    kickMember,
    banMember,
    serverMuteUser,
    serverDeafenUser,
    moveUserVoice,
    disconnectUserVoice,
    setUserNickname,
    setUserNote,
    getUserNote,
    friendRequests,
    sendFriendRequest,
    removeFriend,
  } = useDiscord();

  // Coordinates
  const [coords, setCoords] = useState({ x: position.x, y: position.y });
  const [copiedId, setCopiedId] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<'roles' | 'move' | null>(null);

  // Modals inside context menu
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(user.displayName || user.name);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteInput, setNoteInput] = useState(() => getUserNote(user.id));
  const [confirmModal, setConfirmModal] = useState<{
    type: 'kick' | 'ban';
    title: string;
    description: string;
  } | null>(null);

  // Volume & Personal Audio Controls
  const [userVolume, setUserVolume] = useState<number>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(`lyc_voice_vol_${user.id}`);
      if (saved) return parseInt(saved, 10);
    }
    return 100;
  });

  const [isMutedForMe, setIsMutedForMe] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`lyc_voice_mute_${user.id}`) === 'true';
    }
    return false;
  });

  const [isDeafenedForMe, setIsDeafenedForMe] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`lyc_voice_deafen_${user.id}`) === 'true';
    }
    return false;
  });

  const [isVideoHidden, setIsVideoHidden] = useState(false);

  // Hierarchy and Permissions
  const isSelf = user.id === currentUser.id || user.id === 'user-me';
  const perms = canUserModerate(currentUser.id, user.id);
  const currentServer = servers.find((s) => s.id === activeServerId) || servers[0];
  const isServerContext = activeServerId !== '@me';

  // Check if target or current user is in voice call
  const targetVoiceParticipant = voiceState.participants.find((p) => p.user.id === user.id);
  const isInVoiceWithUser = voiceState.isConnected && (!!targetVoiceParticipant || context === 'voice');

  // Check friendship status
  const isFriend = friendRequests.some((r) => r.user.id === user.id && r.type === 'incoming') ||
    user.id !== currentUser.id;

  // Voice channels in current server for "Move to"
  const availableVoiceChannels = currentServer?.categories
    .flatMap((c) => c.channels)
    .filter((ch) => ch.type === 'voice') || [];

  // User's current roles
  const targetRoleIds = userRoleMap[user.id] || (isSelf ? userRoleMap['user-me'] || [] : []);
  const primaryRole = getUserRole(user.id);
  const primaryRoleColor = getUserRoleColor(user.id);

  // Adjust position so it doesn't overflow viewport
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(position.x, window.innerWidth - rect.width - 12));
    const y = Math.max(8, Math.min(position.y, window.innerHeight - rect.height - 12));
    setCoords({ x, y });
  }, [position]);

  // Close on outside click or ESC
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleVolumeChange = (newVol: number) => {
    setUserVolume(newVol);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`lyc_voice_vol_${user.id}`, newVol.toString());
    }
  };

  const toggleMute = () => {
    const next = !isMutedForMe;
    setIsMutedForMe(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`lyc_voice_mute_${user.id}`, next ? 'true' : 'false');
    }
  };

  const toggleDeafen = () => {
    const next = !isDeafenedForMe;
    setIsDeafenedForMe(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`lyc_voice_deafen_${user.id}`, next ? 'true' : 'false');
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id).catch(() => {});
    setCopiedId(true);
    setTimeout(() => {
      setCopiedId(false);
      onClose();
    }, 800);
  };

  const handleStartDm = () => {
    onClose();
    setActiveChannel(`dm-${user.id}`);
  };

  const handleStartCall = (type: 'voice' | 'video') => {
    onClose();
    setActiveChannel(`dm-${user.id}`);
    connectToVoice(`call-${user.id}`, `Chamada com ${user.displayName || user.name}`, '@me', 'Mensagens Diretas');
  };

  const handleSaveNickname = (e: React.FormEvent) => {
    e.preventDefault();
    setUserNickname(user.id, nicknameInput);
    setShowNicknameModal(false);
    onClose();
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    setUserNote(user.id, noteInput);
    setShowNoteModal(false);
    onClose();
  };

  const handleToggleRole = (roleId: string) => {
    const hasRole = targetRoleIds.includes(roleId);
    const updated = hasRole
      ? targetRoleIds.filter((id) => id !== roleId)
      : [...targetRoleIds, roleId];
    setUserRoles(user.id, updated);
  };

  const handleConfirmModeration = async () => {
    if (!confirmModal) return;
    if (confirmModal.type === 'kick') {
      await kickMember(activeServerId, user.id);
    } else if (confirmModal.type === 'ban') {
      await banMember(activeServerId, user.id, 'Banido pela moderação');
    }
    setConfirmModal(null);
    onClose();
  };

  // Reusable Menu Button Item
  const MenuItem = ({
    icon: Icon,
    label,
    onClick,
    danger = false,
    checked = false,
    hasSubmenu = false,
    onMouseEnter,
    onMouseLeave,
    disabled = false,
  }: {
    icon: React.ElementType;
    label: string;
    onClick?: () => void;
    danger?: boolean;
    checked?: boolean;
    hasSubmenu?: boolean;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    disabled?: boolean;
  }) => (
    <button
      disabled={disabled}
      onClick={() => {
        if (!disabled && onClick) onClick();
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer select-none text-left ${
        disabled
          ? 'opacity-40 cursor-not-allowed text-[#80848e]'
          : danger
          ? 'text-[#f23f43] hover:bg-[#f23f43] hover:text-white'
          : 'text-[#dbdee1] hover:bg-[#5865f2] hover:text-white'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      {checked && <Check className="w-3.5 h-3.5 text-[#23a55a] flex-shrink-0" />}
      {hasSubmenu && <ChevronRight className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />}
    </button>
  );

  return (
    <>
      <div
        ref={menuRef}
        style={{ left: `${coords.x}px`, top: `${coords.y}px` }}
        onClick={(e) => e.stopPropagation()}
        className="fixed z-[9999] w-64 bg-[#111214] border border-[#28292d] rounded-md shadow-2xl p-1.5 text-xs text-[#dbdee1] select-none animate-in fade-in zoom-in-95 duration-100 max-h-[92vh] overflow-y-auto"
      >
        {/* Header User Preview */}
        <div className="px-2 py-2 border-b border-[#232428] mb-1 flex items-center gap-2.5 bg-[#16171a] rounded">
          <div className="relative flex-shrink-0">
            <img
              src={getAvatarUrl(user.avatar)}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover border border-[#2b2d31]"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#16171a] ${
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
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white truncate text-xs">
                {user.displayName || user.name}
              </span>
              {primaryRole && primaryRole.id !== 'role-everyone' && (
                <span
                  style={{ color: primaryRoleColor }}
                  className="text-[9px] font-semibold px-1 py-0.2 rounded bg-[#2b2d31] truncate"
                >
                  {primaryRole.name}
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#949ba4] truncate">@{user.name}</span>
          </div>
        </div>

        {/* Section 1: Profile & Social Interactions */}
        <div className="py-0.5 space-y-0.5">
          <MenuItem
            icon={UserIcon}
            label="Ver perfil"
            onClick={() => {
              onClose();
              if (onOpenProfile) onOpenProfile(user);
            }}
          />

          {!isSelf && onMentionUser && (
            <MenuItem
              icon={AtSign}
              label="Mencionar"
              onClick={() => {
                onClose();
                onMentionUser(user);
              }}
            />
          )}

          {!isSelf && (
            <MenuItem
              icon={MessageSquare}
              label="Enviar mensagem"
              onClick={handleStartDm}
            />
          )}

          {!isSelf && (
            <>
              <MenuItem
                icon={Phone}
                label="Iniciar chamada de voz"
                onClick={() => handleStartCall('voice')}
              />
              <MenuItem
                icon={Video}
                label="Iniciar chamada de vídeo"
                onClick={() => handleStartCall('video')}
              />
            </>
          )}

          <MenuItem
            icon={Pencil}
            label={isSelf ? 'Editar apelido no servidor' : 'Alterar apelido'}
            onClick={() => setShowNicknameModal(true)}
          />

          <MenuItem
            icon={FileText}
            label="Adicionar nota privada"
            onClick={() => setShowNoteModal(true)}
          />

          {!isSelf && (
            <MenuItem
              icon={isFriend ? UserMinus : UserPlus}
              label={isFriend ? 'Remover amizade' : 'Adicionar amigo'}
              danger={isFriend}
              onClick={() => {
                if (isFriend) {
                  removeFriend(user.id);
                } else {
                  sendFriendRequest(user.name);
                }
                onClose();
              }}
            />
          )}

          {isServerContext && onOpenInvite && (
            <MenuItem
              icon={Share2}
              label="Convidar para o servidor"
              onClick={() => {
                onClose();
                onOpenInvite();
              }}
            />
          )}
        </div>

        {/* Section 2: Personal Voice & Audio Controls (when applicable) */}
        {(isInVoiceWithUser || context === 'voice') && !isSelf && (
          <>
            <div className="h-[1px] bg-[#232428] my-1" />
            <div className="px-2.5 py-2 bg-[#16171a] rounded my-1 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-[#949ba4] uppercase tracking-wider text-[10px] font-bold">
                  Volume do Usuário
                </span>
                <span className="text-white font-mono">{userVolume}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-[#949ba4]" />
                <input
                  type="range"
                  min={0}
                  max={200}
                  step={5}
                  value={userVolume}
                  onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10))}
                  className="w-full accent-[#5865f2] h-1.5 bg-[#2b2d31] rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <MenuItem
              icon={VolumeX}
              label="Silenciar para mim"
              checked={isMutedForMe}
              onClick={toggleMute}
            />

            <MenuItem
              icon={Headphones}
              label="Ensurdecer localmente"
              checked={isDeafenedForMe}
              onClick={toggleDeafen}
            />

            <MenuItem
              icon={VideoOff}
              label="Desativar vídeo do usuário"
              checked={isVideoHidden}
              onClick={() => setIsVideoHidden(!isVideoHidden)}
            />
          </>
        )}

        {/* Section 3: Copy User ID */}
        <div className="h-[1px] bg-[#232428] my-1" />
        <MenuItem
          icon={Copy}
          label={copiedId ? 'ID copiado!' : 'Copiar ID do usuário'}
          onClick={handleCopyId}
          checked={copiedId}
        />

        {/* Section 4: Moderation Actions (Protected by Role Permissions) */}
        {isServerContext && !isSelf && (perms.canKick || perms.canBan || perms.canManageRoles || perms.isAdmin) && (
          <>
            <div className="h-[1px] bg-[#232428] my-1" />
            <div className="px-2 py-1 text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
              Moderação
            </div>

            {/* Roles Submenu */}
            {perms.canManageRoles && (
              <div
                className="relative"
                onMouseEnter={() => setActiveSubmenu('roles')}
                onMouseLeave={() => setActiveSubmenu(null)}
              >
                <MenuItem
                  icon={Shield}
                  label="Cargos"
                  hasSubmenu
                />
                {activeSubmenu === 'roles' && (
                  <div
                    className="absolute left-full top-0 ml-1 w-52 bg-[#111214] border border-[#28292d] rounded-md shadow-2xl p-1.5 space-y-0.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-2 py-1 text-[10px] font-bold text-[#949ba4] uppercase tracking-wider border-b border-[#232428] mb-1">
                      Atribuir Cargo
                    </div>
                    {roles
                      .filter((r) => r.id !== 'role-everyone')
                      .map((role) => {
                        const hasRole = targetRoleIds.includes(role.id);
                        return (
                          <button
                            key={role.id}
                            onClick={() => handleToggleRole(role.id)}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: role.color }}
                              />
                              <span className="truncate">{role.name}</span>
                            </div>
                            {hasRole && <Check className="w-3.5 h-3.5 text-[#23a55a] flex-shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Server Voice Moderation */}
            {isInVoiceWithUser && (
              <>
                <MenuItem
                  icon={MicOff}
                  label="Silenciar voz no servidor"
                  checked={targetVoiceParticipant?.isMuted}
                  onClick={() => serverMuteUser(user.id, !targetVoiceParticipant?.isMuted)}
                />

                <MenuItem
                  icon={Headphones}
                  label="Desativar áudio no servidor"
                  checked={targetVoiceParticipant?.isDeafened}
                  onClick={() => serverDeafenUser(user.id, !targetVoiceParticipant?.isDeafened)}
                />

                {availableVoiceChannels.length > 1 && (
                  <div
                    className="relative"
                    onMouseEnter={() => setActiveSubmenu('move')}
                    onMouseLeave={() => setActiveSubmenu(null)}
                  >
                    <MenuItem
                      icon={ArrowRightCircle}
                      label="Mover para outro canal de voz"
                      hasSubmenu
                    />
                    {activeSubmenu === 'move' && (
                      <div
                        className="absolute left-full top-0 ml-1 w-52 bg-[#111214] border border-[#28292d] rounded-md shadow-2xl p-1.5 space-y-0.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-2 py-1 text-[10px] font-bold text-[#949ba4] uppercase tracking-wider border-b border-[#232428] mb-1">
                          Canais de Voz
                        </div>
                        {availableVoiceChannels.map((vc) => (
                          <button
                            key={vc.id}
                            onClick={() => {
                              moveUserVoice(user.id, vc.id);
                              onClose();
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left truncate"
                          >
                            <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{vc.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <MenuItem
                  icon={PhoneOff}
                  label="Desconectar do canal de voz"
                  danger
                  onClick={() => {
                    disconnectUserVoice(user.id);
                    onClose();
                  }}
                />
              </>
            )}

            {/* Kick & Ban with Confirmation */}
            {perms.canKick && (
              <MenuItem
                icon={UserX}
                label={`Expulsar ${user.displayName || user.name}`}
                danger
                onClick={() =>
                  setConfirmModal({
                    type: 'kick',
                    title: `Expulsar @${user.displayName || user.name}`,
                    description: `Tem certeza que deseja expulsar ${user.displayName || user.name} do servidor? O membro poderá retornar através de um link de convite válido.`,
                  })
                }
              />
            )}

            {perms.canBan && (
              <MenuItem
                icon={Ban}
                label={`Banir ${user.displayName || user.name}`}
                danger
                onClick={() =>
                  setConfirmModal({
                    type: 'ban',
                    title: `Banir permanentemente @${user.displayName || user.name}`,
                    description: `Tem certeza que deseja banir ${user.displayName || user.name} do servidor? Esta ação removerá o acesso do membro e de suas mensagens caso selecionado.`,
                  })
                }
              />
            )}
          </>
        )}
      </div>

      {/* Inline Modal: Alterar Apelido */}
      {showNicknameModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className="bg-[#313338] rounded-[4px] shadow-2xl w-full max-w-md mx-4 p-6 select-none animate-in fade-in zoom-in-95 duration-150 border border-[#232428]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-lg font-bold">Alterar apelido</h3>
              <button
                onClick={() => setShowNicknameModal(false)}
                className="text-[#949ba4] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveNickname} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#b5bac1] uppercase tracking-wide block mb-2">
                  Apelido para @{user.name}
                </label>
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder={user.name}
                  autoFocus
                  maxLength={32}
                  className="w-full bg-[#1e1f22] text-white px-3 py-2.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#5865f2] border border-[#232428]"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNicknameModal(false)}
                  className="px-4 py-2 text-sm text-white hover:underline cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-medium rounded transition-colors cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Modal: Adicionar Nota Privada */}
      {showNoteModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className="bg-[#313338] rounded-[4px] shadow-2xl w-full max-w-md mx-4 p-6 select-none animate-in fade-in zoom-in-95 duration-150 border border-[#232428]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-lg font-bold">Nota privada</h3>
              <button
                onClick={() => setShowNoteModal(false)}
                className="text-[#949ba4] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveNote} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#b5bac1] uppercase tracking-wide block mb-2">
                  Anotação pessoal (somente visível para você)
                </label>
                <textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Ex: Conheci no campeonato LYC / Especialista em WebRTC..."
                  rows={3}
                  autoFocus
                  maxLength={256}
                  className="w-full bg-[#1e1f22] text-white px-3 py-2.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#5865f2] border border-[#232428] resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 text-sm text-white hover:underline cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-medium rounded transition-colors cursor-pointer"
                >
                  Salvar Nota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Kick & Ban */}
      {confirmModal && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div
            className="relative bg-[#313338] rounded-[4px] shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-[#232428]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-white text-xl font-bold mb-2">{confirmModal.title}</h2>
              <p className="text-[#dbdee1] text-sm leading-relaxed">{confirmModal.description}</p>
            </div>
            <div className="px-6 pb-4">
              <div className="flex items-start gap-3 bg-[#f23f43]/10 border border-[#f23f43]/30 rounded p-3">
                <AlertTriangle className="w-5 h-5 text-[#f23f43] flex-shrink-0 mt-0.5" />
                <p className="text-[#f23f43] text-sm font-medium">
                  {confirmModal.type === 'ban'
                    ? 'O membro será removido permanentemente e impedido de reentrar.'
                    : 'O membro será desconectado e removido do servidor.'}
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-[#2b2d31] flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm font-medium text-white hover:underline cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmModeration}
                className="px-4 py-2 bg-[#f23f43] hover:bg-[#d83a3e] text-white text-sm font-semibold rounded-[3px] transition-colors cursor-pointer"
              >
                {confirmModal.type === 'ban' ? 'Banir Membro' : 'Expulsar Membro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
