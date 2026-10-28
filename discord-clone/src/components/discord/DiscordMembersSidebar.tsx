import React, { useState } from 'react';
import { useDiscord, currentUser } from '../../store/discordStore';
import { Crown, Shield, Gamepad2, Tv, Headphones, ChevronDown } from 'lucide-react';
import { User, Role, resolveServerTagBadge, resolveServerTagColor, resolveServerTagBadgeIcon } from '../../types/discord';
import { DiscordUserContextMenu } from './DiscordUserContextMenu';
import { getAvatarUrl, handleAvatarError } from '../../utils/avatar';
import { getAssetUrl } from '../../utils/assets';
import { getStyledNameCSS, getFontClassName } from '../../utils/nameStyle';

export const DiscordMembersSidebar: React.FC = () => {
  const {
    isMemberListOpen,
    openMemberPopout,
    getUserRoleColor,
    roles,
    serverRolesMap,
    getServerRoles,
    userRoleMap,
    activeServerId,
    servers,
    communityMembers,
    currentUser: storeCurrentUser,
    getServerMembers,
  } = useDiscord();

  const [userContextMenu, setUserContextMenu] = useState<{
    user: User;
    position: { x: number; y: number };
  } | null>(null);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isMemberListOpen) return null;

  const currentServer = servers.find((s) => s.id === activeServerId) || servers[0];
  const isDm = activeServerId === '@me';

  const tagColor = !isDm && currentServer?.serverTag ? resolveServerTagColor(currentServer.serverTagColor) : null;
  const tagBadgeIcon = !isDm && currentServer?.serverTag ? resolveServerTagBadgeIcon(currentServer.serverTagBadge, currentServer.serverTagBadgeImage) : null;
  const tagBadgeChar = !isDm && currentServer?.serverTag ? resolveServerTagBadge(currentServer.serverTagBadge) : '💎';

  // Scope members strictly to the current active server
  const currentActiveUser = storeCurrentUser || currentUser;
  const currentServerMembers = getServerMembers(currentServer.id);
  const allMembers: User[] = currentServerMembers.map((m) =>
    (m.id === currentActiveUser?.id || m.id === 'user-me' || m.name === currentActiveUser?.name)
      ? { ...m, ...currentActiveUser }
      : m
  );

  // 1. Separate online vs offline members
  const onlineMembersList = allMembers.filter((m) => m.status !== 'offline');
  const offlineMembersList = allMembers.filter((m) => m.status === 'offline');

  // 2. Derive configured server roles sorted by position descending (highest hierarchy first)
  const configuredRoles = React.useMemo(() => {
    if (isDm || !currentServer) return [];
    const sRoles =
      getServerRoles(currentServer.id).length > 0
        ? getServerRoles(currentServer.id)
        : (serverRolesMap[currentServer.id] || serverRolesMap[currentServer.communityId || ''] || roles);

    return [...sRoles]
      .filter((r) => r.id !== 'role-everyone' && r.name !== '@everyone' && r.name !== '@todos')
      .sort((a, b) => (b.position ?? 0) - (a.position ?? 0));
  }, [isDm, currentServer, getServerRoles, serverRolesMap, roles]);

  // Helper to determine a member's highest role
  const getMemberHighestRole = (member: User): Role | null => {
    const userRoleIds =
      userRoleMap[member.id] ||
      (member.id === currentActiveUser?.id
        ? userRoleMap['user-me'] || userRoleMap[currentActiveUser?.id] || []
        : []);

    // Owner always maps to the highest owner/founder role if configured
    const isOwner = currentServer && member.id === currentServer.ownerId;
    if (isOwner) {
      const ownerRole = configuredRoles.find(
        (r) =>
          r.base_role === 'OWNER' ||
          r.name.toLowerCase().includes('propriet') ||
          r.name.toLowerCase().includes('dono') ||
          r.name.toLowerCase().includes('fundador')
      );
      if (ownerRole) return ownerRole;
    }

    // Match first role in sorted list (highest hierarchy)
    for (const r of configuredRoles) {
      if (userRoleIds.includes(r.id)) return r;
      if (
        r.base_role === 'ADMIN' &&
        (userRoleIds.includes('role-admin') || member.role === 'ADMIN' || member.role === 'OWNER')
      ) {
        return r;
      }
      if (
        r.base_role === 'MODERATOR' &&
        (userRoleIds.includes('role-mod') || member.role === 'MODERATOR')
      ) {
        return r;
      }
    }
    return null;
  };

  // 3. Group online members by highest role without duplicate entries
  const roleGroups: { role: Role; members: User[] }[] = [];
  const assignedOnlineIds = new Set<string>();

  for (const role of configuredRoles) {
    const membersForRole = onlineMembersList.filter((user) => {
      if (assignedOnlineIds.has(user.id)) return false;
      const highestRole = getMemberHighestRole(user);
      return highestRole?.id === role.id;
    });

    if (membersForRole.length > 0) {
      membersForRole.forEach((u) => assignedOnlineIds.add(u.id));
      roleGroups.push({
        role,
        members: membersForRole,
      });
    }
  }

  // 4. Online members without custom roles (default group: Membros)
  const defaultOnlineMembers = onlineMembersList.filter(
    (user) => !assignedOnlineIds.has(user.id)
  );

  const getRoleBadge = (user: User, role?: Role) => {
    if (user.isBot) {
      return (
        <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wider flex items-center leading-none">
          BOT
        </span>
      );
    }
    if (
      role?.id === 'role-admin' ||
      role?.name.toLowerCase().includes('admin') ||
      role?.name.toLowerCase().includes('fundador') ||
      role?.name.toLowerCase().includes('propriet')
    ) {
      return <Crown className="w-3.5 h-3.5 text-[#f1c40f] flex-shrink-0" />;
    }
    if (
      role?.id === 'role-mod' ||
      role?.name.toLowerCase().includes('mod')
    ) {
      return <Shield className="w-3.5 h-3.5 text-[#5865f2] flex-shrink-0" />;
    }
    return null;
  };

  const renderMember = (user: User, roleColor?: string, badge?: React.ReactNode) => {
    const dynamicColor = getUserRoleColor(user.id);
    const effectiveColor = roleColor || dynamicColor;

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'online':
          return 'bg-[#23a55a]';
        case 'idle':
          return 'bg-[#f0b232]';
        case 'dnd':
          return 'bg-[#f23f43]';
        default:
          return 'bg-[#80848e]';
      }
    };

    return (
      <div
        key={user.id}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          openMemberPopout(user, { top: rect.top, right: window.innerWidth - rect.left + 8 });
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          openMemberPopout(user, { top: rect.top, right: window.innerWidth - rect.left + 8 });
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setUserContextMenu({
            user,
            position: { x: e.clientX, y: e.clientY },
          });
        }}
        className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-[#35373c]/60 cursor-pointer group transition-colors select-none"
      >
        {/* Avatar with Status */}
        <div className="relative flex-shrink-0">
          <img
            src={getAvatarUrl(user.avatar)}
            alt={user.name}
            onError={handleAvatarError}
            className={`w-8 h-8 rounded-full object-cover ${
              user.status === 'offline' ? 'opacity-60' : ''
            }`}
          />
          {user.status === 'idle' ? (
            <img
              src={getAssetUrl('brand/04_Recortes_PNG_Alta_Resolucao/Mascotes_Expressoes/06_Dormindo.png')}
              alt="Ausente"
              title="Ausente (Dormindo)"
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-[#2b2d31] bg-[#1F1F26] object-cover shadow"
            />
          ) : (
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2b2d31] ${getStatusColor(
                user.status
              )}`}
            />
          )}
        </div>

        {/* User Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Tag Oficial do Servidor na lista de membros (à esquerda do nome) */}
            {!isDm && currentServer?.serverTag && tagColor && (
              <span
                className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm flex-shrink-0 select-none leading-none"
                title={`Tag oficial: ${currentServer.serverTag}`}
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
                    className="w-3 h-3 object-contain rounded-sm flex-shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                  />
                )}
                <span>{currentServer.serverTag}</span>
              </span>
            )}

            {(() => {
              const isSelf = user.id === storeCurrentUser.id || user.id === 'user-me' || user.name === storeCurrentUser.name;
              const effectiveFont = user.nameFont || (isSelf ? storeCurrentUser.nameFont : undefined);
              const effectiveEffect = user.nameEffect || (isSelf ? storeCurrentUser.nameEffect : undefined);
              const effectiveNameColor = user.nameColor || (isSelf ? storeCurrentUser.nameColor : undefined);
              const effectiveDisplayName = isSelf ? (storeCurrentUser.displayName || user.displayName || user.name) : (user.displayName || user.name);
              const styleColor = user.status === 'offline' ? '#80848e' : (effectiveNameColor || effectiveColor);
              const styledCSS = getStyledNameCSS(effectiveFont, effectiveEffect, styleColor);
              const fontClass = getFontClassName(effectiveFont);

              return (
                <span
                  style={{ color: styleColor, ...styledCSS }}
                  className={`text-sm font-semibold truncate min-w-0 ${user.status === 'offline' ? 'opacity-60' : ''} ${fontClass}`}
                >
                  {effectiveDisplayName}
                </span>
              );
            })()}

            {badge}
          </div>

          {/* Activity / Custom Status */}
          {user.activity ? (
            <div className="flex items-center gap-1 text-[11px] text-[#949ba4] truncate">
              {user.activity.type === 'PLAYING' && <Gamepad2 className="w-3 h-3 flex-shrink-0" />}
              {user.activity.type === 'STREAMING' && (
                <Tv className="w-3 h-3 flex-shrink-0 text-[#5865f2]" />
              )}
              {user.activity.type === 'LISTENING' && (
                <Headphones className="w-3 h-3 flex-shrink-0 text-[#23a55a]" />
              )}
              <span className="truncate">
                {user.activity.name}
                {user.activity.details ? ` - ${user.activity.details}` : ''}
              </span>
            </div>
          ) : user.customStatus ? (
            <p className="text-[11px] text-[#949ba4] truncate">
              {user.customStatus}
            </p>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <aside className="w-60 h-full bg-[#2b2d31] flex flex-col flex-shrink-0 select-none border-l border-[#1f2023] z-10 overflow-y-auto px-2 py-4 space-y-4 scrollbar-thin">
      {/* 1. Dynamic Role Groups (ordered by role hierarchy) */}
      {roleGroups.map(({ role, members }) => {
        const isCollapsed = !!collapsedGroups[role.id];
        return (
          <div key={role.id}>
            <button
              type="button"
              onClick={() => toggleGroup(role.id)}
              className="w-full px-2 pb-1 text-[11px] font-bold uppercase tracking-wider flex items-center justify-between transition-colors cursor-pointer hover:opacity-80 select-none text-left"
              style={{ color: role.color !== '#99aab5' ? role.color : '#949ba4' }}
              title={isCollapsed ? `Expandir ${role.name}` : `Recolher ${role.name}`}
            >
              <div className="flex items-center gap-1 min-w-0">
                <ChevronDown
                  className={`w-3 h-3 flex-shrink-0 transition-transform duration-150 ${
                    isCollapsed ? '-rotate-90' : 'rotate-0'
                  }`}
                />
                <span className="truncate">
                  {role.name} — {members.length}
                </span>
              </div>
            </button>
            {!isCollapsed && (
              <div className="space-y-0.5">
                {members.map((u) => renderMember(u, role.color, getRoleBadge(u, role)))}
              </div>
            )}
          </div>
        );
      })}

      {/* 2. Default Group (Online Members without custom roles) */}
      {defaultOnlineMembers.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => toggleGroup('group-default-online')}
            className="w-full px-2 pb-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider flex items-center justify-between transition-colors cursor-pointer hover:opacity-80 select-none text-left"
            title={collapsedGroups['group-default-online'] ? 'Expandir Membros' : 'Recolher Membros'}
          >
            <div className="flex items-center gap-1 min-w-0">
              <ChevronDown
                className={`w-3 h-3 flex-shrink-0 transition-transform duration-150 ${
                  collapsedGroups['group-default-online'] ? '-rotate-90' : 'rotate-0'
                }`}
              />
              <span className="truncate">Membros — {defaultOnlineMembers.length}</span>
            </div>
          </button>
          {!collapsedGroups['group-default-online'] && (
            <div className="space-y-0.5">
              {defaultOnlineMembers.map((u) => renderMember(u, undefined, getRoleBadge(u)))}
            </div>
          )}
        </div>
      )}

      {/* 3. Offline Group */}
      {offlineMembersList.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => toggleGroup('group-offline')}
            className="w-full px-2 pb-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider flex items-center justify-between transition-colors cursor-pointer hover:opacity-80 select-none text-left"
            title={collapsedGroups['group-offline'] ? 'Expandir Offline' : 'Recolher Offline'}
          >
            <div className="flex items-center gap-1 min-w-0">
              <ChevronDown
                className={`w-3 h-3 flex-shrink-0 transition-transform duration-150 ${
                  collapsedGroups['group-offline'] ? '-rotate-90' : 'rotate-0'
                }`}
              />
              <span className="truncate">Offline — {offlineMembersList.length}</span>
            </div>
          </button>
          {!collapsedGroups['group-offline'] && (
            <div className="space-y-0.5">
              {offlineMembersList.map((u) => renderMember(u, '#80848e', getRoleBadge(u)))}
            </div>
          )}
        </div>
      )}

      {/* User Context Menu */}
      {userContextMenu && (
        <DiscordUserContextMenu
          user={userContextMenu.user}
          position={userContextMenu.position}
          context="member"
          onClose={() => setUserContextMenu(null)}
          onOpenProfile={(u) => {
            openMemberPopout(u, {
              top: userContextMenu.position.y,
              right: window.innerWidth - userContextMenu.position.x,
            });
          }}
          onMentionUser={(u) => {
            const chatInput = document.querySelector(
              'textarea, input[placeholder*="Conversar"]'
            ) as HTMLInputElement | HTMLTextAreaElement;
            if (chatInput) {
              chatInput.value = chatInput.value ? `${chatInput.value} @${u.name} ` : `@${u.name} `;
              chatInput.focus();
            }
          }}
        />
      )}
    </aside>
  );
};
