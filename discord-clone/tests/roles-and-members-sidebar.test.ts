import { describe, it, expect, beforeEach } from 'vitest';
import { useDiscord } from '../src/store/discordStore';
import { Role, RolePermissions } from '../src/types/discord';

describe('Sistema Completo de Cargos e Lista de Membros', () => {
  const mockServerId = 'server-test-hierarchy-99';

  const mockRoles: Role[] = [
    {
      id: 'role-owner',
      name: 'Proprietário',
      color: '#f1c40f',
      position: 100,
      base_role: 'OWNER',
      permissions: {
        administrator: true,
        viewChannels: true,
        manageChannels: true,
        manageRoles: true,
        kickMembers: true,
        banMembers: true,
        connectVoice: true,
        streamScreen: true,
        sendMessages: true,
      },
    },
    {
      id: 'role-admin',
      name: 'Administrador',
      color: '#e91e63',
      position: 90,
      base_role: 'ADMIN',
      permissions: {
        administrator: true,
        viewChannels: true,
        manageChannels: true,
        manageRoles: true,
        kickMembers: true,
        banMembers: true,
        connectVoice: true,
        streamScreen: true,
        sendMessages: true,
      },
    },
    {
      id: 'role-mod',
      name: 'Moderador',
      color: '#2ecc71',
      position: 50,
      base_role: 'MODERATOR',
      permissions: {
        administrator: false,
        viewChannels: true,
        manageChannels: false,
        manageRoles: false,
        kickMembers: true,
        banMembers: false,
        connectVoice: true,
        streamScreen: true,
        sendMessages: true,
        timeoutMembers: true,
        manageMessages: true,
      },
    },
    {
      id: 'role-vip',
      name: 'VIP Especial',
      color: '#9b59b6',
      position: 30,
      permissions: {
        administrator: false,
        viewChannels: true,
        manageChannels: false,
        manageRoles: false,
        kickMembers: false,
        banMembers: false,
        connectVoice: true,
        streamScreen: true,
        sendMessages: true,
        attachFiles: true,
      },
    },
    {
      id: 'role-everyone',
      name: '@todos',
      color: '#99aab5',
      position: 0,
      isDefault: true,
      permissions: {
        administrator: false,
        viewChannels: true,
        manageChannels: false,
        manageRoles: false,
        kickMembers: false,
        banMembers: false,
        connectVoice: true,
        streamScreen: true,
        sendMessages: true,
        attachFiles: true,
        addReactions: true,
        createInvites: true,
      },
    },
  ];

  beforeEach(() => {
    useDiscord.setState({
      currentUser: {
        id: 'user-owner-1',
        name: 'owner_user',
        displayName: 'Server Owner',
        avatar: '/avatar.png',
        status: 'online',
        role: 'OWNER',
        badges: [],
        tag: '@owner',
        joinedDate: '01/01/2026',
      },
      servers: [
        {
          id: mockServerId,
          name: 'Servidor Teste Hierarquia',
          initials: 'STH',
          ownerId: 'user-owner-1',
          icon: '',
          categories: [
            {
              id: 'cat-1',
              name: 'GERAL',
              channels: [
                { id: 'ch-1', name: 'geral', type: 'text' },
                { id: 'ch-voice', name: 'Voz Geral', type: 'voice' },
              ],
            },
          ],
        },
      ],
      activeServerId: mockServerId,
      serverRolesMap: {
        [mockServerId]: [...mockRoles],
      },
      roles: [...mockRoles],
      userRoleMap: {
        'user-owner-1': ['role-owner'],
        'user-admin-2': ['role-admin', 'role-vip'],
        'user-mod-3': ['role-mod', 'role-vip'],
        'user-vip-4': ['role-vip'],
        'user-common-5': [],
      },
    });
  });

  it('1. Membro com múltiplos cargos é agrupado pelo seu cargo mais alto (sem duplicidade)', () => {
    const store = useDiscord.getState();
    const sortedRoles = [...store.serverRolesMap[mockServerId]]
      .filter((r) => r.id !== 'role-everyone')
      .sort((a, b) => (b.position ?? 0) - (a.position ?? 0));

    // user-admin-2 has ['role-admin', 'role-vip']
    // Highest role is role-admin (pos 90 > pos 30)
    const userRoleIds = store.userRoleMap['user-admin-2'];
    const highestRole = sortedRoles.find((r) => userRoleIds.includes(r.id));

    expect(highestRole).toBeDefined();
    expect(highestRole?.id).toBe('role-admin');
    expect(highestRole?.name).toBe('Administrador');
  });

  it('2. Membro sem cargo personalizado não é associado a nenhum cargo superior', () => {
    const store = useDiscord.getState();
    const sortedRoles = [...store.serverRolesMap[mockServerId]]
      .filter((r) => r.id !== 'role-everyone')
      .sort((a, b) => (b.position ?? 0) - (a.position ?? 0));

    const userRoleIds = store.userRoleMap['user-common-5'];
    const highestRole = sortedRoles.find((r) => userRoleIds.includes(r.id));

    // Should be null / undefined, going into the default 'Membros' group
    expect(highestRole).toBeUndefined();
  });

  it('3. Atualização dinâmica dos grupos após atribuir e remover cargo', async () => {
    const store = useDiscord.getState();

    // Assign 'role-mod' to user-common-5
    const resAdd = await store.setUserRoles('user-common-5', ['role-mod'], mockServerId);
    expect(resAdd).toEqual({ success: true });
    expect(useDiscord.getState().userRoleMap['user-common-5']).toContain('role-mod');

    // Remove role from user-common-5
    const resRem = await store.setUserRoles('user-common-5', [], mockServerId);
    expect(resRem).toEqual({ success: true });
    expect(useDiscord.getState().userRoleMap['user-common-5']).toHaveLength(0);
  });

  it('4. Proteção de hierarquia e moderação (canUserModerate)', () => {
    const store = useDiscord.getState();

    // Owner can moderate admin and mod
    const ownerPerms = store.canUserModerate('user-owner-1', 'user-admin-2', mockServerId);
    expect(ownerPerms.canKick).toBe(true);
    expect(ownerPerms.canBan).toBe(true);
    expect(ownerPerms.canManageRoles).toBe(true);

    // Mod (pos 50) CANNOT kick or ban Admin (pos 90)
    const modPermsAgainstAdmin = store.canUserModerate('user-mod-3', 'user-admin-2', mockServerId);
    expect(modPermsAgainstAdmin.canKick).toBe(false);
    expect(modPermsAgainstAdmin.canBan).toBe(false);

    // Mod (pos 50) CAN kick VIP (pos 30) because mod has kickMembers and higher hierarchy
    const modPermsAgainstVip = store.canUserModerate('user-mod-3', 'user-vip-4', mockServerId);
    expect(modPermsAgainstVip.canKick).toBe(true);
    expect(modPermsAgainstVip.canBan).toBe(false); // Mod doesn't have banMembers
  });

  it('5. Verificação de permissões granulares com hasServerPermission', () => {
    const store = useDiscord.getState();

    // Owner has all permissions
    expect(store.hasServerPermission('manageChannels', mockServerId)).toBe(true);
    expect(store.hasServerPermission('administrator', mockServerId)).toBe(true);
    expect(store.hasServerPermission('sendMessages', mockServerId)).toBe(true);

    // Switch current user to common member
    useDiscord.setState({
      currentUser: {
        id: 'user-common-5',
        name: 'common_user',
        displayName: 'Membro Comum',
        avatar: '/avatar.png',
        status: 'online',
        role: 'MEMBER',
        badges: [],
        tag: '@membro',
        joinedDate: '01/01/2026',
      },
    });

    const storeMember = useDiscord.getState();
    // Common member has basic permissions from @todos / default
    expect(storeMember.hasServerPermission('sendMessages', mockServerId)).toBe(true);
    expect(storeMember.hasServerPermission('connectVoice', mockServerId)).toBe(true);
    expect(storeMember.hasServerPermission('attachFiles', mockServerId)).toBe(true);

    // Common member does NOT have admin permissions
    expect(storeMember.hasServerPermission('administrator', mockServerId)).toBe(false);
    expect(storeMember.hasServerPermission('manageChannels', mockServerId)).toBe(false);
    expect(storeMember.hasServerPermission('manageRoles', mockServerId)).toBe(false);
    expect(storeMember.hasServerPermission('kickMembers', mockServerId)).toBe(false);
  });

  it('6. Salvamento de novas permissões granulares no cargo (updateRole)', async () => {
    const store = useDiscord.getState();

    // Update VIP role to enable video and timeoutMembers
    await store.updateRole('role-vip', {
      permissions: {
        ...mockRoles[3].permissions,
        video: true,
        timeoutMembers: true,
      },
    });

    const updatedRoles = useDiscord.getState().serverRolesMap[mockServerId];
    const updatedVip = updatedRoles.find((r) => r.id === 'role-vip');
    expect(updatedVip?.permissions.video).toBe(true);
    expect(updatedVip?.permissions.timeoutMembers).toBe(true);
  });
});
