import { describe, it, expect, beforeEach } from 'vitest';
import { useDiscord } from '../src/store/discordStore';

describe('Server Deletion System (Section 4 & 21)', () => {
  beforeEach(() => {
    useDiscord.setState({
      servers: [
        {
          id: 'server-lyc',
          name: 'CapyChat Oficial',
          initials: 'CAPY',
          isVerified: true,
          categories: [
            {
              id: 'cat-lyc',
              name: 'Geral',
              channels: [{ id: 'ch-lyc-geral', name: 'geral', type: 'text' }],
            },
          ],
        },
        {
          id: 'server-user-test',
          name: 'Meu Servidor Pessoal',
          initials: 'MSP',
          ownerId: 'user-owner-123',
          categories: [
            {
              id: 'cat-user',
              name: 'Canais',
              channels: [{ id: 'ch-user-geral', name: 'geral', type: 'text' }],
            },
          ],
        },
        {
          id: 'server-other-user',
          name: 'Servidor de Outro Usuário',
          initials: 'SOU',
          ownerId: 'different-owner-999',
          categories: [],
        },
      ],
      currentUser: {
        id: 'user-owner-123',
        name: 'Coronel',
        tag: '0001',
        avatar: '/assets/avatar-padrao-capychat.png',
        status: 'online',
        role: 'MEMBER',
      },
      activeServerId: 'server-user-test',
      activeChannelId: 'ch-user-geral',
      serverMembersMap: {
        'server-user-test': ['user-owner-123'],
      },
    });
  });

  it('prevents deleting the official CapyChat community server', async () => {
    const { deleteServer, servers } = useDiscord.getState();

    const result = await deleteServer('server-lyc');

    expect(result.success).toBe(false);
    expect(result.error).toContain('protegido e não pode ser excluído');

    // Official server must still be intact
    const currentServers = useDiscord.getState().servers;
    expect(currentServers.some((s) => s.id === 'server-lyc')).toBe(true);
  });

  it('blocks deletion when user is not the owner of the server', async () => {
    const { deleteServer } = useDiscord.getState();

    // Current user is 'user-owner-123', but server belongs to 'different-owner-999'
    const result = await deleteServer('server-other-user');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Apenas o proprietário deste servidor tem autorização');

    // Server must not be deleted
    const currentServers = useDiscord.getState().servers;
    expect(currentServers.some((s) => s.id === 'server-other-user')).toBe(true);
  });

  it('successfully deletes a server when requested by its owner and updates active selection', async () => {
    const { deleteServer } = useDiscord.getState();

    const result = await deleteServer('server-user-test');

    expect(result.success).toBe(true);

    const state = useDiscord.getState();
    // Server must be removed from list
    expect(state.servers.some((s) => s.id === 'server-user-test')).toBe(false);

    // Active server falls back to official community server
    expect(state.activeServerId).toBe('server-lyc');
    expect(state.activeChannelId).toBe('ch-lyc-geral');

    // Other servers remain completely unaffected
    expect(state.servers.some((s) => s.id === 'server-lyc')).toBe(true);
    expect(state.servers.some((s) => s.id === 'server-other-user')).toBe(true);

    // Member associations for the deleted server are cleaned up
    expect(state.serverMembersMap['server-user-test']).toBeUndefined();
  });

  it('preserves global user data, profile and authentication during server deletion', async () => {
    const { deleteServer, currentUser } = useDiscord.getState();

    await deleteServer('server-user-test');

    const state = useDiscord.getState();
    // User profile and auth remain 100% intact
    expect(state.currentUser.id).toBe(currentUser.id);
    expect(state.currentUser.name).toBe('Coronel');
  });
});
