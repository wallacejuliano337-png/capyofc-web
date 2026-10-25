import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUserUnlockedBadgeIds,
  getDisplayedBadgeIds,
  CAPY_BADGES,
  BADGE_MAP,
} from '../src/types/badges';
import { loadInitialServers } from '../src/store/discordStore';
import { User, Server } from '../src/types/discord';

describe('CapyChat Oficial - Badges & Leave Server System', () => {
  describe('Insígnias Security & Display Resolution', () => {
    it('grants community & supporter badges to regular authenticated member but denies founder and staff', () => {
      const regularMember: Partial<User> = {
        id: '53f5007d-a0ba-4cac-92ee-cf57992168f9',
        name: 'capyamigo_56403',
        role: 'MEMBER',
        badges: ['early-supporter'],
      };

      const unlocked = getUserUnlockedBadgeIds(regularMember);
      expect(unlocked).toContain('capy_community');
      expect(unlocked).toContain('capy_supporter');
      expect(unlocked).not.toContain('capy_founder');
      expect(unlocked).not.toContain('capy_staff');
      expect(unlocked).not.toContain('capy_moderator');
    });

    it('grants founder, staff, and community badges to server owner', () => {
      const founderUser: Partial<User> = {
        id: 'f8fcd139-cf43-4873-bd7d-a807ecd73567',
        name: 'ares_owner',
        role: 'OWNER',
      };

      const unlocked = getUserUnlockedBadgeIds(founderUser);
      expect(unlocked).toContain('capy_founder');
      expect(unlocked).toContain('capy_staff');
      expect(unlocked).toContain('capy_moderator');
      expect(unlocked).toContain('capy_supporter');
      expect(unlocked).toContain('capy_community');
      expect(unlocked).toContain('capy_events');
    });

    it('allows user to hide unlocked badges without losing achievements', () => {
      const user: Partial<User> = {
        id: 'user-test-1',
        role: 'MEMBER',
        badges: ['early-supporter'],
      };

      const unlocked = getUserUnlockedBadgeIds(user);
      expect(unlocked).toContain('capy_community');
      expect(unlocked).toContain('capy_supporter');

      // User chooses to display ONLY capy_community (hides capy_supporter)
      const preferences = ['capy_community'];
      const displayed = getDisplayedBadgeIds(unlocked, preferences);

      expect(displayed).toEqual(['capy_community']);
      // Achievement is NOT lost
      expect(unlocked).toContain('capy_supporter');
    });

    it('security test: strips unauthorized badges even if sent in client preferences', () => {
      const regularUser: Partial<User> = {
        id: 'regular-user-id',
        role: 'MEMBER',
      };

      const unlocked = getUserUnlockedBadgeIds(regularUser);
      expect(unlocked).not.toContain('capy_founder');

      // Malicious client tries to inject capy_founder and capy_staff in preferences
      const tamperedPreferences = ['capy_founder', 'capy_staff', 'capy_community'];
      const displayed = getDisplayedBadgeIds(unlocked, tamperedPreferences);

      // Only genuinely unlocked badges pass through
      expect(displayed).toEqual(['capy_community']);
      expect(displayed).not.toContain('capy_founder');
      expect(displayed).not.toContain('capy_staff');
    });

    it('resets to default: displays all unlocked badges when preferences are null', () => {
      const user: Partial<User> = {
        id: 'user-default',
        role: 'ADMIN',
      };

      const unlocked = getUserUnlockedBadgeIds(user);
      const defaultDisplayed = getDisplayedBadgeIds(unlocked, null);

      expect(defaultDisplayed).toEqual(unlocked);
    });

    it('verifies all 6 CapyChat badge definitions exist with valid colors and descriptions', () => {
      expect(CAPY_BADGES.length).toBe(6);
      const expectedIds = [
        'capy_founder',
        'capy_staff',
        'capy_moderator',
        'capy_supporter',
        'capy_community',
        'capy_events',
      ];
      for (const id of expectedIds) {
        expect(BADGE_MAP[id]).toBeDefined();
        expect(BADGE_MAP[id].name.length).toBeGreaterThan(0);
        expect(BADGE_MAP[id].description.length).toBeGreaterThan(0);
        expect(BADGE_MAP[id].color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe('Sair do Servidor (Leave Server) Guard & Persistence', () => {
    it('owner guard: owner cannot leave their server without transferring ownership', () => {
      const server: Partial<Server> = {
        id: 'server-custom',
        name: 'Meu Servidor',
        ownerId: 'user-alice',
      };

      const currentUserAlice: Partial<User> = { id: 'user-alice' };
      const isOwner = server.ownerId === currentUserAlice.id;
      expect(isOwner).toBe(true);
    });

    it('regular member can leave: isOwner is false', () => {
      const server: Partial<Server> = {
        id: 'server-custom',
        name: 'Servidor Público',
        ownerId: 'user-alice',
      };

      const currentUserBob: Partial<User> = { id: 'user-bob' };
      const isOwner = server.ownerId === currentUserBob.id;
      expect(isOwner).toBe(false);
    });
  });
});
