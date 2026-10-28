import { describe, it, expect, beforeEach } from 'vitest';
import { useDiscord } from '../src/store/discordStore';
import { Role, Server } from '../src/types/discord';

describe('Server Settings Permissions & Access Control', () => {
  const SERVER_A_ID = 'test-server-a';
  const SERVER_B_ID = 'test-server-b';

  const OWNER_USER_ID = 'user-owner-123';
  const ADMIN_USER_ID = 'user-admin-456';
  const ROLE_MANAGER_USER_ID = 'user-role-mgr-789';
  const CHANNEL_MANAGER_USER_ID = 'user-chan-mgr-101';
  const COMMON_MEMBER_USER_ID = 'user-common-999';

  const serverARoles: Role[] = [
    {
      id: 'role-owner-a',
      name: 'Proprietário',
      color: '#f1c40f',
      position: 100,
      base_role: 'OWNER',
      memberCount: 1,
      permissions: {
        administrator: true,
        manageCommunity: true,
        manageRoles: true,
        manageChannels: true,
        kickMembers: true,
        banMembers: true,
        viewChannels: true,
        connectVoice: true,
        streamScreen: true,
      },
    },
    {
      id: 'role-admin-a',
      name: 'Administrador',
      color: '#e91e63',
      position: 90,
      base_role: 'ADMIN',
      memberCount: 1,
      permissions: {
        administrator: true,
        manageCommunity: true,
        manageRoles: true,
        manageChannels: true,
        kickMembers: true,
        banMembers: true,
        viewChannels: true,
        connectVoice: true,
        streamScreen: true,
      },
    },
    {
      id: 'role-mgr-roles-a',
      name: 'Gerente de Cargos',
      color: '#9b59b6',
      position: 60,
      memberCount: 1,
      permissions: {
        administrator: false,
        manageRoles: true,
        manageChannels: false,
        kickMembers: false,
        banMembers: false,
        viewChannels: true,
        connectVoice: true,
        streamScreen: true,
      },
    },
    {
      id: 'role-mgr-channels-a',
      name: 'Gerente de Canais',
      color: '#3498db',
      position: 50,
      memberCount: 1,
      permissions: {
        administrator: false,
        manageRoles: false,
        manageChannels: true,
        kickMembers: false,
        banMembers: false,
        viewChannels: true,
        connectVoice: true,
        streamScreen: true,
      },
    },
    {
      id: 'role-everyone-a',
      name: '@todos',
      color: '#99aab5',
      position: 0,
      isDefault: true,
      base_role: 'MEMBER',
      memberCount: 5,
      permissions: {
        administrator: false,
        manageCommunity: false,
        manageRoles: false,
        manageChannels: false,
        kickMembers: false,
        banMembers: false,
        viewChannels: true,
        sendMessages: true,
        connectVoice: true,
        speak: true,
        streamScreen: true,
        attachFiles: true,
        addReactions: true,
        createInvites: true,
        changeNickname: true,
      },
    },
  ];

  const serverBRoles: Role[] = [
    {
      id: 'role-owner-b',
      name: 'Proprietário',
      color: '#f1c40f',
      position: 100,
      base_role: 'OWNER',
      memberCount: 1,
      permissions: {
        administrator: true,
        manageCommunity: true,
        manageRoles: true,
        manageChannels: true,
        kickMembers: true,
        banMembers: true,
        viewChannels: true,
        connectVoice: true,
        streamScreen: true,
      },
    },
    {
      id: 'role-everyone-b',
      name: '@todos',
      color: '#99aab5',
      position: 0,
      isDefault: true,
      base_role: 'MEMBER',
      memberCount: 2,
      permissions: {
        administrator: false,
        manageCommunity: false,
        manageRoles: false,
        manageChannels: false,
        kickMembers: false,
        banMembers: false,
        viewChannels: true,
        sendMessages: true,
        connectVoice: true,
        streamScreen: false,
      },
    },
  ];

  const serverA: Server = {
    id: SERVER_A_ID,
    name: 'Servidor Teste A',
    initials: 'STA',
    ownerId: OWNER_USER_ID,
    unreadBadge: 0,
    categories: [
      {
        id: 'cat-a-1',
        name: 'GERAL',
        channels: [
          { id: 'ch-a-geral', name: 'geral', type: 'text' },
          { id: 'ch-a-voz', name: 'Voz Geral', type: 'voice' },
        ],
      },
    ],
  };

  const serverB: Server = {
    id: SERVER_B_ID,
    name: 'Servidor Teste B',
    initials: 'STB',
    ownerId: 'user-another-owner',
    unreadBadge: 0,
    categories: [
      {
        id: 'cat-b-1',
        name: 'GERAL',
        channels: [{ id: 'ch-b-geral', name: 'geral', type: 'text' }],
      },
    ],
  };

  beforeEach(() => {
    useDiscord.setState({
      servers: [serverA, serverB],
      activeServerId: SERVER_A_ID,
      isServerSettingsOpen: false,
      serverSettingsTab: 'overview',
      isCreateChannelOpen: false,
      serverRolesMap: {
        [SERVER_A_ID]: serverARoles,
        [SERVER_B_ID]: serverBRoles,
      },
      userRoleMap: {
        [OWNER_USER_ID]: ['role-owner-a'],
        [ADMIN_USER_ID]: ['role-admin-a'],
        [ROLE_MANAGER_USER_ID]: ['role-mgr-roles-a'],
        [CHANNEL_MANAGER_USER_ID]: ['role-mgr-channels-a'],
        [COMMON_MEMBER_USER_ID]: ['role-everyone-a'],
      },
      isAuthenticated: true,
      currentUser: {
        id: COMMON_MEMBER_USER_ID,
        name: 'Common Member',
        displayName: 'Membro Comum',
        avatar: '',
        status: 'online',
        role: 'USER',
        tag: '0000',
      },
    });
  });

  // Scenario 1: Owner opens settings and creates a role (allowed)
  it('Scenario 1: Owner opens settings and creates a role (allowed)', () => {
    useDiscord.setState({
      currentUser: {
        id: OWNER_USER_ID,
        name: 'Owner',
        displayName: 'Dono',
        avatar: '',
        status: 'online',
        role: 'USER',
        tag: '0000',
      },
    });

    const store = useDiscord.getState();
    expect(store.hasServerPermission('manageRoles', SERVER_A_ID)).toBe(true);

    store.openServerSettings('roles');
    expect(useDiscord.getState().isServerSettingsOpen).toBe(true);

    const initialRolesCount = useDiscord.getState().serverRolesMap[SERVER_A_ID].length;
    store.addRole({
      id: 'role-new-by-owner',
      name: 'Cargo Criado Pelo Dono',
      color: '#00ffcc',
      position: 10,
      memberCount: 0,
      permissions: {
        viewChannels: true,
        connectVoice: true,
        streamScreen: false,
        administrator: false,
        manageChannels: false,
        manageRoles: false,
        kickMembers: false,
        banMembers: false,
      },
    });

    const updatedRoles = useDiscord.getState().serverRolesMap[SERVER_A_ID];
    expect(updatedRoles.length).toBe(initialRolesCount + 1);
    expect(updatedRoles.some((r) => r.name === 'Cargo Criado Pelo Dono')).toBe(true);
  });

  // Scenario 2: Authorized Admin opens settings according to permissions (allowed)
  it('Scenario 2: Authorized Admin opens settings according to effective permissions (allowed)', () => {
    useDiscord.setState({
      currentUser: {
        id: ADMIN_USER_ID,
        name: 'Admin',
        displayName: 'Administrador',
        avatar: '',
        status: 'online',
        role: 'USER',
        tag: '0000',
      },
    });

    const store = useDiscord.getState();
    expect(store.hasServerPermission('administrator', SERVER_A_ID)).toBe(true);
    expect(store.hasServerPermission('manageCommunity', SERVER_A_ID)).toBe(true);
    expect(store.hasServerPermission('manageRoles', SERVER_A_ID)).toBe(true);
    expect(store.hasServerPermission('manageChannels', SERVER_A_ID)).toBe(true);

    store.openServerSettings('overview');
    expect(useDiscord.getState().isServerSettingsOpen).toBe(true);
  });

  // Scenario 3: Common member tries to open settings: blocked
  it('Scenario 3: Common member tries to open settings: blocked', () => {
    useDiscord.setState({
      currentUser: {
        id: COMMON_MEMBER_USER_ID,
        name: 'Common Member',
        displayName: 'Membro Comum',
        avatar: '',
        status: 'online',
        role: 'USER',
        tag: '0000',
      },
    });

    const store = useDiscord.getState();
    expect(store.hasServerPermission('administrator', SERVER_A_ID)).toBe(false);
    expect(store.hasServerPermission('manageCommunity', SERVER_A_ID)).toBe(false);
    expect(store.hasServerPermission('manageRoles', SERVER_A_ID)).toBe(false);
    expect(store.hasServerPermission('manageChannels', SERVER_A_ID)).toBe(false);

    store.openServerSettings('overview');
    expect(useDiscord.getState().isServerSettingsOpen).toBe(false);
  });

  // Scenario 4: Common member tries to create a role: blocked in store
  it('Scenario 4: Common member tries to create a role: blocked in store', () => {
    useDiscord.setState({
      currentUser: {
        id: COMMON_MEMBER_USER_ID,
        name: 'Common Member',
        displayName: 'Membro Comum',
        avatar: '',
        status: 'online',
        role: 'USER',
        tag: '0000',
      },
    });

    const store = useDiscord.getState();
    const initialRoles = [...store.serverRolesMap[SERVER_A_ID]];

    store.addRole({
      id: 'role-malicious',
      name: 'Cargo Malicioso',
      color: '#ff0000',
      position: 99,
      memberCount: 0,
      permissions: {
        viewChannels: true,
        connectVoice: true,
        streamScreen: true,
        administrator: true,
        manageChannels: true,
        manageRoles: true,
        kickMembers: true,
        banMembers: true,
      },
    });

    const afterRoles = useDiscord.getState().serverRolesMap[SERVER_A_ID];
    expect(afterRoles.length).toBe(initialRoles.length);
    expect(afterRoles.some((r) => r.name === 'Cargo Malicioso')).toBe(false);
  });

  // Scenario 5: Common member tries to grant administrator to themselves: blocked
  it('Scenario 5: Common member tries to grant administrator to themselves: blocked', async () => {
    useDiscord.setState({
      currentUser: {
        id: COMMON_MEMBER_USER_ID,
        name: 'Common Member',
        displayName: 'Membro Comum',
        avatar: '',
        status: 'online',
        role: 'USER',
        tag: '0000',
      },
    });

    const store = useDiscord.getState();
    const res = (await store.setUserRoles(COMMON_MEMBER_USER_ID, ['role-admin-a'], SERVER_A_ID)) as {
      success: boolean;
      error?: string;
    };
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();

    // Verify user still does not have the admin role
    expect(useDiscord.getState().userRoleMap[COMMON_MEMBER_USER_ID]).not.toContain('role-admin-a');
  });

  // Scenario 6: Common member tries to create a channel directly: blocked
  it('Scenario 6: Common member tries to create a channel directly: blocked', () => {
    useDiscord.setState({
      currentUser: {
        id: COMMON_MEMBER_USER_ID,
        name: 'Common Member',
        displayName: 'Membro Comum',
        avatar: '',
        status: 'online',
        role: 'USER',
        tag: '0000',
      },
    });

    const store = useDiscord.getState();
    store.openCreateChannel();
    expect(useDiscord.getState().isCreateChannelOpen).toBe(false);

    const initialChannelCount = useDiscord
      .getState()
      .servers.find((s) => s.id === SERVER_A_ID)!
      .categories[0].channels.length;

    store.addChannel(SERVER_A_ID, 'cat-a-1', {
      name: 'canal-malicioso',
      type: 'text',
      isPrivate: false,
    });

    const afterChannels = useDiscord
      .getState()
      .servers.find((s) => s.id === SERVER_A_ID)!
      .categories[0].channels;

    expect(afterChannels.length).toBe(initialChannelCount);
    expect(afterChannels.some((c) => c.name === 'canal-malicioso')).toBe(false);
  });

  // Scenario 7: Member with manageRoles but without manageChannels
  it('Scenario 7: Member with manageRoles, but without manageChannels, can manage roles but not channels', () => {
    useDiscord.setState({
      currentUser: {
        id: ROLE_MANAGER_USER_ID,
        name: 'Role Manager',
        displayName: 'Gerente de Cargos',
        avatar: '',
        status: 'online',
        role: 'USER',
        tag: '0000',
      },
    });

    const store = useDiscord.getState();
    expect(store.hasServerPermission('manageRoles', SERVER_A_ID)).toBe(true);
    expect(store.hasServerPermission('manageChannels', SERVER_A_ID)).toBe(false);

    // Can open settings (auto resolves to roles tab)
    store.openServerSettings();
    expect(useDiscord.getState().isServerSettingsOpen).toBe(true);
    expect(useDiscord.getState().serverSettingsTab).toBe('roles');

    // Cannot open create channel or add channel
    store.openCreateChannel();
    expect(useDiscord.getState().isCreateChannelOpen).toBe(false);

    const initialChannelCount = useDiscord
      .getState()
      .servers.find((s) => s.id === SERVER_A_ID)!
      .categories[0].channels.length;

    store.addChannel(SERVER_A_ID, 'cat-a-1', {
      name: 'canal-bloqueado',
      type: 'text',
      isPrivate: false,
    });

    expect(
      useDiscord.getState().servers.find((s) => s.id === SERVER_A_ID)!.categories[0].channels.length
    ).toBe(initialChannelCount);
  });

  // Scenario 8: Member with manageChannels but without manageRoles
  it('Scenario 8: Member with manageChannels, but without manageRoles, can manage channels but not roles', () => {
    useDiscord.setState({
      currentUser: {
        id: CHANNEL_MANAGER_USER_ID,
        name: 'Channel Manager',
        displayName: 'Gerente de Canais',
        avatar: '',
        status: 'online',
        role: 'USER',
        tag: '0000',
      },
    });

    const store = useDiscord.getState();
    expect(store.hasServerPermission('manageChannels', SERVER_A_ID)).toBe(true);
    expect(store.hasServerPermission('manageRoles', SERVER_A_ID)).toBe(false);

    // Can open create channel
    store.openCreateChannel('cat-a-1');
    expect(useDiscord.getState().isCreateChannelOpen).toBe(true);

    // Can add channel
    store.addChannel(SERVER_A_ID, 'cat-a-1', {
      name: 'canal-autorizado',
      type: 'text',
      isPrivate: false,
    });

    const channels = useDiscord
      .getState()
      .servers.find((s) => s.id === SERVER_A_ID)!
      .categories[0].channels;
    expect(channels.some((c) => c.name === 'canal-autorizado')).toBe(true);

    // Cannot create role
    const initialRolesCount = useDiscord.getState().serverRolesMap[SERVER_A_ID].length;
    store.addRole({
      id: 'role-bloqueado',
      name: 'Cargo Bloqueado',
      color: '#123456',
      position: 5,
      memberCount: 0,
      permissions: {
        viewChannels: true,
        connectVoice: true,
        streamScreen: false,
        administrator: false,
        manageChannels: false,
        manageRoles: false,
        kickMembers: false,
        banMembers: false,
      },
    });
    expect(useDiscord.getState().serverRolesMap[SERVER_A_ID].length).toBe(initialRolesCount);
  });

  // Scenario 9: Removing a permission immediately revokes access
  it('Scenario 9: Removing a permission immediately revokes access', () => {
    useDiscord.setState({
      currentUser: {
        id: ROLE_MANAGER_USER_ID,
        name: 'Role Manager',
        displayName: 'Gerente de Cargos',
        avatar: '',
        status: 'online',
        role: 'USER',
        tag: '0000',
      },
    });

    const store = useDiscord.getState();
    expect(store.hasServerPermission('manageRoles', SERVER_A_ID)).toBe(true);

    // Remove role from user
    useDiscord.setState({
      userRoleMap: {
        ...useDiscord.getState().userRoleMap,
        [ROLE_MANAGER_USER_ID]: ['role-everyone-a'],
      },
    });

    expect(store.hasServerPermission('manageRoles', SERVER_A_ID)).toBe(false);

    // Now opening server settings is blocked
    useDiscord.setState({ isServerSettingsOpen: false });
    store.openServerSettings('roles');
    expect(useDiscord.getState().isServerSettingsOpen).toBe(false);
  });

  // Scenario 10: Multi-server scoping (permissions on Server A don't grant permissions on Server B)
  it('Scenario 10: Multi-server scoping (permissions on Server A do not grant permissions on Server B)', () => {
    useDiscord.setState({
      currentUser: {
        id: ADMIN_USER_ID,
        name: 'Admin',
        displayName: 'Administrador',
        avatar: '',
        status: 'online',
        role: 'USER',
        tag: '0000',
      },
    });

    const store = useDiscord.getState();
    // On Server A: User is Admin
    expect(store.hasServerPermission('administrator', SERVER_A_ID)).toBe(true);
    expect(store.hasServerPermission('manageRoles', SERVER_A_ID)).toBe(true);

    // On Server B: User only has @everyone (common member)
    expect(store.hasServerPermission('administrator', SERVER_B_ID)).toBe(false);
    expect(store.hasServerPermission('manageRoles', SERVER_B_ID)).toBe(false);
    expect(store.hasServerPermission('manageChannels', SERVER_B_ID)).toBe(false);
  });

  // Scenario 11: Common member continues chatting, joining voice, sending messages normally
  it('Scenario 11: Common member continues chatting, joining voice, and sending messages normally', () => {
    useDiscord.setState({
      currentUser: {
        id: COMMON_MEMBER_USER_ID,
        name: 'Common Member',
        displayName: 'Membro Comum',
        avatar: '',
        status: 'online',
        role: 'USER',
        tag: '0000',
      },
    });

    const store = useDiscord.getState();
    // Common member has essential communication permissions
    expect(store.hasServerPermission('viewChannels', SERVER_A_ID)).toBe(true);
    expect(store.hasServerPermission('sendMessages', SERVER_A_ID)).toBe(true);
    expect(store.hasServerPermission('connectVoice', SERVER_A_ID)).toBe(true);
    expect(store.hasServerPermission('speak', SERVER_A_ID)).toBe(true);
    expect(store.hasServerPermission('attachFiles', SERVER_A_ID)).toBe(true);
    expect(store.hasServerPermission('addReactions', SERVER_A_ID)).toBe(true);

    // Common member does NOT have administrative permissions
    expect(store.hasServerPermission('administrator', SERVER_A_ID)).toBe(false);
    expect(store.hasServerPermission('manageCommunity', SERVER_A_ID)).toBe(false);
    expect(store.hasServerPermission('manageRoles', SERVER_A_ID)).toBe(false);
    expect(store.hasServerPermission('manageChannels', SERVER_A_ID)).toBe(false);
    expect(store.hasServerPermission('kickMembers', SERVER_A_ID)).toBe(false);
    expect(store.hasServerPermission('banMembers', SERVER_A_ID)).toBe(false);
  });
});
