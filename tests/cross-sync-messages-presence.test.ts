import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveDbChannelId,
  resolveStoreChannelId,
  mapDbMessageToDiscordMessage,
  OFFICIAL_GERAL_CHANNEL_UUID,
  useDiscord,
  sweepExpiredPresences,
  presenceLeaseCache,
} from '../src/store/discordStore';

describe('Capy.ofc — Cross-Platform Message & Presence Synchronization', () => {
  beforeEach(() => {
    presenceLeaseCache.clear();
    useDiscord.setState({
      realtimeOnlineIds: new Set<string>(),
      communityMembers: [],
      messages: {},
    });
  });

  describe('1. Channel ID Resolution & Mapping', () => {
    it('maps official text channel ch-geral to PostgreSQL UUID', () => {
      expect(resolveDbChannelId('ch-geral')).toBe(OFFICIAL_GERAL_CHANNEL_UUID);
      expect(resolveStoreChannelId(OFFICIAL_GERAL_CHANNEL_UUID)).toBe('ch-geral');
    });

    it('preserves native UUIDs for custom server channels', () => {
      const customUuid = '11111111-2222-3333-4444-555555555555';
      expect(resolveDbChannelId(customUuid)).toBe(customUuid);
      expect(resolveStoreChannelId(customUuid)).toBe(customUuid);
    });

    it('returns null for unmapped non-UUID channels', () => {
      expect(resolveDbChannelId('unknown-channel')).toBeNull();
    });
  });

  describe('2. Database Message Mapping', () => {
    it('converts a database row into standard Discord Message with author profile', () => {
      const dbRow = {
        id: 'msg-uuid-123',
        channel_id: OFFICIAL_GERAL_CHANNEL_UUID,
        author_id: 'user-naori-id',
        content: 'Olá Coronel!',
        created_at: '2026-11-02T19:30:00.000Z',
        edited_at: null,
        attachments: [],
        profiles: {
          id: 'user-naori-id',
          username: 'naori',
          display_name: 'Naori',
          avatar_url: 'https://example.com/avatar.png',
          profile_primary_color: '#5865f2',
        },
      };

      const mapped = mapDbMessageToDiscordMessage(dbRow, 'ch-geral');
      expect(mapped.id).toBe('msg-uuid-123');
      expect(mapped.channelId).toBe('ch-geral');
      expect(mapped.content).toBe('Olá Coronel!');
      expect(mapped.author.id).toBe('user-naori-id');
      expect(mapped.author.name).toBe('naori');
      expect(mapped.author.displayName).toBe('Naori');
      expect(mapped.isEdited).toBe(false);
    });
  });

  describe('3. Presence Leases & Online Status Logic', () => {
    it('marks a user online when lease is in the future', () => {
      const userId = 'user-coronel';
      const futureLease = new Date(Date.now() + 60000).toISOString();

      useDiscord.getState().updatePresenceLease(userId, futureLease, 'online');
      expect(useDiscord.getState().realtimeOnlineIds.has(userId)).toBe(true);
    });

    it('does NOT mark a user online if lease is expired (even if status is online)', () => {
      const userId = 'user-expired';
      const pastLease = new Date(Date.now() - 60000).toISOString();

      useDiscord.getState().updatePresenceLease(userId, pastLease, 'online');
      expect(useDiscord.getState().realtimeOnlineIds.has(userId)).toBe(false);
    });

    it('removes user from online status when lease expires during sweep', () => {
      const userId = 'user-leaving';
      const pastLease = new Date(Date.now() - 10000).toISOString();
      presenceLeaseCache.set(userId, pastLease);

      useDiscord.setState({
        currentUser: { id: 'user-me', name: 'Me' } as any,
        realtimeOnlineIds: new Set<string>(), // No longer in realtime presence
        communityMembers: [
          { id: 'user-me', name: 'Me', status: 'online' } as any,
          { id: userId, name: 'LeavingUser', status: 'online' } as any,
        ],
      });

      sweepExpiredPresences('d3f2173f-79f0-4362-b60a-ad079f724b54');

      const updated = useDiscord.getState().communityMembers.find((m) => m.id === userId);
      expect(updated?.status).toBe('offline');
    });
  });
});
