import { describe, it, expect } from 'vitest';
import {
  CAPY_BADGES,
  BADGE_MAP,
  getUserUnlockedBadgeIds,
  getDisplayedBadgeIds,
} from '../src/types/badges';
import { User } from '../src/types/discord';

describe('CapyBadges System & Security', () => {
  it('defines all 6 official CapyChat badges with proper metadata and category labels', () => {
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
      const badge = BADGE_MAP[id];
      expect(badge).toBeDefined();
      expect(badge.name).toBeTruthy();
      expect(badge.description).toBeTruthy();
      expect(badge.color).toMatch(/^#/);
    }
  });

  it('correctly assigns founder badge only to founder accounts (Coronel / OWNER)', () => {
    const founderUser: Partial<User> & { role?: string } = {
      id: 'f8fcd139-cf43-4873-bd7d-a807ecd73567',
      name: 'lycdev',
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

  it('assigns staff and moderator badges to staff accounts', () => {
    const staffUser: Partial<User> & { role?: string } = {
      id: 'test-staff-user-id',
      name: 'StaffMember',
      role: 'STAFF',
    };
    const unlocked = getUserUnlockedBadgeIds(staffUser);
    expect(unlocked).not.toContain('capy_founder');
    expect(unlocked).toContain('capy_staff');
    expect(unlocked).toContain('capy_moderator');
    expect(unlocked).toContain('capy_supporter');
    expect(unlocked).toContain('capy_community');
  });

  it('assigns moderator and community badge to moderators', () => {
    const modUser: Partial<User> & { role?: string } = {
      id: 'test-mod-user-id',
      name: 'ModUser',
      role: 'MODERATOR',
    };
    const unlocked = getUserUnlockedBadgeIds(modUser);
    expect(unlocked).not.toContain('capy_founder');
    expect(unlocked).not.toContain('capy_staff');
    expect(unlocked).toContain('capy_moderator');
    expect(unlocked).toContain('capy_community');
  });

  it('restricts common members to community badge and denies privileged badges', () => {
    const commonUser: Partial<User> & { role?: string } = {
      id: 'test-common-member-id',
      name: 'RegularMember',
      role: 'USER',
    };
    const unlocked = getUserUnlockedBadgeIds(commonUser);
    expect(unlocked).toContain('capy_community');
    expect(unlocked).not.toContain('capy_founder');
    expect(unlocked).not.toContain('capy_staff');
    expect(unlocked).not.toContain('capy_moderator');
  });

  it('filters displayed badges according to user preferences safely', () => {
    const unlocked = ['capy_founder', 'capy_staff', 'capy_community'];
    const preferences = ['capy_founder', 'capy_community'];
    const displayed = getDisplayedBadgeIds(unlocked, preferences);
    expect(displayed).toEqual(['capy_founder', 'capy_community']);
  });

  it('strictly prevents a regular user from displaying badges they have not unlocked', () => {
    const unlocked = ['capy_community'];
    // Forged preferences attempting to display founder and staff
    const forgedPreferences = ['capy_founder', 'capy_staff', 'capy_community'];
    const displayed = getDisplayedBadgeIds(unlocked, forgedPreferences);
    expect(displayed).toEqual(['capy_community']);
    expect(displayed).not.toContain('capy_founder');
    expect(displayed).not.toContain('capy_staff');
  });
});
