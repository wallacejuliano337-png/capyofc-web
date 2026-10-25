import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  useDiscord,
  mockServers,
  presenceLeaseCache,
  sweepExpiredPresences,
} from '../src/store/discordStore';
import { fetchCommunityStats, isPresenceOnline } from '../src/services/communities';
import { db, supabase } from '../src/lib/supabase';

describe('Real Community Member & Online Counters - Behavioral Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useDiscord.getState().stopPresenceTracking();
    useDiscord.getState().setActiveServer('server-lyc');
  });

  afterEach(() => {
    useDiscord.getState().stopPresenceTracking();
    vi.restoreAllMocks();
  });

  describe('1. Presence State Behavioral Matrix (isPresenceOnline)', () => {
    const fixedNow = 1774310000000; // Reference timestamp

    it('returns true (online) for online status with valid future expiration', () => {
      const futureDate = new Date(fixedNow + 60000).toISOString();
      const result = isPresenceOnline({ status: 'online', expires_at: futureDate }, fixedNow);
      expect(result).toBe(true);
    });

    it('returns false (offline) for online status with past expiration', () => {
      const pastDate = new Date(fixedNow - 60000).toISOString();
      const result = isPresenceOnline({ status: 'online', expires_at: pastDate }, fixedNow);
      expect(result).toBe(false);
    });

    it('returns false (offline) for online status with null expires_at', () => {
      const result = isPresenceOnline({ status: 'online', expires_at: null }, fixedNow);
      expect(result).toBe(false);
    });

    it('returns false (offline) for online status with invalid date format', () => {
      const result = isPresenceOnline({ status: 'online', expires_at: 'invalid-iso-date' }, fixedNow);
      expect(result).toBe(false);
    });

    it('returns false (offline) for offline status even with future expiration', () => {
      const futureDate = new Date(fixedNow + 60000).toISOString();
      const result = isPresenceOnline({ status: 'offline', expires_at: futureDate }, fixedNow);
      expect(result).toBe(false);
    });

    it('returns false (offline) for null or undefined presence object', () => {
      expect(isPresenceOnline(null, fixedNow)).toBe(false);
      expect(isPresenceOnline(undefined, fixedNow)).toBe(false);
    });
  });

  describe('2. Community Members Query & Stats Isolation', () => {
    it('official server mockServers definition contains authentic counts without fake fallbacks', () => {
      const lycServer = mockServers.find((s) => s.id === 'server-lyc');
      expect(lycServer).toBeDefined();
      expect(lycServer?.memberCount).toBe(7);
      expect(lycServer?.memberCount).not.toBe(1250);
      expect(lycServer?.onlineCount).toBeDefined();
    });

    it('fetchCommunityStats accurately excludes expired presence and left members', async () => {
      const testCommId = 'd3f2173f-79f0-4362-b60a-ad079f724b54';
      const now = Date.now();

      // Mock DB responses
      const mockSelect = vi.fn().mockImplementation((table: string) => {
        if (table === 'community_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({
              data: [
                { user_id: 'u-1' },
                { user_id: 'u-2' },
                { user_id: 'u-3' },
              ],
              count: 3,
              error: null,
            }),
          };
        }
        if (table === 'user_presence') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                // u-1: online with future expiration -> counts as online
                { user_id: 'u-1', status: 'online', expires_at: new Date(now + 120000).toISOString() },
                // u-2: online but expired in the past -> must NOT count as online
                { user_id: 'u-2', status: 'online', expires_at: new Date(now - 120000).toISOString() },
                // u-3: offline with null lease
                { user_id: 'u-3', status: 'offline', expires_at: null },
              ],
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      vi.spyOn(db(), 'from').mockImplementation(mockSelect as any);

      const stats = await fetchCommunityStats(testCommId);
      expect(stats.totalMembers).toBe(3);
      expect(stats.onlineMembers).toBe(1); // Only u-1 is legitimately online
    });

    it('fetchCommunityStats handles Supabase error gracefully without generating fake data', async () => {
      vi.spyOn(db(), 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: null,
          count: null,
          error: { message: 'Database connection failed' },
        }),
      } as any);

      const stats = await fetchCommunityStats('any-id');
      expect(stats.totalMembers).toBe(0);
      expect(stats.onlineMembers).toBe(0);
      expect(stats.totalMembers).not.toBe(1250);
      expect(stats.onlineMembers).not.toBe(225);
    });
  });

  describe('3. Client-Side Lease Sweep (Passive Expiration Without DB Events)', () => {
    it('automatically transitions member from online to offline when lease expires', () => {
      const now = Date.now();
      const memberId = 'user-test-lease-exp';

      // Seed presence lease cache with a lease that expires right now
      presenceLeaseCache.set(memberId, new Date(now - 1000).toISOString());

      useDiscord.setState({
        currentUser: { id: 'cur-user-1', name: 'Coronel', status: 'online', displayName: 'Coronel', tag: '0001', avatar: '' },
        communityMembers: [
          {
            id: memberId,
            name: 'Friend',
            displayName: 'Friend',
            tag: '1234',
            avatar: '',
            status: 'online', // Currently listed as online
          },
        ],
        servers: [
          {
            id: 'server-lyc',
            name: 'CapyChat Oficial',
            initials: 'CC',
            memberCount: 2,
            onlineCount: 2,
            categories: [],
          },
        ],
      });

      // Run sweep
      sweepExpiredPresences('d3f2173f-79f0-4362-b60a-ad079f724b54');

      const updated = useDiscord.getState().communityMembers.find((m) => m.id === memberId);
      expect(updated?.status).toBe('offline');

      const lycSrv = useDiscord.getState().servers.find((s) => s.id === 'server-lyc');
      expect(lycSrv?.onlineCount).toBe(0);
    });

    it('does not alter state when active leases remain valid in the future', () => {
      const now = Date.now();
      const memberId = 'user-valid-future';

      presenceLeaseCache.set(memberId, new Date(now + 120000).toISOString());

      useDiscord.setState({
        currentUser: { id: 'cur-user-1', name: 'Coronel', status: 'online', displayName: 'Coronel', tag: '0001', avatar: '' },
        communityMembers: [
          {
            id: memberId,
            name: 'Friend2',
            displayName: 'Friend2',
            tag: '1234',
            avatar: '',
            status: 'online',
          },
        ],
        servers: [
          {
            id: 'server-lyc',
            name: 'CapyChat Oficial',
            initials: 'CC',
            memberCount: 2,
            onlineCount: 2,
            categories: [],
          },
        ],
      });

      const before = useDiscord.getState().communityMembers;
      sweepExpiredPresences('d3f2173f-79f0-4362-b60a-ad079f724b54');
      const after = useDiscord.getState().communityMembers;

      expect(after[0].status).toBe('online');
      expect(before).toBe(after); // No unnecessary state re-renders
    });
  });

  describe('4. Realtime Subscription Lifecycle and Race Condition Guard', () => {
    it('startPresenceTracking and stopPresenceTracking manage channel and sweep interval cleanly', () => {
      const store = useDiscord.getState();

      const mockRemoveChannel = vi.fn().mockResolvedValue('ok');
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((cb) => {
          if (cb) cb('SUBSCRIBED');
          return mockChannel;
        }),
      };

      vi.spyOn(supabase!, 'channel').mockReturnValue(mockChannel as any);
      vi.spyOn(supabase!, 'removeChannel').mockImplementation(mockRemoveChannel as any);

      store.startPresenceTracking('d3f2173f-79f0-4362-b60a-ad079f724b54');
      expect(supabase?.channel).toHaveBeenCalled();

      // Stopping tracking should unbind channel
      store.stopPresenceTracking();
      expect(mockRemoveChannel).toHaveBeenCalled();
    });

    it('account switch terminates previous tracking listeners', async () => {
      const store = useDiscord.getState();
      const stopSpy = vi.spyOn(store, 'stopPresenceTracking');

      // Add account to saved accounts
      store.addSavedAccount({
        id: 'acc-2',
        name: 'Account B',
        displayName: 'Account B',
        tag: '0002',
        avatar: '',
        lastActive: 'Agora',
      });

      await store.switchAccount('acc-2');
      expect(stopSpy).toHaveBeenCalled();
    });
  });
});
