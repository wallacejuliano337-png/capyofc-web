import { describe, it, expect, beforeEach } from 'vitest';
import { useDiscord, defaultEveryoneRole, defaultRoles } from '../src/store/discordStore';
import { CAPY_BADGES, getUserUnlockedBadgeIds } from '../src/types/badges';

describe('Clean Servers, Dynamic Audit Logs, Badges and Moderation', () => {
  beforeEach(() => {
    // Reset store state
    const store = useDiscord.getState();
    store.setActiveServer('server-lyc');
  });

  describe('1. Scoped Server Roles & Clean Server Birth', () => {
    it('official server contains standard default roles', () => {
      const store = useDiscord.getState();
      const lycRoles = store.getServerRoles('server-lyc');
      expect(lycRoles.length).toBeGreaterThan(1);
      expect(lycRoles.some((r) => r.id === 'role-admin')).toBe(true);
      expect(lycRoles.some((r) => r.id === 'role-everyone')).toBe(true);
    });

    it('new custom server is born clean with ONLY @everyone role', () => {
      const store = useDiscord.getState();
      const newServerId = `server-clean-${Date.now()}`;
      
      store.addServer({
        id: newServerId,
        name: 'Servidor Limpo de Teste',
        ownerId: store.currentUser.id,
      });

      const roles = store.getServerRoles(newServerId);
      expect(roles).toHaveLength(1);
      expect(roles[0].id).toBe('role-everyone');
      expect(roles[0].name).toBe('@everyone');
      // No demo roles
      expect(roles.some((r) => r.name === 'Admin Fundador')).toBe(false);
      expect(roles.some((r) => r.name === 'Moderador Geral')).toBe(false);
      expect(roles.some((r) => r.name === 'Competidor Pro')).toBe(false);
      expect(roles.some((r) => r.name === 'Streamer / VIP')).toBe(false);
    });

    it('switching to new server updates active roles to only @everyone', () => {
      const store = useDiscord.getState();
      const customId = `server-switch-${Date.now()}`;
      store.addServer({
        id: customId,
        name: 'Comunidade Alpha',
        ownerId: store.currentUser.id,
      });

      // Switched automatically by addServer
      expect(useDiscord.getState().activeServerId).toBe(customId);
      expect(useDiscord.getState().roles).toHaveLength(1);
      expect(useDiscord.getState().roles[0].id).toBe('role-everyone');

      // Switch back to official server
      useDiscord.getState().setActiveServer('server-lyc');
      expect(useDiscord.getState().roles.length).toBeGreaterThan(1);
      expect(useDiscord.getState().roles.some((r) => r.id === 'role-admin')).toBe(true);
    });
  });

  describe('2. Scoped & Dynamic Audit Logs per Server', () => {
    it('official server preserves historic logs', () => {
      const store = useDiscord.getState();
      const logs = store.getAuditLogs('server-lyc');
      expect(logs.length).toBeGreaterThan(0);
    });

    it('newly created server starts with empty audit log list', () => {
      const store = useDiscord.getState();
      const cleanServerId = `server-audit-clean-${Date.now()}`;
      store.addServer({
        id: cleanServerId,
        name: 'Servidor Sem Logs Antigos',
        ownerId: store.currentUser.id,
      });

      const cleanLogs = store.getAuditLogs(cleanServerId);
      expect(cleanLogs).toHaveLength(0);
    });

    it('channel creation on a server adds real audit log entry to that server only', () => {
      const store = useDiscord.getState();
      const serverId = `server-audit-actions-${Date.now()}`;
      store.addServer({
        id: serverId,
        name: 'Servidor de Ações',
        ownerId: store.currentUser.id,
      });

      expect(store.getAuditLogs(serverId)).toHaveLength(0);

      // Add channel
      store.addChannel(serverId, '', {
        name: 'canal-de-boas-vindas',
        type: 'text',
      });

      const updatedLogs = store.getAuditLogs(serverId);
      expect(updatedLogs.length).toBe(1);
      expect(updatedLogs[0].actionType).toBe('channel_create');
      expect(updatedLogs[0].target).toContain('canal-de-boas-vindas');
      expect(updatedLogs[0].user).toBe(store.currentUser.displayName || store.currentUser.name);

      // Verify server-lyc did NOT get polluted by this entry
      const lycLogs = store.getAuditLogs('server-lyc');
      expect(lycLogs.some((l) => l.target.includes('canal-de-boas-vindas'))).toBe(false);
    });
  });

  describe('3. Server Owner Moderation Permissions', () => {
    it('creator of a custom server has full administrator and moderation permissions', () => {
      const store = useDiscord.getState();
      const serverId = `server-owner-mod-${Date.now()}`;
      const creatorId = store.currentUser.id;

      store.addServer({
        id: serverId,
        name: 'Meu Servidor Autônomo',
        ownerId: creatorId,
      });

      const perms = store.canUserModerate(creatorId, undefined, serverId);
      expect(perms.isAdmin).toBe(true);
      expect(perms.canKick).toBe(true);
      expect(perms.canBan).toBe(true);
      expect(perms.canManageRoles).toBe(true);
    });
  });

  describe('4. CapyChat Badges & Unlock Requirements', () => {
    it('all 6 official badges have descriptive unlock requirements', () => {
      expect(CAPY_BADGES).toHaveLength(6);
      CAPY_BADGES.forEach((badge) => {
        expect(badge.unlockRequirement).toBeDefined();
        expect(badge.unlockRequirement.length).toBeGreaterThan(10);
      });
    });

    it('regular user has community badge and cannot self-grant founder or staff', () => {
      const regularUser = {
        id: 'user-regular-1234',
        name: 'CapyMembro',
        role: 'USER',
      };
      const unlocked = getUserUnlockedBadgeIds(regularUser);
      expect(unlocked).toContain('capy_community');
      expect(unlocked).not.toContain('capy_founder');
      expect(unlocked).not.toContain('capy_staff');
    });

    it('founder/owner unlocks founder and staff badges', () => {
      const founderUser = {
        id: 'f8fcd139-cf43-4873-bd7d-a807ecd73567',
        name: 'Fundador',
        role: 'OWNER',
      };
      const unlocked = getUserUnlockedBadgeIds(founderUser);
      expect(unlocked).toContain('capy_founder');
      expect(unlocked).toContain('capy_staff');
      expect(unlocked).toContain('capy_moderator');
    });
  });
});
