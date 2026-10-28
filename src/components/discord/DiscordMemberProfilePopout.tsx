import React from 'react';
import { useDiscord } from '../../store/discordStore';
import { resolveServerTagBadge, resolveServerTagColor, resolveServerTagBadgeIcon } from '../../types/discord';
import { getAvatarUrl, handleAvatarError } from '../../utils/avatar';
import { getAssetUrl } from '../../utils/assets';
import { getUserUnlockedBadgeIds, getDisplayedBadgeIds } from '../../types/badges';
import { CapyBadgeIcon } from './CapyBadgeIcon';
import { DiscordBadgesGroup } from './DiscordBadgesGroup';
import { getStyledNameCSS, getFontClassName } from '../../utils/nameStyle';
import {
  Gamepad2,
  Tv,
  Headphones,
  Calendar,
  Sparkles,
  Shield,
  Award,
  Plus,
  X,
  Check,
} from 'lucide-react';

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

export const DiscordMemberProfilePopout: React.FC = () => {
  const {
    selectedMemberForPopout,
    popoutPosition,
    closeMemberPopout,
    openUserProfileModal,
    setActiveChannel,
    activeServerId,
    servers,
    currentUser,
    userRoleMap,
    getServerRoles,
    serverRolesMap,
    roles,
    canUserModerate,
    setUserRoles,
    fetchCommunityMembers,
  } = useDiscord();

  const [isAddRoleOpen, setIsAddRoleOpen] = React.useState(false);
  const [roleSearch, setRoleSearch] = React.useState('');
  const [roleError, setRoleError] = React.useState<string | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const addRoleBtnRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddRoleOpen) {
          setIsAddRoleOpen(false);
          e.stopPropagation();
        } else {
          closeMemberPopout();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeMemberPopout, isAddRoleOpen]);

  React.useEffect(() => {
    if (!isAddRoleOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        addRoleBtnRef.current &&
        !addRoleBtnRef.current.contains(e.target as Node)
      ) {
        setIsAddRoleOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddRoleOpen]);

  const user = selectedMemberForPopout;
  const currentServer = servers.find((s) => s.id === activeServerId) || servers[0];
  const isDm = activeServerId === '@me';

  React.useEffect(() => {
    if (!isDm && currentServer?.communityId) {
      void fetchCommunityMembers(currentServer.communityId);
    }
  }, [isDm, currentServer?.communityId, fetchCommunityMembers]);

  const tagColor = !isDm && currentServer?.serverTag ? resolveServerTagColor(currentServer.serverTagColor) : null;
  const tagBadgeIcon = !isDm && currentServer?.serverTag ? resolveServerTagBadgeIcon(currentServer.serverTagBadge, currentServer.serverTagBadgeImage) : null;
  const tagBadgeChar = !isDm && currentServer?.serverTag ? resolveServerTagBadge(currentServer.serverTagBadge) : '💎';

  const topPos = Math.max(12, Math.min(popoutPosition?.top || 100, window.innerHeight - 480));
  const rightPos = Math.max(12, Math.min(popoutPosition?.right || 260, window.innerWidth - 340));

  const availableRoles = React.useMemo(() => {
    if (isDm || !currentServer) return [];
    const serverRoles =
      getServerRoles(currentServer.id).length > 0
        ? getServerRoles(currentServer.id)
        : (serverRolesMap[currentServer.id] || serverRolesMap[currentServer.communityId || ''] || roles);
    return serverRoles.filter(
      (r) => r.id !== 'role-everyone' && r.name !== '@everyone' && r.name !== '@todos'
    );
  }, [isDm, currentServer, getServerRoles, serverRolesMap, roles]);

  const targetRoleIds = user
    ? (userRoleMap[user.id] || (user.id === currentUser?.id ? (userRoleMap['user-me'] || userRoleMap[currentUser?.id] || []) : []))
    : [];

  const assignedRoles = React.useMemo(() => {
    return availableRoles.filter((r) => {
      if (targetRoleIds.includes(r.id)) return true;
      if (r.base_role === 'ADMIN' && targetRoleIds.includes('role-admin')) return true;
      if (r.base_role === 'MODERATOR' && targetRoleIds.includes('role-mod')) return true;
      return false;
    });
  }, [availableRoles, targetRoleIds]);

  const filteredAvailableRoles = React.useMemo(() => {
    const query = roleSearch.toLowerCase().trim();
    if (!query) return availableRoles;
    return availableRoles.filter((r) => r.name.toLowerCase().includes(query));
  }, [availableRoles, roleSearch]);

  const perms = user
    ? canUserModerate(currentUser.id, user.id, currentServer?.id)
    : { canKick: false, canBan: false, canManageRoles: false, isAdmin: false };
  const canManageRoles = !isDm && (perms.canManageRoles || perms.isAdmin);

  const handleToggleRole = async (roleId: string) => {
    if (isUpdatingRole || !user) return;
    setRoleError(null);
    const hasRole = assignedRoles.some((r) => r.id === roleId);
    const updated = hasRole
      ? targetRoleIds.filter((id) => id !== roleId && id !== `role-${roleId}`)
      : [...targetRoleIds, roleId];

    setIsUpdatingRole(true);
    const res = await setUserRoles(user.id, updated, currentServer?.id);
    setIsUpdatingRole(false);

    if (res && !res.success && res.error) {
      setRoleError(res.error);
      setTimeout(() => setRoleError(null), 3500);
    }
  };

  const handleRemoveRole = async (roleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpdatingRole || !canManageRoles || !user) return;
    setRoleError(null);
    const updated = targetRoleIds.filter((id) => id !== roleId && id !== `role-${roleId}`);

    setIsUpdatingRole(true);
    const res = await setUserRoles(user.id, updated, currentServer?.id);
    setIsUpdatingRole(false);

    if (res && !res.success && res.error) {
      setRoleError(res.error);
      setTimeout(() => setRoleError(null), 3500);
    }
  };

  if (!selectedMemberForPopout || !user) return null;

  const isSelf = user.id === currentUser?.id || user.id === 'user-me' || user.name === currentUser?.name;
  const effectiveUser = isSelf ? { ...user, ...currentUser } : user;
  const primaryTheme = effectiveUser.themePrimaryColor || (isSelf ? currentUser?.themePrimaryColor : undefined);
  const secondaryTheme = effectiveUser.themeSecondaryColor || (isSelf ? currentUser?.themeSecondaryColor : undefined);
  const themeGradient = (primaryTheme && secondaryTheme)
    ? `linear-gradient(180deg, ${primaryTheme} 0%, ${secondaryTheme} 100%)`
    : undefined;
  const isPopoutLight = primaryTheme && secondaryTheme
    ? (getLuminance(primaryTheme) + getLuminance(secondaryTheme)) / 2 > 0.42
    : false;

  return (
    <>
      {/* Invisible Backdrop to close on click outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={closeMemberPopout}
      />

      {/* Popout Card Container */}
      <div
        style={{ top: `${topPos}px`, right: `${rightPos}px` }}
        className="fixed w-80 max-w-[calc(100vw-24px)] max-h-[calc(100vh-32px)] bg-[#111214] rounded-2xl shadow-2xl overflow-y-auto border border-[#232428] z-50 animate-in fade-in zoom-in-95 duration-150 select-none text-left scrollbar-thin min-w-0"
      >
        {/* Banner Top */}
        <div
          className="h-20 w-full relative flex-shrink-0"
          style={{ backgroundColor: effectiveUser.bannerColor || '#5865f2' }}
        >
          {effectiveUser.bannerImage && (
            <img
              src={effectiveUser.bannerImage}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Profile Info Body */}
        <div
          className="px-4 pb-4 relative min-w-0"
          style={{
            background: themeGradient || '#232428',
          }}
        >
          {/* Avatar with status overlap */}
          <div className="relative -top-10 mb-[-32px] flex justify-between items-end min-w-0">
            <div
              onClick={() => {
                openUserProfileModal(effectiveUser);
                closeMemberPopout();
              }}
              className="relative flex-shrink-0 cursor-pointer group"
              title="Ver perfil completo"
            >
              <img
                src={getAvatarUrl(effectiveUser.avatar)}
                alt={effectiveUser.name}
                onError={handleAvatarError}
                className={`w-20 h-20 rounded-full border-[6px] object-cover group-hover:brightness-110 transition-all shadow-md ${
                  isPopoutLight ? 'border-white bg-[#f2f3f5]' : 'border-[#111214] bg-[#111214]'
                }`}
              />
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                <span className="text-[10px] font-bold text-white uppercase tracking-wider bg-black/60 px-2 py-0.5 rounded-full">
                  Ver Perfil
                </span>
              </div>
              {effectiveUser.status === 'idle' ? (
                <img
                  src={getAssetUrl('brand/04_Recortes_PNG_Alta_Resolucao/Mascotes_Expressoes/06_Dormindo.png')}
                  alt="Ausente"
                  title="Ausente (Dormindo)"
                  className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-[2px] bg-[#1F1F26] object-cover shadow ${
                    isPopoutLight ? 'border-white' : 'border-[#111214]'
                  }`}
                />
              ) : (
                <span
                  className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-[3px] ${
                    isPopoutLight ? 'border-white' : 'border-[#111214]'
                  } ${
                    effectiveUser.status === 'online'
                      ? 'bg-[#23a55a]'
                      : effectiveUser.status === 'dnd'
                      ? 'bg-[#f23f43]'
                      : 'bg-[#80848e]'
                  }`}
                />
              )}
            </div>

            {/* Server Tag / Bot Badge next to Avatar (Discord style) */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap justify-end">
              {!isDm && currentServer?.serverTag && tagColor && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-black px-2 py-0.5 rounded shadow-sm select-none leading-none max-w-[140px] truncate flex-shrink-0"
                  title={`Tag do servidor: ${currentServer.serverTag}`}
                  style={{
                    backgroundColor: `${tagColor.hex}25`,
                    color: tagColor.hex,
                    border: `1px solid ${tagColor.hex}50`,
                  }}
                >
                  {tagBadgeIcon && (
                    <img
                      src={tagBadgeIcon}
                      alt="Tag"
                      className="w-4 h-4 object-contain rounded-sm flex-shrink-0"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  )}
                  <span className="leading-none truncate">{currentServer.serverTag}</span>
                </span>
              )}

              {effectiveUser.isBot && (
                <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">
                  BOT
                </span>
              )}
            </div>
          </div>

          {/* Name & Badges */}
          <div className="mt-3 min-w-0">
            {(() => {
              const fontClass = getFontClassName(effectiveUser.nameFont);
              const styledCSS = getStyledNameCSS(
                effectiveUser.nameFont,
                effectiveUser.nameEffect,
                effectiveUser.nameColor || (isPopoutLight ? '#060607' : '#ffffff')
              );
              return (
                <h3
                  className={`font-bold text-lg leading-tight break-words min-w-0 [overflow-wrap:anywhere] ${fontClass} ${
                    isPopoutLight ? 'text-[#060607]' : 'text-white'
                  }`}
                  style={styledCSS}
                >
                  {effectiveUser.displayName || effectiveUser.name}
                </h3>
              );
            })()}

            {/* Username and Discord Badges Container */}
            <div className="flex items-center gap-2 mt-1 flex-wrap min-w-0">
              <span className={`text-xs font-medium break-all truncate ${
                isPopoutLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'
              }`}>
                @{effectiveUser.name}
              </span>
              <DiscordBadgesGroup user={effectiveUser} size={16} />
            </div>
          </div>

          {/* Custom Status */}
          {user.customStatus && (
            <div className={`mt-2 text-xs border-b pb-2 break-words [overflow-wrap:anywhere] whitespace-pre-wrap max-h-24 overflow-y-auto ${
              isPopoutLight ? 'text-[#2e3338] border-black/10' : 'text-[#dbdee1] border-[#35363c]'
            }`}>
              {user.customStatus}
            </div>
          )}

          {/* About Me Section */}
          {user.aboutMe && (
            <div className="mt-3 min-w-0">
              <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${
                isPopoutLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'
              }`}>
                Sobre Mim
              </h4>
              <p className={`text-xs leading-relaxed break-words [overflow-wrap:anywhere] whitespace-pre-wrap max-h-36 overflow-y-auto ${
                isPopoutLight ? 'text-[#2e3338]' : 'text-[#dbdee1]'
              }`}>
                {user.aboutMe}
              </p>
            </div>
          )}

          {/* Activity Section */}
          {user.activity && (
            <div className={`mt-3 p-2.5 rounded-lg border min-w-0 ${
              isPopoutLight ? 'bg-white/80 border-black/10' : 'bg-[#111214] border-[#35363c]/40'
            }`}>
              <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1 ${
                isPopoutLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'
              }`}>
                {user.activity.type === 'PLAYING' && <Gamepad2 className="w-3.5 h-3.5" />}
                {user.activity.type === 'STREAMING' && (
                  <Tv className="w-3.5 h-3.5 text-[#5865f2]" />
                )}
                {user.activity.type === 'LISTENING' && (
                  <Headphones className="w-3.5 h-3.5 text-[#23a55a]" />
                )}
                <span>
                  {user.activity.type === 'PLAYING'
                    ? 'Jogando um jogo'
                    : user.activity.type === 'STREAMING'
                    ? 'Transmitindo'
                    : 'Ouvindo'}
                </span>
              </h4>

              <div className="flex flex-col text-xs min-w-0">
                <span className={`font-semibold break-words [overflow-wrap:anywhere] ${
                  isPopoutLight ? 'text-[#060607]' : 'text-white'
                }`}>
                  {user.activity.name}
                </span>
                {user.activity.details && (
                  <span className={`text-[11px] break-words [overflow-wrap:anywhere] ${
                    isPopoutLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'
                  }`}>
                    {user.activity.details}
                  </span>
                )}
                {user.activity.state && (
                  <span className={`text-[11px] break-words [overflow-wrap:anywhere] ${
                    isPopoutLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'
                  }`}>
                    {user.activity.state}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Member Since Date */}
          <div className={`mt-3 pt-2 border-t flex items-center gap-1.5 text-xs ${
            isPopoutLight ? 'border-black/10 text-[#5c5f66]' : 'border-[#35363c] text-[#949ba4]'
          }`}>
            <Calendar className="w-3.5 h-3.5" />
            <span>Membro desde {user.joinedDate || '12 de Março de 2024'}</span>
          </div>

          {/* CARGOS Section */}
          {!isDm && (
            <div className={`mt-3 pt-2 border-t relative min-w-0 ${
              isPopoutLight ? 'border-black/10' : 'border-[#35363c]'
            }`}>
              <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-1.5 ${
                isPopoutLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'
              }`}>
                Cargos
              </h4>

              {roleError && (
                <div className="mb-2 p-1.5 bg-[#f23f43]/15 border border-[#f23f43]/30 rounded text-[11px] text-[#f23f43] font-medium animate-in fade-in">
                  {roleError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                {assignedRoles.map((role) => (
                  <div
                    key={role.id}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium max-w-full shadow-xs border ${
                      isPopoutLight
                        ? 'bg-[#f2f3f5] border-black/10 text-[#2e3338]'
                        : 'bg-[#2b2d31] border-[#35373c]/50 text-[#dbdee1]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: role.color || '#99aab5' }}
                    />
                    <span className="truncate max-w-[130px]">{role.name}</span>
                    {canManageRoles && (
                      <button
                        onClick={(e) => handleRemoveRole(role.id, e)}
                        title={`Remover cargo ${role.name}`}
                        className="text-[#949ba4] hover:text-[#f23f43] p-0.5 rounded transition-colors cursor-pointer flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}

                {canManageRoles && (
                  <button
                    ref={addRoleBtnRef}
                    onClick={() => {
                      setIsAddRoleOpen(!isAddRoleOpen);
                      setRoleSearch('');
                    }}
                    title="Adicionar cargo"
                    className="inline-flex items-center gap-1 px-2 py-1 bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] hover:text-white rounded text-xs font-medium transition-colors cursor-pointer shadow-xs border border-transparent hover:border-[#4e5058]"
                  >
                    <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Adicionar cargo</span>
                  </button>
                )}

                {!canManageRoles && assignedRoles.length === 0 && (
                  <span className="text-xs text-[#80848e] italic">Nenhum cargo atribuído.</span>
                )}
              </div>

              {/* Popover Adicionar Cargo */}
              {canManageRoles && isAddRoleOpen && (
                <div
                  ref={popoverRef}
                  className="absolute bottom-full left-0 mb-2 w-full max-w-[280px] bg-[#111214] border border-[#28292d] rounded-lg shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-left"
                >
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={roleSearch}
                      onChange={(e) => setRoleSearch(e.target.value)}
                      placeholder="Cargo"
                      autoFocus
                      className="w-full bg-[#1e1f22] border border-[#232428] rounded px-2.5 py-1.5 text-xs text-white placeholder-[#80848e] focus:outline-none focus:border-[#5865f2] transition-colors"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-0.5">
                    {filteredAvailableRoles.length === 0 ? (
                      <div className="text-xs text-[#80848e] text-center py-3">
                        Nenhum cargo encontrado
                      </div>
                    ) : (
                      filteredAvailableRoles.map((role) => {
                        const isAssigned = assignedRoles.some((ar) => ar.id === role.id);
                        return (
                          <button
                            key={role.id}
                            onClick={() => handleToggleRole(role.id)}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#35373c]/60 text-[#dbdee1] hover:text-white transition-colors cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: role.color || '#99aab5' }}
                              />
                              <span className="text-xs font-medium truncate">{role.name}</span>
                            </div>
                            {isAssigned && (
                              <Check className="w-3.5 h-3.5 text-[#23a55a] flex-shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Send Message Button */}
          <button
            onClick={() => {
              setActiveChannel(`dm-${user.id}`);
              closeMemberPopout();
            }}
            className="w-full mt-3 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            Enviar Mensagem
          </button>
        </div>
      </div>
    </>
  );
};
