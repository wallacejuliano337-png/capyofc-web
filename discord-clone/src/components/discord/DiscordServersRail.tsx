import React, { useState, useEffect, useMemo } from 'react';
import { useDiscord } from '../../store/discordStore';
import { Compass, Plus, Download, Folder, X } from 'lucide-react';
import { Server, ServerFolder } from '../../types/discord';
import { isOfficialCommunity } from '../../services/communityLevel';
import { DiscordServerContextMenu } from './DiscordServerContextMenu';
import { DiscordDeleteConfirmModal } from './DiscordDeleteConfirmModal';
import { DiscordLeaveServerModal } from './DiscordLeaveServerModal';
import { DiscordInviteModal } from './DiscordInviteModal';
import { getAssetUrl, handleServerIconError } from '../../utils/assets';

export const DiscordServersRail: React.FC = () => {
  const {
    servers,
    folders,
    railOrder,
    activeServerId,
    setActiveServer,
    folderStates,
    toggleFolder,
    createFolder,
    addServerToFolder,
    removeServerFromFolder,
    moveRailItem,
    openCreateServerModal,
    openServerSettings,
    openCreateChannel,
    openCreateCategory,
    openSettingsModal,
    setActiveSettingsTab,
    openServerBoostModal,
    markServerAsRead,
    toggleMuteServer,
    reorderServers,
    deleteServer,
    leaveServer,
    roles,
    serverRolesMap,
    userRoleMap,
    currentUser,
    isAuthenticated,
  } = useDiscord();

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Drag and drop state for Servers & Folders
  const [draggedItem, setDraggedItem] = useState<{
    id: string;
    type: 'server';
    sourceFolderId?: string;
  } | null>(null);

  const [dragOverTarget, setDragOverTarget] = useState<{
    id: string;
    type: 'server' | 'folder';
    position: 'above' | 'below' | 'folder';
  } | null>(null);

  useEffect(() => {
    const handleDragReset = () => {
      setDraggedItem(null);
      setDragOverTarget(null);
    };
    window.addEventListener('dragend', handleDragReset);
    window.addEventListener('drop', handleDragReset);
    window.addEventListener('blur', handleDragReset);
    return () => {
      window.removeEventListener('dragend', handleDragReset);
      window.removeEventListener('drop', handleDragReset);
      window.removeEventListener('blur', handleDragReset);
    };
  }, []);

  // Floating Context Menu state for Server
  const [serverContextMenu, setServerContextMenu] = useState<{
    server: Server;
    position: { x: number; y: number };
  } | null>(null);

  const [deleteServerModal, setDeleteServerModal] = useState<Server | null>(null);
  const [leaveModalServer, setLeaveModalServer] = useState<Server | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteServer, setInviteServer] = useState<Server | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const isHomeActive = activeServerId === '@me';

  const checkServerPermissions = (srv: Server) => {
    const isOwner = Boolean(
      (!isAuthenticated && (currentUser?.id === 'user-ares' || (currentUser?.id === 'user-me' && srv.id !== 'server-lyc' && srv.ownerId === 'user-me'))) ||
      (currentUser?.id && srv.ownerId === currentUser.id) ||
      (isOfficialCommunity(srv) && currentUser?.id === 'f8fcd139-cf43-4873-bd7d-a807ecd73567')
    );
    const userRoleIds = userRoleMap[currentUser?.id] || [];
    const serverRoles = (serverRolesMap[srv.id] || (srv.communityId ? serverRolesMap[srv.communityId] : null) || (srv.id === 'server-lyc' ? serverRolesMap['server-lyc'] : null)) || [];
    const userRoles = serverRoles.filter((r) => userRoleIds.includes(r.id));
    const hasAdminRole = userRoles.some(
      (r) =>
        r.permissions?.administrator ||
        r.permissions?.manageCommunity ||
        r.permissions?.manageRoles ||
        r.permissions?.manageChannels
    );
    const canManageChannels = isOwner || hasAdminRole || userRoles.some((r) => r.permissions?.manageChannels);
    const canManageServer = isOwner || hasAdminRole || userRoles.some((r) => r.permissions?.manageCommunity || r.permissions?.manageRoles);
    const isAdmin = isOwner || hasAdminRole;
    return { isAdmin, isOwner, canManageChannels, canManageServer };
  };

  // Ordered list of rail items (servers & folders)
  const allRailItems = useMemo(() => {
    const items: Array<
      | { type: 'server'; data: Server }
      | { type: 'folder'; data: ServerFolder }
    > = [];
    const processedIds = new Set<string>();

    for (const id of railOrder || []) {
      const srv = servers.find((s) => s.id === id);
      if (srv) {
        items.push({ type: 'server', data: srv });
        processedIds.add(id);
        continue;
      }
      const fld = folders.find((f) => f.id === id);
      if (fld) {
        items.push({ type: 'folder', data: fld });
        processedIds.add(id);
      }
    }

    for (const s of servers) {
      if (!processedIds.has(s.id)) {
        items.push({ type: 'server', data: s });
        processedIds.add(s.id);
      }
    }

    for (const f of folders) {
      if (!processedIds.has(f.id)) {
        items.push({ type: 'folder', data: f });
        processedIds.add(f.id);
      }
    }

    return items;
  }, [railOrder, servers, folders]);

  const renderServerItem = (server: Server, sourceFolderId?: string) => {
    const isActive = activeServerId === server.id;
    const isHovered = hoveredId === server.id;
    const hasUnread = (server.unreadBadge || 0) > 0;
    const mentionCount = server.mentionCount || 0;
    const isBeingDragged = draggedItem?.id === server.id;
    const isTarget = dragOverTarget?.id === server.id && draggedItem?.id !== server.id;
    const isDropAbove = isTarget && dragOverTarget?.position === 'above';
    const isDropBelow = isTarget && dragOverTarget?.position === 'below';
    const isDropOnFolder = isTarget && dragOverTarget?.position === 'folder';

    return (
      <div
        key={server.id}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', server.id);
          setDraggedItem({
            id: server.id,
            type: 'server',
            sourceFolderId,
          });
        }}
        onDragEnd={() => {
          setDraggedItem(null);
          setDragOverTarget(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (!draggedItem || draggedItem.id === server.id) return;

          const rect = e.currentTarget.getBoundingClientRect();
          const relY = e.clientY - rect.top;
          const ratio = relY / rect.height;

          let position: 'above' | 'below' | 'folder';
          if (sourceFolderId) {
            position = ratio < 0.5 ? 'above' : 'below';
          } else {
            if (ratio < 0.25) position = 'above';
            else if (ratio > 0.75) position = 'below';
            else position = 'folder';
          }

          if (
            dragOverTarget?.id !== server.id ||
            dragOverTarget?.position !== position
          ) {
            setDragOverTarget({ id: server.id, type: 'server', position });
          }
        }}
        onDragEnter={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!draggedItem || draggedItem.id === server.id) return;

          const rect = e.currentTarget.getBoundingClientRect();
          const relY = e.clientY - rect.top;
          const ratio = relY / rect.height;

          let position: 'above' | 'below' | 'folder';
          if (sourceFolderId) {
            position = ratio < 0.5 ? 'above' : 'below';
          } else {
            if (ratio < 0.25) position = 'above';
            else if (ratio > 0.75) position = 'below';
            else position = 'folder';
          }

          if (position === 'folder') {
            if (draggedItem.sourceFolderId) {
              removeServerFromFolder(draggedItem.sourceFolderId, draggedItem.id);
            }
            createFolder(draggedItem.id, server.id);
          } else {
            if (draggedItem.sourceFolderId) {
              removeServerFromFolder(draggedItem.sourceFolderId, draggedItem.id);
            }
            moveRailItem(draggedItem.id, server.id, position);
          }

          setDraggedItem(null);
          setDragOverTarget(null);
        }}
        onClick={() => {
          if (!draggedItem) {
            setActiveServer(server.id);
          }
        }}
        onMouseEnter={() => setHoveredId(server.id)}
        onMouseLeave={() => setHoveredId(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setServerContextMenu({
            server,
            position: { x: e.clientX, y: e.clientY },
          });
        }}
        className={`group relative w-12 h-12 flex items-center justify-center cursor-pointer transition-opacity duration-150 flex-shrink-0 ${
          isBeingDragged
            ? 'opacity-50 cursor-grabbing'
            : 'cursor-grab active:cursor-grabbing'
        }`}
        aria-label={server.name}
      >
        {/* Drop Indicators */}
        {isDropAbove && (
          <span className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#23a55a] rounded-full shadow-[0_0_8px_#23a55a] pointer-events-none z-20" />
        )}
        {isDropBelow && (
          <span className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#23a55a] rounded-full shadow-[0_0_8px_#23a55a] pointer-events-none z-20" />
        )}
        {isDropOnFolder && (
          <div className="absolute inset-0 rounded-[16px] bg-[#5865f2]/40 ring-2 ring-[#5865f2] flex items-center justify-center pointer-events-none z-20 animate-pulse">
            <Folder className="w-5 h-5 text-white fill-current drop-shadow-md" />
          </div>
        )}

        {/* White Pill Indicator */}
        <span
          className={`w-1 bg-white rounded-r-full absolute -left-3 transition-all duration-200 ${
            isBeingDragged
              ? 'h-0'
              : isActive
              ? 'h-10'
              : isHovered
              ? 'h-5'
              : hasUnread
              ? 'h-2'
              : 'h-0'
          }`}
        />

        {/* Direct Image / Initials Wrapper with overflow-hidden */}
        <div
          className={`relative w-12 h-12 overflow-hidden transition-all duration-200 flex items-center justify-center ${
            isActive
              ? 'rounded-[16px]'
              : 'rounded-[24px] hover:rounded-[16px]'
          } ${isActive ? 'bg-[#5865f2] text-white' : 'bg-[#313338] text-[#dbdee1] hover:bg-[#5865f2] hover:text-white'} ${
            server.isMuted ? 'opacity-60' : ''
          }`}
        >
          {server.icon ? (
            <>
              <span className="text-sm font-bold select-none absolute inset-0 flex items-center justify-center">
                {server.initials}
              </span>
              <img
                src={getAssetUrl(server.icon)}
                alt={server.name}
                onError={handleServerIconError}
                className="w-full h-full object-cover block select-none pointer-events-none relative z-10"
              />
            </>
          ) : (
            <span className="text-sm font-bold select-none">{server.initials}</span>
          )}
        </div>

        {/* Red Mention Count Badge */}
        {mentionCount > 0 && !isActive && !isBeingDragged && (
          <span className="absolute -bottom-1 -right-1 z-10 bg-[#f23f43] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full border-[3px] border-[#1e1f22] leading-none pointer-events-none">
            {mentionCount}
          </span>
        )}

        {!draggedItem && <div className="discord-tooltip">{server.name}</div>}
      </div>
    );
  };

  const renderFolderItem = (folder: ServerFolder) => {
    const isOpen = folderStates[folder.id] ?? folder.isOpen ?? false;
    const isHovered = hoveredId === folder.id;
    const hasActiveInside = folder.servers.some((s) => s.id === activeServerId);
    const hasUnreadInside = folder.servers.some((s) => (s.unreadBadge || 0) > 0);
    const isTarget = dragOverTarget?.id === folder.id;
    const isDropAbove = isTarget && dragOverTarget?.position === 'above';
    const isDropBelow = isTarget && dragOverTarget?.position === 'below';
    const isDropOnFolder = isTarget && dragOverTarget?.position === 'folder';

    return (
      <div key={folder.id} className="w-full flex flex-col items-center flex-shrink-0 relative">
        {/* Drop Indicators */}
        {isDropAbove && (
          <span className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#23a55a] rounded-full shadow-[0_0_8px_#23a55a] pointer-events-none z-20" />
        )}
        {isDropBelow && !isOpen && (
          <span className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#23a55a] rounded-full shadow-[0_0_8px_#23a55a] pointer-events-none z-20" />
        )}

        {/* Folder Header / Toggle Button */}
        <div
          onClick={() => toggleFolder(folder.id)}
          onMouseEnter={() => setHoveredId(folder.id)}
          onMouseLeave={() => setHoveredId(null)}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!draggedItem) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const relY = e.clientY - rect.top;
            const ratio = relY / rect.height;

            let position: 'above' | 'below' | 'folder';
            if (ratio < 0.25) position = 'above';
            else if (ratio > 0.75) position = 'below';
            else position = 'folder';

            if (
              dragOverTarget?.id !== folder.id ||
              dragOverTarget?.position !== position
            ) {
              setDragOverTarget({ id: folder.id, type: 'folder', position });
            }
          }}
          onDragEnter={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!draggedItem) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const relY = e.clientY - rect.top;
            const ratio = relY / rect.height;

            let position: 'above' | 'below' | 'folder';
            if (ratio < 0.25) position = 'above';
            else if (ratio > 0.75) position = 'below';
            else position = 'folder';

            if (position === 'folder') {
              if (draggedItem.sourceFolderId !== folder.id) {
                addServerToFolder(folder.id, draggedItem.id);
              }
            } else {
              if (draggedItem.sourceFolderId) {
                removeServerFromFolder(draggedItem.sourceFolderId, draggedItem.id);
              }
              moveRailItem(draggedItem.id, folder.id, position);
            }

            setDraggedItem(null);
            setDragOverTarget(null);
          }}
          className="group relative w-12 h-12 flex items-center justify-center cursor-pointer flex-shrink-0"
          aria-label={folder.name}
        >
          {/* White Pill Indicator for Folder */}
          <span
            className={`w-1 bg-white rounded-r-full absolute -left-3 transition-all duration-200 ${
              hasActiveInside && !isOpen
                ? 'h-10'
                : isHovered
                ? 'h-5'
                : hasUnreadInside && !isOpen
                ? 'h-2'
                : 'h-0'
            }`}
          />

          {isOpen ? (
            /* Open state: Folder Icon */
            <div
              className={`w-12 h-12 flex items-center justify-center rounded-[24px] hover:rounded-[16px] transition-all bg-[#313338] text-[#5865f2] hover:text-white ${
                isDropOnFolder ? 'ring-2 ring-[#5865f2] bg-[#5865f2]/20' : ''
              }`}
            >
              <Folder className="w-6 h-6 fill-current" />
            </div>
          ) : (
            /* Closed state: 2x2 miniature icons grid */
            <div
              className={`w-12 h-12 rounded-[24px] group-hover:rounded-[16px] bg-[#313338]/90 group-hover:bg-[#313338] transition-all p-1.5 flex items-center justify-center overflow-hidden border border-[#2b2d31] relative ${
                isDropOnFolder ? 'ring-2 ring-[#5865f2] bg-[#5865f2]/25' : ''
              }`}
            >
              <div className="grid grid-cols-2 gap-1 w-full h-full items-center justify-center pointer-events-none">
                {folder.servers.slice(0, 4).map((srv) => (
                  <div
                    key={srv.id}
                    className="w-4 h-4 rounded-full overflow-hidden bg-[#1e1f22] flex items-center justify-center flex-shrink-0"
                  >
                    {srv.icon ? (
                      <img src={srv.icon} alt={srv.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[8px] font-bold text-[#dbdee1]">{srv.initials.substring(0, 2)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!draggedItem && (
            <div className="discord-tooltip">
              {folder.name} {isOpen ? '(Recolher)' : `(${folder.servers.length} servidores)`}
            </div>
          )}
        </div>

        {/* Expanded Folder Content */}
        {isOpen && (
          <div className="w-12 py-1.5 px-0.5 bg-[#2b2d31]/50 rounded-[20px] flex flex-col items-center space-y-2 border border-[#35363c]/40 mt-1 flex-shrink-0">
            {folder.servers.map((srv) => renderServerItem(srv, folder.id))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <nav className="w-[72px] min-w-[72px] max-w-[72px] h-full bg-[#1e1f22] flex flex-col items-center py-3 space-y-2 select-none flex-shrink-0 z-30 overflow-y-auto overflow-x-hidden scrollbar-none">
        {/* 1. Home / Discord Icon Button */}
        <div
          onClick={() => setActiveServer('@me')}
          onMouseEnter={() => setHoveredId('@me')}
          onMouseLeave={() => setHoveredId(null)}
          className="group relative w-12 h-12 flex items-center justify-center cursor-pointer flex-shrink-0"
          aria-label="CapyChat — Mensagens Diretas"
        >
          {/* Pill Indicator */}
          <span
            className={`w-1 bg-white rounded-r-full absolute -left-3 transition-all duration-200 ${
              isHomeActive
                ? 'h-10'
                : hoveredId === '@me'
                ? 'h-5'
                : 'h-0'
            }`}
          />

          {/* Direct Image Wrapper with overflow-hidden */}
          <div
            className={`w-12 h-12 overflow-hidden transition-all duration-200 flex items-center justify-center ${
              isHomeActive
                ? 'bg-[#8B5CF6] rounded-[16px]'
                : 'bg-[#313338] hover:bg-[#8B5CF6] rounded-[24px] hover:rounded-[16px]'
            }`}
          >
            <img
              src={getAssetUrl('logos/capy-white.png')}
              alt="Home"
              className="w-7 h-7 object-contain block select-none pointer-events-none transition-transform duration-200 group-hover:scale-110"
            />
          </div>

          {/* Discord Tooltip */}
          <div className="discord-tooltip">Mensagens Diretas</div>
        </div>

        {/* Separator */}
        <div className="w-8 h-[2px] bg-[#35363c] rounded-full flex-shrink-0" />

        {/* 2. Direct Server List & Folders */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDragOverTarget(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedItem?.sourceFolderId) {
              removeServerFromFolder(draggedItem.sourceFolderId, draggedItem.id);
            }
            setDraggedItem(null);
            setDragOverTarget(null);
          }}
          className="w-full flex flex-col items-center flex-1 space-y-2"
        >
          {allRailItems.map((item) =>
            item.type === 'server'
              ? renderServerItem(item.data)
              : renderFolderItem(item.data)
          )}

          {/* 3. Action Buttons */}
          {/* Add Server Button */}
          <div
            onClick={openCreateServerModal}
            onMouseEnter={() => setHoveredId('add-srv')}
            onMouseLeave={() => setHoveredId(null)}
            className="group relative w-12 h-12 flex items-center justify-center cursor-pointer flex-shrink-0"
            aria-label="Adicionar um servidor"
          >
            <div className="w-12 h-12 flex items-center justify-center bg-[#313338] text-[#23a55a] hover:bg-[#23a55a] hover:text-white rounded-[24px] hover:rounded-[16px] transition-all duration-200">
              <Plus className="w-6 h-6" />
            </div>
            <div className="discord-tooltip">Adicionar um Servidor</div>
          </div>

          {/* Explore Communities Button */}
          <div
            onMouseEnter={() => setHoveredId('explore-srv')}
            onMouseLeave={() => setHoveredId(null)}
            className="group relative w-12 h-12 flex items-center justify-center cursor-pointer flex-shrink-0"
            aria-label="Explorar servidores"
          >
            <div className="w-12 h-12 flex items-center justify-center bg-[#313338] text-[#23a55a] hover:bg-[#23a55a] hover:text-white rounded-[24px] hover:rounded-[16px] transition-all duration-200">
              <Compass className="w-6 h-6" />
            </div>
            <div className="discord-tooltip">Descobrir Servidores</div>
          </div>
        </div>

        {/* 4. Download Apps Button */}
        <div
          onMouseEnter={() => setHoveredId('download-app')}
          onMouseLeave={() => setHoveredId(null)}
          className="group relative w-12 h-12 flex items-center justify-center cursor-pointer pt-2 flex-shrink-0"
          aria-label="Baixar Aplicativos"
        >
          <div className="w-12 h-12 flex items-center justify-center bg-[#313338] text-[#23a55a] hover:bg-[#23a55a] hover:text-white rounded-[24px] hover:rounded-[16px] transition-all duration-200">
            <Download className="w-5 h-5" />
          </div>
          <div className="discord-tooltip">Baixar Aplicativos</div>
        </div>
      </nav>

      {/* Floating Server Context Menu */}
      {serverContextMenu && (
        <DiscordServerContextMenu
          server={serverContextMenu.server}
          position={serverContextMenu.position}
          isAdmin={checkServerPermissions(serverContextMenu.server).isAdmin}
          isOwner={checkServerPermissions(serverContextMenu.server).isOwner}
          canManageChannels={checkServerPermissions(serverContextMenu.server).canManageChannels}
          canManageServer={checkServerPermissions(serverContextMenu.server).canManageServer}
          onClose={() => setServerContextMenu(null)}
          onOpenServerBoost={() => {
            setActiveServer(serverContextMenu.server.id);
            openServerBoostModal();
            setServerContextMenu(null);
          }}
          onMarkAsRead={() => {
            markServerAsRead(serverContextMenu.server.id);
            setServerContextMenu(null);
          }}
          onInvite={() => {
            setInviteServer(serverContextMenu.server);
            setIsInviteModalOpen(true);
            setServerContextMenu(null);
          }}
          onToggleMute={() => {
            toggleMuteServer(serverContextMenu.server.id);
            setServerContextMenu(null);
          }}
          onOpenNotificationSettings={() => {
            setActiveServer(serverContextMenu.server.id);
            openServerSettings('overview');
            setServerContextMenu(null);
          }}
          onOpenServerSettings={() => {
            setActiveServer(serverContextMenu.server.id);
            openServerSettings('overview');
            setServerContextMenu(null);
          }}
          onOpenPrivacySettings={() => {
            setActiveServer(serverContextMenu.server.id);
            openSettingsModal();
            setActiveSettingsTab('privacy-safety');
            setServerContextMenu(null);
          }}
          onEditServerProfile={() => {
            setActiveServer(serverContextMenu.server.id);
            openSettingsModal();
            setActiveSettingsTab('profiles');
            setServerContextMenu(null);
          }}
          onCreateChannel={() => {
            setActiveServer(serverContextMenu.server.id);
            openCreateChannel();
            setServerContextMenu(null);
          }}
          onCreateCategory={() => {
            setActiveServer(serverContextMenu.server.id);
            openCreateCategory();
            setServerContextMenu(null);
          }}
          onCreateEvent={() => {
            setActiveServer(serverContextMenu.server.id);
            openServerSettings('overview');
            setServerContextMenu(null);
          }}
          onMoveUp={() => {
            reorderServers(serverContextMenu.server.id, 'up');
            setServerContextMenu(null);
          }}
          onMoveDown={() => {
            reorderServers(serverContextMenu.server.id, 'down');
            setServerContextMenu(null);
          }}
          onCopyId={() => {
            navigator.clipboard.writeText(serverContextMenu.server.id).catch(() => {});
            setServerContextMenu(null);
          }}
          onLeaveOrDeleteServer={() => {
            const isOwner = checkServerPermissions(serverContextMenu.server).isOwner;
            if (isOwner) {
              setDeleteServerModal(serverContextMenu.server);
            } else {
              setLeaveModalServer(serverContextMenu.server);
            }
            setServerContextMenu(null);
          }}
        />
      )}

      {/* Leave Server Confirmation Modal */}
      {leaveModalServer && (
        <DiscordLeaveServerModal
          isOpen={!!leaveModalServer}
          server={leaveModalServer}
          isOwner={checkServerPermissions(leaveModalServer).isOwner}
          onConfirm={async () => {
            return await leaveServer(leaveModalServer.id);
          }}
          onCancel={() => setLeaveModalServer(null)}
        />
      )}

      {/* Delete Server Confirmation Modal (Owner Only) */}
      {deleteServerModal && (
        <DiscordDeleteConfirmModal
          isOpen={!!deleteServerModal}
          title={`Excluir '${deleteServerModal.name}'`}
          description={`Tem certeza que deseja excluir o servidor ${deleteServerModal.name}? Esta ação é permanente e todos os dados serão perdidos.`}
          confirmLabel="Excluir Servidor"
          onConfirm={() => {
            deleteServer(deleteServerModal.id);
            setDeleteServerModal(null);
          }}
          onCancel={() => setDeleteServerModal(null)}
        />
      )}

      {/* Server Invite Modal */}
      {isInviteModalOpen && inviteServer && (
        <DiscordInviteModal
          isOpen={isInviteModalOpen}
          onClose={() => {
            setIsInviteModalOpen(false);
            setInviteServer(null);
          }}
          server={inviteServer}
        />
      )}
    </>
  );
};
