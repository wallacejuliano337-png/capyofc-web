import React, { useState } from 'react';
import { useDiscord, currentUser } from '../../store/discordStore';
import { Crown, Shield, Gamepad2, Tv, Headphones } from 'lucide-react';
import { User, Role, resolveServerTagBadge, resolveServerTagColor, resolveServerTagBadgeIcon } from '../../types/discord';
import { DiscordUserContextMenu } from './DiscordUserContextMenu';
import { getAvatarUrl } from '../../utils/avatar';

export const DiscordMembersSidebar: React.FC = () => {
  const {
    isMemberListOpen,
    openMemberPopout,
    getUserRoleColor,
    roles,
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

  if (!isMemberListOpen) return null;

  const currentServer = servers.find((s) => s.id === activeServerId) || servers[0];
  const isDm = activeServerId === '@me';

  const tagColor = !isDm && currentServer?.serverTag ? resolveServerTagColor(currentServer.serverTagColor) : null;
  const tagBadgeIcon = !isDm && currentServer?.serverTag ? resolveServerTagBadgeIcon(currentServer.serverTagBadge, currentServer.serverTagBadgeImage) : null;
  const tagBadgeChar = !isDm && currentServer?.serverTag ? resolveServerTagBadge(currentServer.serverTagBadge) : '💎';

  // Scope members strictly to the current active server (owner/invited members only, zero test accounts)
  const currentActiveUser = storeCurrentUser || currentUser;
  const currentServerMembers = getServerMembers(currentServer.id);
  const allMembers: User[] = currentServerMembers.map((m) =>
    m.id === currentActiveUser?.id ? { ...m, ...currentActiveUser } : m
  );

  // 1. Separate online vs offline members
  const onlineMembersList = allMembers.filter((m) => m.status !== 'offline');
  const offlineMembersList = allMembers.filter((m) => m.status === 'offline');

  // 2. Group members hierarchically according to server roles hierarchy (Discord standard)
  const assignedUserIds = new Set<string>();
  const roleGroups: { role: Role; members: User[] }[] = [];

  for (const role of roles) {
    if (role.id === 'role-everyone' || !role.hoist) continue;

    const membersForRole = onlineMembersList.filter((user) => {
      if (assignedUserIds.has(user.id)) return false;
      const userRoleIds = userRoleMap[user.id] || [];
      const hasDirectRole = userRoleIds.includes(role.id);
      const isRoleAdmin = role.id === 'role-admin' && (user.role === 'OWNER' || user.role === 'ADMIN');
      return hasDirectRole || isRoleAdmin;
    });

    if (membersForRole.length > 0) {
      membersForRole.forEach((u) => assignedUserIds.add(u.id));
      roleGroups.push({
        role,
        members: membersForRole,
      });
    }
  }

  // 3. Online members who do not have a hoisted role
  const unhoistedOnlineMembers = onlineMembersList.filter(
    (user) => !assignedUserIds.has(user.id)
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
      role?.name.toLowerCase().includes('fundador')
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
            className={`w-8 h-8 rounded-full object-cover ${
              user.status === 'offline' ? 'opacity-60' : ''
            }`}
          />
          {user.status === 'idle' ? (
            <img
              src="/brand/04_Recortes_PNG_Alta_Resolucao/Mascotes_Expressoes/06_Dormindo.png"
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
            <span
              style={{ color: user.status === 'offline' ? '#80848e' : effectiveColor }}
              className={`text-sm font-semibold truncate ${user.status === 'offline' ? 'opacity-60' : ''}`}
            >
              {user.displayName || user.name}
            </span>

            {/* Tag Oficial do Servidor na lista de membros */}
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
      {roleGroups.map(({ role, members }) => (
        <div key={role.id}>
          <h3
            className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider flex items-center justify-between transition-colors"
            style={{ color: role.color !== '#99aab5' ? role.color : '#949ba4' }}
          >
            <span className="truncate">{role.name} — {members.length}</span>
          </h3>
          <div className="space-y-0.5">
            {members.map((u) => renderMember(u, role.color, getRoleBadge(u, role)))}
          </div>
        </div>
      ))}

      {/* 2. Online (Members without a hoisted role) */}
      {unhoistedOnlineMembers.length > 0 && (
        <div>
          <h3 className="px-2 pb-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider">
            Online — {unhoistedOnlineMembers.length}
          </h3>
          <div className="space-y-0.5">
            {unhoistedOnlineMembers.map((u) => renderMember(u, undefined, getRoleBadge(u)))}
          </div>
        </div>
      )}

      {/* 3. Offline */}
      {offlineMembersList.length > 0 && (
        <div>
          <h3 className="px-2 pb-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider">
            Offline — {offlineMembersList.length}
          </h3>
          <div className="space-y-0.5">
            {offlineMembersList.map((u) => renderMember(u, '#80848e', getRoleBadge(u)))}
          </div>
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
            const chatInput = document.querySelector('textarea, input[placeholder*="Conversar"]') as HTMLInputElement | HTMLTextAreaElement;
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
