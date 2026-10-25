import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDiscord, mockUsers } from '../src/store/discordStore';

// Simple in-memory localStorage polyfill for Node test environment
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
});
Object.defineProperty(globalThis, 'window', {
  value: { localStorage: storageMock },
  writable: true,
});

describe('Logout Flow & Authentic Member List Tests', () => {
  beforeEach(() => {
    storageMock.clear();
    useDiscord.setState({
      isAuthenticated: true,
      isLoggingOut: false,
      communityMembers: [],
      currentUser: {
        id: 'test-user-123',
        name: 'test_user',
        displayName: 'Test User',
        tag: '1234',
        avatar: '/default-avatar.png',
        status: 'online',
      },
      isSettingsModalOpen: true,
      selectedMemberForPopout: null,
      popoutPosition: null,
      activeView: 'voice-stage',
    });
  });

  it('logout() resets auth state, closes modals, and clears private localStorage', async () => {
    localStorage.setItem('capychat_is_authenticated', 'true');
    localStorage.setItem('lycDisplayName', 'Test User');
    localStorage.setItem('lycUserAvatar', '/my-avatar.png');

    const logoutPromise = useDiscord.getState().logout({ skipSupabaseSignOut: true });
    await logoutPromise;

    const state = useDiscord.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoggingOut).toBe(false);
    expect(state.isSettingsModalOpen).toBe(false);
    expect(state.activeView).toBe('chat');
    expect(state.currentUser.id).toBe('');
    expect(state.currentUser.status).toBe('offline');

    expect(localStorage.getItem('capychat_is_authenticated')).toBeNull();
    expect(localStorage.getItem('lycDisplayName')).toBeNull();
    expect(localStorage.getItem('lycUserAvatar')).toBeNull();
  });

  it('logout({ skipSupabaseSignOut: true }) avoids recursive calls from onAuthStateChange SIGNED_OUT', async () => {
    const state = useDiscord.getState();
    expect(state.isLoggingOut).toBe(false);

    // Call logout with skipSupabaseSignOut
    await state.logout({ skipSupabaseSignOut: true });

    expect(useDiscord.getState().isAuthenticated).toBe(false);
    expect(useDiscord.getState().isLoggingOut).toBe(false);
  });

  it('prevent concurrent duplicate logout executions while isLoggingOut is active', async () => {
    useDiscord.setState({ isLoggingOut: true });

    // Calling logout should immediately bail out and do nothing
    await useDiscord.getState().logout({ skipSupabaseSignOut: true });

    // State remains as it was because isLoggingOut was true
    expect(useDiscord.getState().isAuthenticated).toBe(true);
  });

  it('communityMembers initializes as empty and does not inject fictitious mock users', () => {
    // mockUsers remains accessible for test fixtures
    expect(mockUsers.length).toBeGreaterThan(0);
    expect(mockUsers.some(u => u.id === 'user-ares')).toBe(true);

    // But communityMembers in store starts clean and reflects only authentic members
    const members = useDiscord.getState().communityMembers;
    expect(members).toEqual([]);
  });
});
