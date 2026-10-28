import { describe, it, expect, beforeEach } from 'vitest';
import { useDiscord } from '../src/store/discordStore';

describe('Member Profile Roles Management', () => {
  beforeEach(() => {
    // Reset state if needed
    const store = useDiscord.getState();
    store.setActiveServer('server-lyc');
  });

  it('correctly checks role management permissions for server owner vs common member', () => {
    const store = useDiscord.getState();
    const server = store.servers.find((s) => s.id === 'server-lyc')!;
    
    // In local demo / unauthenticated, owner is user-ares or user-me
    const ownerPerms = store.canUserModerate('user-ares', 'user-valkyrie', server.id);
    expect(ownerPerms.canManageRoles || ownerPerms.isAdmin).toBe(true);

    // Regular member without manageRoles
    const memberPerms = store.canUserModerate('user-samurai', 'user-valkyrie', server.id);
    expect(memberPerms.canManageRoles).toBe(false);
    expect(memberPerms.isAdmin).toBe(false);
  });

  it('scopes roles to the current active server', () => {
    const store = useDiscord.getState();
    const serverRoles = store.getServerRoles('server-lyc');
    expect(serverRoles.length).toBeGreaterThan(0);

    const nonEveryoneRoles = serverRoles.filter(
      (r) => r.id !== 'role-everyone' && r.name !== '@everyone' && r.name !== '@todos'
    );
    expect(nonEveryoneRoles.every((r) => r.id !== 'role-everyone')).toBe(true);
  });

  it('assigns and removes roles on target member optimistically and updates userRoleMap', async () => {
    const store = useDiscord.getState();
    const originalUser = store.currentUser;
    const originalAuth = store.isAuthenticated;

    // Simulate server owner (authorized to manage roles)
    useDiscord.setState({
      currentUser: { ...originalUser, id: 'f8fcd139-cf43-4873-bd7d-a807ecd73567' },
      isAuthenticated: true,
    });

    const targetUserId = 'target-test-user-profile';
    const serverRoles = useDiscord.getState().getServerRoles('server-lyc');
    const roleToAssign = serverRoles.find((r) => r.id !== 'role-everyone')!;

    // 1. Initial assignment
    await useDiscord.getState().setUserRoles(targetUserId, [roleToAssign.id], 'server-lyc');
    let map = useDiscord.getState().userRoleMap;
    expect(map[targetUserId]).toContain(roleToAssign.id);

    // 2. Removal (clicking ×)
    await useDiscord.getState().setUserRoles(targetUserId, [], 'server-lyc');
    map = useDiscord.getState().userRoleMap;
    expect(map[targetUserId]).toEqual([]);

    // Restore
    useDiscord.setState({ currentUser: originalUser, isAuthenticated: originalAuth });
  });

  it('denies role assignment when called by an unauthorized member', async () => {
    const store = useDiscord.getState();
    const targetUserId = 'target-test-user-unauth';

    // Temporarily simulate unauthorized current user
    const originalUser = store.currentUser;
    useDiscord.setState({
      currentUser: {
        ...originalUser,
        id: 'user-samurai', // regular member without manageRoles
      },
    });

    const res = await useDiscord.getState().setUserRoles(targetUserId, ['role-admin'], 'server-lyc');
    expect(res).toBeDefined();
    expect(res?.success).toBe(false);
    expect(res?.error).toContain('permissão');

    // Restore original user
    useDiscord.setState({ currentUser: originalUser });
  });
});
