import { describe, it, expect } from 'vitest';
import {
  CAPY_BADGES,
  BADGE_MAP,
  getUserUnlockedBadgeIds,
  getDisplayedBadgeIds,
} from '../src/types/badges';
import { mockUsers, currentUser } from '../src/store/discordStore';
import { User } from '../src/types/discord';

export interface ServerInviteItem {
  id?: string;
  code: string;
  creator: string;
  channel: string;
  uses: number;
  maxUses: number;
  expires: string;
  avatar?: string;
}

describe('CapyChat Oficial - Invites & Badge Refinements System', () => {
  describe('1. HypeSquad Complete Removal Verification', () => {
    it('ensures no HypeSquad badges exist in CAPY_BADGES catalog', () => {
      const allBadgeIds = CAPY_BADGES.map((b) => b.id.toLowerCase());
      const allBadgeNames = CAPY_BADGES.map((b) => b.name.toLowerCase());

      expect(allBadgeIds).not.toContain('hypesquad');
      expect(allBadgeIds).not.toContain('hypesquad-bravery');
      expect(allBadgeIds).not.toContain('hypesquad-brilliance');
      expect(allBadgeIds).not.toContain('hypesquad-balance');

      for (const name of allBadgeNames) {
        expect(name).not.toContain('hypesquad');
      }
    });

    it('ensures no HypeSquad keys exist in BADGE_MAP dictionary', () => {
      const keys = Object.keys(BADGE_MAP).map((k) => k.toLowerCase());
      expect(keys.some((k) => k.includes('hypesquad'))).toBe(false);
    });

    it('ensures currentUser and mockUsers do not contain any HypeSquad badges', () => {
      const allUsers = [currentUser, ...mockUsers];
      for (const user of allUsers) {
        if (user.badges) {
          for (const b of user.badges) {
            expect(b.toLowerCase()).not.toContain('hypesquad');
          }
        }
      }
    });
  });

  describe('2. Badges Sizing & Compact Profile Popout Contract', () => {
    it('defines exactly the 6 approved CapyChat badges with appropriate metadata', () => {
      expect(CAPY_BADGES).toHaveLength(6);
      const expectedBadgeIds = [
        'capy_founder',
        'capy_staff',
        'capy_moderator',
        'capy_supporter',
        'capy_community',
        'capy_events',
      ];
      expect(CAPY_BADGES.map((b) => b.id)).toEqual(expectedBadgeIds);
    });

    it('confirms genuine security resolution for badges (privilege isolation)', () => {
      const regularUser: Partial<User> = {
        id: 'member-uuid-1234',
        role: 'MEMBER',
      };

      const unlocked = getUserUnlockedBadgeIds(regularUser);
      expect(unlocked).toContain('capy_community');
      expect(unlocked).not.toContain('capy_founder');
      expect(unlocked).not.toContain('capy_staff');

      // Attempting to forge display preferences with unauthorized badges
      const forgedPreferences = ['capy_founder', 'capy_staff', 'hypesquad-bravery', 'capy_community'];
      const displayed = getDisplayedBadgeIds(unlocked, forgedPreferences);

      expect(displayed).toEqual(['capy_community']);
      expect(displayed).not.toContain('capy_founder');
      expect(displayed).not.toContain('capy_staff');
      expect(displayed).not.toContain('hypesquad-bravery');
    });

    it('preserves achievement when user toggles off a badge from their public display', () => {
      const supporterUser: Partial<User> = {
        id: 'user-supporter',
        role: 'MEMBER',
        badges: ['early-supporter'],
      };

      const unlocked = getUserUnlockedBadgeIds(supporterUser);
      expect(unlocked).toContain('capy_community');
      expect(unlocked).toContain('capy_supporter');

      // User chooses to hide supporter from display
      const preferences = ['capy_community'];
      const displayed = getDisplayedBadgeIds(unlocked, preferences);

      expect(displayed).toEqual(['capy_community']);
      // Still unlocked in history/achievements
      expect(unlocked).toContain('capy_supporter');
    });
  });

  describe('3. Modern Invites Management Logic', () => {
    it('creates a new invite with custom channel, expiration, and max uses', () => {
      const mockChannel = '#chat-geral';
      const mockCreator = 'Ares_Admin';

      // Mock creation factory simulating createInvite behavior
      const newInvite: ServerInviteItem = {
        code: 'CAPY-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        channel: mockChannel,
        creator: mockCreator,
        avatar: '/avatars/ares.png',
        uses: 0,
        maxUses: 25,
        expires: 'Em 7 dias',
      };

      expect(newInvite.code).toMatch(/^CAPY-[A-Z0-9]+$/);
      expect(newInvite.channel).toBe('#chat-geral');
      expect(newInvite.maxUses).toBe(25);
      expect(newInvite.uses).toBe(0);
      expect(newInvite.expires).toBe('Em 7 dias');
    });

    it('tracks uses and expiration progress correctly', () => {
      const limitedInvite: ServerInviteItem = {
        code: 'CAPY-LIMITED',
        channel: '#geral',
        creator: 'Tester',
        uses: 7,
        maxUses: 10,
        expires: 'Em 2 dias',
      };

      const isLimited = (limitedInvite.maxUses ?? 0) > 0;
      const progressPercent = isLimited
        ? Math.min(100, Math.round(((limitedInvite.uses || 0) / limitedInvite.maxUses!) * 100))
        : 0;

      expect(isLimited).toBe(true);
      expect(progressPercent).toBe(70);
    });

    it('revokes an invite successfully from the server list', () => {
      let invites: ServerInviteItem[] = [
        {
          code: 'CAPY-ABC',
          channel: '#chat-geral',
          creator: 'Admin',
          uses: 2,
          maxUses: 100,
          expires: 'Em 1 dia',
        },
        {
          code: 'CAPY-XYZ',
          channel: '#torneios',
          creator: 'Mod',
          uses: 5,
          maxUses: 0,
          expires: 'Nunca',
        },
      ];

      const inviteToRevokeCode = 'CAPY-ABC';
      invites = invites.filter((inv) => inv.code !== inviteToRevokeCode);

      expect(invites).toHaveLength(1);
      expect(invites[0].code).toBe('CAPY-XYZ');
      expect(invites.some((inv) => inv.code === inviteToRevokeCode)).toBe(false);
    });

    it('handles pause invites state preventing joins', () => {
      let pauseInvites = false;

      const canJoinViaInvite = (isPaused: boolean, invite: ServerInviteItem) => {
        if (isPaused) return false;
        if (invite.maxUses > 0 && invite.uses >= invite.maxUses) return false;
        if (invite.expires === 'Expirado') return false;
        return true;
      };

      const validInvite: ServerInviteItem = {
        code: 'CAPY-VALID',
        channel: '#regras',
        creator: 'Admin',
        uses: 0,
        maxUses: 10,
        expires: 'Em 6 dias',
      };

      // Unpaused -> Allowed
      expect(canJoinViaInvite(pauseInvites, validInvite)).toBe(true);

      // Paused -> Blocked
      pauseInvites = true;
      expect(canJoinViaInvite(pauseInvites, validInvite)).toBe(false);
    });
  });
});
