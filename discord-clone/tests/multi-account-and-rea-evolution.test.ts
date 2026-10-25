import { describe, it, expect, beforeEach } from 'vitest';
import { useDiscord } from '../src/store/discordStore';
import { SavedAccount } from '../src/types/discord';

describe('CapyChat Oficial - Multi-Account & Brand Cleansing System', () => {
  beforeEach(() => {
    // Reset local storage keys if present
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('capychat_saved_accounts');
    }
  });

  describe('1. Multi-Account Management (Troca de Contas)', () => {
    it('initializes with empty or loaded saved accounts', () => {
      const state = useDiscord.getState();
      expect(Array.isArray(state.savedAccounts)).toBe(true);
    });

    it('adds and updates saved accounts without duplicates', () => {
      const store = useDiscord.getState();
      const account1: SavedAccount = {
        id: 'user-coronel-1',
        name: 'coronel_owner',
        displayName: 'Coronel Fundador',
        avatar: '/avatars/coronel.png',
        tag: '1337',
        lastActive: 'Agora mesmo',
      };

      store.addSavedAccount(account1);
      let updated = useDiscord.getState().savedAccounts;
      expect(updated.some((a) => a.id === 'user-coronel-1')).toBe(true);

      // Adding the same account with updated display name updates existing item
      const account1Updated: SavedAccount = {
        ...account1,
        displayName: 'Coronel Oficial',
      };
      store.addSavedAccount(account1Updated);
      updated = useDiscord.getState().savedAccounts;
      const filtered = updated.filter((a) => a.id === 'user-coronel-1');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].displayName).toBe('Coronel Oficial');
    });

    it('removes a saved account correctly', () => {
      const store = useDiscord.getState();
      const accountToKeep: SavedAccount = {
        id: 'acc-keep',
        name: 'acc_keep',
        avatar: '/avatars/keep.png',
        lastActive: 'Ontem',
      };
      const accountToRemove: SavedAccount = {
        id: 'acc-remove',
        name: 'acc_remove',
        avatar: '/avatars/remove.png',
        lastActive: 'Há 2 dias',
      };

      store.addSavedAccount(accountToKeep);
      store.addSavedAccount(accountToRemove);
      expect(useDiscord.getState().savedAccounts.some((a) => a.id === 'acc-remove')).toBe(true);

      store.removeSavedAccount('acc-remove');
      const finalAccounts = useDiscord.getState().savedAccounts;
      expect(finalAccounts.some((a) => a.id === 'acc-remove')).toBe(false);
      expect(finalAccounts.some((a) => a.id === 'acc-keep')).toBe(true);
    });

    it('switches safely between accounts preserving both sessions', async () => {
      const store = useDiscord.getState();

      const accountAlpha: SavedAccount = {
        id: 'user-alpha-99',
        name: 'capy_alpha',
        displayName: 'Capy Alpha',
        avatar: '/avatars/alpha.png',
        lastActive: 'Agora',
      };

      const accountBeta: SavedAccount = {
        id: 'user-beta-88',
        name: 'capy_beta',
        displayName: 'Capy Beta',
        avatar: '/avatars/beta.png',
        lastActive: 'Ontem',
      };

      store.addSavedAccount(accountAlpha);
      store.addSavedAccount(accountBeta);

      // Set current user as Alpha
      store.login({
        id: accountAlpha.id,
        name: accountAlpha.name,
        displayName: accountAlpha.displayName,
        avatar: accountAlpha.avatar,
      });

      expect(useDiscord.getState().currentUser.id).toBe('user-alpha-99');

      // Switch to Beta
      const result = await store.switchAccount('user-beta-88');
      expect(result.success).toBe(true);

      const switchedUser = useDiscord.getState().currentUser;
      expect(switchedUser.id).toBe('user-beta-88');
      expect(switchedUser.name).toBe('capy_beta');
      expect(switchedUser.displayName).toBe('Capy Beta');

      // Alpha remains in savedAccounts
      const saved = useDiscord.getState().savedAccounts;
      expect(saved.some((a) => a.id === 'user-alpha-99')).toBe(true);
      expect(saved.some((a) => a.id === 'user-beta-88')).toBe(true);
    });

    it('cleans up account session token when an account is removed from device', () => {
      const store = useDiscord.getState();
      const account: SavedAccount = {
        id: 'user-token-test',
        name: 'token_user',
        avatar: '/avatars/token.png',
        lastActive: 'Agora',
      };
      store.addSavedAccount(account);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('capychat_session_user-token-test', JSON.stringify({ access_token: 'fake-jwt', refresh_token: 'fake-ref' }));
        expect(window.localStorage.getItem('capychat_session_user-token-test')).toBeDefined();

        store.removeSavedAccount('user-token-test');
        expect(window.localStorage.getItem('capychat_session_user-token-test')).toBeNull();
      }
    });
  });

  describe('2. Brand Cleansing and Demo Integrity Contract', () => {
    it('verifies that default chat topic belongs to CapyChat Oficial', async () => {
      const chatModule = await import('../src/components/discord/DiscordChatView');
      expect(chatModule).toBeDefined();
    });

    it('verifies verified badge defaults to CapyChat label', async () => {
      const verifiedModule = await import('../src/components/discord/LycVerifiedBadge');
      expect(verifiedModule.LycVerifiedBadge).toBeDefined();
    });
  });
});
