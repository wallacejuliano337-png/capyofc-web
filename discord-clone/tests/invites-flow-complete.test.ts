import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseCapyInviteCode,
  getCapyInviteUrl,
  joinByInviteCode,
  extractInviteCodes,
  isInviteUrlOrCode,
  getInvitePreview,
  CAPY_OFFICIAL_SLUG,
} from '../src/lib/invite';
import { useDiscord } from '../src/store/discordStore';

describe('CapyChat — Complete Invites System & Link Acceptance', () => {
  const mockServerId = 'server-test-invite-123';

  beforeEach(() => {
    vi.clearAllMocks();

    useDiscord.setState({
      currentUser: {
        id: 'user-tester-id',
        name: 'tester',
        displayName: 'Capy Tester',
        avatar: '/avatar.png',
        status: 'online',
        role: 'MEMBER',
        badges: [],
        tag: '@tester',
        joinedDate: '01/01/2026',
      },
      servers: [
        {
          id: mockServerId,
          name: 'Comunidade Teste Convites',
          initials: 'CTC',
          ownerId: 'user-owner-999',
          icon: '/server-icon.png',
          memberCount: 42,
          onlineCount: 15,
          boostCount: 337,
          categories: [
            {
              id: 'cat-test-1',
              name: 'GERAL',
              channels: [
                { id: 'ch-test-geral', name: 'chat-geral', type: 'text' },
                { id: 'ch-test-privado', name: 'sala-secreta', type: 'text', isPrivate: true },
              ],
            },
          ],
        },
      ],
      activeServerId: mockServerId,
      activeChannelId: 'ch-test-geral',
      messages: {},
    });
  });

  describe('1. Parsing & Extraction of Invite Links', () => {
    it('recognizes various official and discord.gg invite link formats', () => {
      expect(parseCapyInviteCode('https://discord.gg/uMvgrNC2X')).toBe('uMvgrNC2X');
      expect(parseCapyInviteCode('http://discord.gg/uMvgrNC2X')).toBe('uMvgrNC2X');
      expect(parseCapyInviteCode('https://capy.ofc/invite/uMvgrNC2X')).toBe('uMvgrNC2X');
      expect(parseCapyInviteCode('capychat://invite/custom-slug')).toBe('custom-slug');
      expect(parseCapyInviteCode('raw-token-abc')).toBe('raw-token-abc');
    });

    it('identifies whether an input is an invite link or code', () => {
      expect(isInviteUrlOrCode('https://discord.gg/uMvgrNC2X')).toBe(true);
      expect(isInviteUrlOrCode('https://capy.ofc/invite/my-community')).toBe(true);
      expect(isInviteUrlOrCode('capychat://invite/xyz')).toBe(true);
      expect(isInviteUrlOrCode('capychat-oficial')).toBe(true);
      expect(isInviteUrlOrCode('https://google.com')).toBe(false);
      expect(isInviteUrlOrCode('apenas uma mensagem comum')).toBe(false);
    });

    it('extracts invite codes from arbitrary chat text without duplicates', () => {
      const chatText = `Olá pessoal, entrem no meu servidor: https://discord.gg/uMvgrNC2X ou pelo link https://capy.ofc/invite/capychat-oficial e repito https://discord.gg/uMvgrNC2X!`;
      const extracted = extractInviteCodes(chatText);

      expect(extracted).toHaveLength(2);
      expect(extracted[0].code).toBe('uMvgrNC2X');
      expect(extracted[0].rawUrl).toBe('https://discord.gg/uMvgrNC2X');
      expect(extracted[1].code).toBe('capychat-oficial');
      expect(extracted[1].rawUrl).toBe('https://capy.ofc/invite/capychat-oficial');
    });

    it('does not crash or extract invalid tokens from regular text', () => {
      expect(extractInviteCodes('')).toEqual([]);
      expect(extractInviteCodes('olá tudo bem? nada de links aqui.')).toEqual([]);
    });
  });

  describe('2. Invite Previews (Rich Embed Data)', () => {
    it('generates accurate preview for official community', async () => {
      const preview = await getInvitePreview('capychat-oficial');
      expect(preview.status).toBe('valid');
      expect(preview.is_official).toBe(true);
      expect(preview.is_already_member).toBe(true);
      expect(preview.member_count).toBeGreaterThan(0);
    });

    it('generates accurate preview for local community with membership status', async () => {
      const preview = await getInvitePreview(mockServerId, 'user-tester-id');
      expect(preview.status).toBe('valid');
      expect(preview.community_name).toBe('Comunidade Teste Convites');
      expect(preview.boost_count).toBe(337);
      expect(preview.member_count).toBe(42);
      expect(preview.online_count).toBe(15);
      expect(preview.is_already_member).toBe(true);
    });

    it('returns invalid status for empty or malformed invite code', async () => {
      const preview = await getInvitePreview('');
      expect(preview.status).toBe('invalid');
      expect(preview.error).toBeTruthy();
    });
  });

  describe('3. Permission Checking for Creating Invites', () => {
    it('allows invite creation for server owners or users with createInvites permission', () => {
      const store = useDiscord.getState();
      expect(store.hasServerPermission('createInvites', mockServerId)).toBe(true);
    });

    it('normalizes invite URL using standard format', () => {
      const url = getCapyInviteUrl('abc-token');
      expect(url).toBe('https://capy.ofc/invite/abc-token');
    });
  });

  describe('4. Safe Join Flow & State Updates', () => {
    it('immediately opens server if user is already a member', async () => {
      const store = useDiscord.getState();
      const res = await joinByInviteCode(mockServerId);

      expect(res.success).toBe(true);
      expect(res.communityId).toBe(mockServerId);

      const joinResult = await store.joinCommunityServer(mockServerId);
      expect(joinResult.success).toBe(true);
      expect(useDiscord.getState().activeServerId).toBe(mockServerId);
    });

    it('redirects to server-lyc when joining official CapyChat', async () => {
      const res = await joinByInviteCode('capychat-oficial');
      expect(res.success).toBe(true);
      expect(res.communityId).toBe('server-lyc');
    });
  });

  describe('5. Messaging & DM Invite Delivery', () => {
    it('sends invite message to friend DM correctly', () => {
      const store = useDiscord.getState();
      const targetFriendId = 'friend-capy-88';
      const dmChannelId = `dm-${targetFriendId}`;
      const inviteUrl = getCapyInviteUrl('uMvgrNC2X');

      store.sendMessage(dmChannelId, `Venha participar: ${inviteUrl}`);

      const dmMessages = useDiscord.getState().messages[dmChannelId];
      expect(dmMessages).toHaveLength(1);
      expect(dmMessages[0].content).toContain(inviteUrl);
      expect(extractInviteCodes(dmMessages[0].content)[0].code).toBe('uMvgrNC2X');
    });
  });
});
