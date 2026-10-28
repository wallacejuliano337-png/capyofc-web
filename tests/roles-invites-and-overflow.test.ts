import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCapyInviteCode, getCapyInviteUrl, joinByInviteCode, CAPY_OFFICIAL_SLUG } from '../src/lib/invite';
import { useDiscord } from '../src/store/discordStore';

describe('CapyChat — Roles, Invites & Overflow Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Server Invite System', () => {
    it('normalizes official community invite links correctly', () => {
      expect(getCapyInviteUrl('server-lyc')).toBe('https://capy.ofc/invite/capychat-oficial');
      expect(getCapyInviteUrl('capychat-oficial')).toBe('https://capy.ofc/invite/capychat-oficial');
      expect(getCapyInviteUrl('d3f2173f-79f0-4362-b60a-ad079f724b54')).toBe('https://capy.ofc/invite/capychat-oficial');
    });

    it('extracts invite codes from various input formats', () => {
      expect(parseCapyInviteCode('https://capy.ofc/invite/abc-123')).toBe('abc-123');
      expect(parseCapyInviteCode('capychat://invite/my-code')).toBe('my-code');
      expect(parseCapyInviteCode('https://discord.gg/invite/xyz-789')).toBe('xyz-789');
      expect(parseCapyInviteCode('raw-code-here')).toBe('raw-code-here');
      expect(parseCapyInviteCode('https://capy.ofc/invite/capychat-oficial')).toBe('capychat-oficial');
    });

    it('resolves official community slug to server-lyc without backend call', async () => {
      const res = await joinByInviteCode('capychat-oficial');
      expect(res.success).toBe(true);
      expect(res.communityId).toBe('server-lyc');
    });

    it('returns clear error for empty or invalid input', async () => {
      const res = await joinByInviteCode('');
      expect(res.success).toBe(false);
      expect(res.error).toContain('informe um código');
    });
  });

  describe('2. Role Management & Hierarchy', () => {
    it('allows community founders and admins to manage roles', () => {
      const store = useDiscord.getState();
      const perms = store.canUserModerate('f8fcd139-cf43-4873-bd7d-a807ecd73567', 'some-other-user', 'server-lyc');
      expect(perms.canManageRoles).toBe(true);
      expect(perms.isAdmin).toBe(true);
    });

    it('denies role moderation on self or higher roles without ownership', () => {
      const store = useDiscord.getState();
      const perms = store.canUserModerate('user-regular', 'user-regular', 'server-lyc');
      expect(perms.canManageRoles).toBe(false);
      expect(perms.isAdmin).toBe(false);
    });

    it('updates userRoleMap optimistically when setUserRoles is called', async () => {
      const store = useDiscord.getState();
      const originalUser = store.currentUser;
      const originalAuth = store.isAuthenticated;

      // Simulate server owner (authorized to manage roles)
      useDiscord.setState({
        currentUser: { ...originalUser, id: 'f8fcd139-cf43-4873-bd7d-a807ecd73567' },
        isAuthenticated: true,
      });

      const testUserId = 'test-member-target';
      await useDiscord.getState().setUserRoles(testUserId, ['role-admin', 'role-mod'], 'server-lyc');
      
      const updatedMap = useDiscord.getState().userRoleMap;
      expect(updatedMap[testUserId]).toEqual(['role-admin', 'role-mod']);

      // Restore
      useDiscord.setState({ currentUser: originalUser, isAuthenticated: originalAuth });
    });
  });

  describe('3. Text Overflow & Layout Resilience', () => {
    it('ensures long unbroken text is handled by invite parser', () => {
      const longCode = 'a'.repeat(120);
      const parsed = parseCapyInviteCode(`https://capy.ofc/invite/${longCode}`);
      expect(parsed).toBe(longCode);
    });
  });
});
