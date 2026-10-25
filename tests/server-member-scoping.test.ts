import { describe, it, expect, beforeEach } from 'vitest';
import { useDiscord, isTestAccount } from '../src/store/discordStore';
import { User, Server } from '../src/types/discord';

describe('Server Member Scoping & Test Account Isolation', () => {
  beforeEach(() => {
    // Reset store state
    useDiscord.setState({
      servers: [
        {
          id: 'server-lyc',
          name: 'CapyChat Oficial',
          initials: 'CAPY',
          categories: [],
          memberCount: 1250,
        },
      ],
      activeServerId: 'server-lyc',
      serverMembersMap: {},
      communityMembers: [
        {
          id: 'real-user-1',
          name: 'Coronel',
          displayName: 'Coronel',
          tag: '0001',
          avatar: '/assets/avatar-padrao-capychat.png',
          status: 'online',
          role: 'OWNER',
        },
        {
          id: 'real-user-2',
          name: 'Kirito',
          displayName: 'Kirito',
          tag: '0002',
          avatar: '/assets/avatar-padrao-capychat.png',
          status: 'online',
        },
        {
          id: 'test-user-1',
          name: 'Capy Tester 148167',
          displayName: 'Capy Tester 148167',
          tag: '1481',
          avatar: '/assets/avatar-padrao-capychat.png',
          status: 'online',
        },
        {
          id: 'test-user-2',
          name: 'Capy Updated Name',
          displayName: 'Capy Updated Name',
          tag: '1482',
          avatar: '/assets/avatar-padrao-capychat.png',
          status: 'online',
        },
        {
          id: 'test-user-3',
          name: 'Capy Amigo Alpha 632854',
          displayName: 'Capy Amigo Alpha 632854',
          tag: '1483',
          avatar: '/assets/avatar-padrao-capychat.png',
          status: 'online',
        },
        {
          id: 'test-user-4',
          name: 'Capy Amigo Beta 632854',
          displayName: 'Capy Amigo Beta 632854',
          tag: '1484',
          avatar: '/assets/avatar-padrao-capychat.png',
          status: 'online',
        },
        {
          id: 'test-user-5',
          name: 'Capy Amigo 56403',
          displayName: 'Capy Amigo 56403',
          tag: '1485',
          avatar: '/assets/avatar-padrao-capychat.png',
          status: 'online',
        },
      ],
      currentUser: {
        id: 'real-user-1',
        name: 'Coronel',
        displayName: 'Coronel',
        tag: '0001',
        avatar: '/assets/avatar-padrao-capychat.png',
        status: 'online',
        role: 'OWNER',
      },
    });
  });

  it('accurately identifies and flags test accounts while preserving authentic accounts', () => {
    // Test accounts must be detected
    expect(isTestAccount({ name: 'Capy Tester 148167', displayName: 'Capy Tester 148167' })).toBe(true);
    expect(isTestAccount({ name: 'Capy Updated Name', displayName: 'Capy Updated Name' })).toBe(true);
    expect(isTestAccount({ name: 'Capy Amigo Alpha 632854', displayName: 'Capy Amigo Alpha 632854' })).toBe(true);
    expect(isTestAccount({ name: 'Capy Amigo Beta 632854', displayName: 'Capy Amigo Beta 632854' })).toBe(true);
    expect(isTestAccount({ name: 'Capy Amigo 56403', displayName: 'Capy Amigo 56403' })).toBe(true);
    expect(isTestAccount({ name: 'Capy Amigo', displayName: 'Capy Amigo' })).toBe(true);

    // Legitimate users must NOT be flagged
    expect(isTestAccount({ name: 'Coronel', displayName: 'Coronel' })).toBe(false);
    expect(isTestAccount({ name: 'Kirito', displayName: 'Kirito' })).toBe(false);
    expect(isTestAccount({ name: 'Everton', displayName: 'Everton' })).toBe(false);
    expect(isTestAccount({ name: 'HERMAN BETA', displayName: 'HERMAN BETA' })).toBe(false);
  });

  it('filters out test accounts from the official community server members list', () => {
    const { getServerMembers } = useDiscord.getState();
    const members = getServerMembers('server-lyc');

    // Only authentic members should be present
    const names = members.map((m) => m.name);
    expect(names).toContain('Coronel');
    expect(names).toContain('Kirito');

    // None of the test accounts should appear
    expect(names).not.toContain('Capy Tester 148167');
    expect(names).not.toContain('Capy Updated Name');
    expect(names).not.toContain('Capy Amigo Alpha 632854');
    expect(names).not.toContain('Capy Amigo Beta 632854');
    expect(names).not.toContain('Capy Amigo 56403');
  });

  it('creates a new server containing initially ONLY the owner who created it', () => {
    const { addServer, getServerMembers } = useDiscord.getState();

    addServer({
      id: 'server-custom-coronel',
      name: 'Servidor de Coronel',
    });

    const newServerMembers = getServerMembers('server-custom-coronel');

    // Must have exactly 1 member: Coronel (the creator/owner)
    expect(newServerMembers.length).toBe(1);
    expect(newServerMembers[0].name).toBe('Coronel');
    expect(newServerMembers[0].id).toBe('real-user-1');

    // Test accounts must NOT exist in the new server
    const names = newServerMembers.map((m) => m.name);
    expect(names).not.toContain('Capy Tester 148167');
    expect(names).not.toContain('Capy Updated Name');
    expect(names).not.toContain('Capy Amigo Alpha 632854');
    expect(names).not.toContain('Kirito'); // other users don't belong here unless invited
  });

  it('switches between servers without leaking member list or cache', () => {
    const { addServer, getServerMembers, setActiveServer } = useDiscord.getState();

    addServer({
      id: 'server-new-1',
      name: 'Meu Novo Servidor',
    });

    // 1. In new server: only 1 member
    setActiveServer('server-new-1');
    const membersInNew = getServerMembers('server-new-1');
    expect(membersInNew.length).toBe(1);
    expect(membersInNew[0].name).toBe('Coronel');

    // 2. Switch back to official: shows official members
    setActiveServer('server-lyc');
    const membersInOfficial = getServerMembers('server-lyc');
    expect(membersInOfficial.length).toBe(2); // Coronel and Kirito
    expect(membersInOfficial.map((m) => m.name)).toEqual(['Coronel', 'Kirito']);

    // 3. Switch back to new: still strictly 1 member
    setActiveServer('server-new-1');
    const membersInNewAgain = getServerMembers('server-new-1');
    expect(membersInNewAgain.length).toBe(1);
    expect(membersInNewAgain[0].name).toBe('Coronel');
  });

  it('allows adding a member explicitly via addServerMember without affecting other servers', () => {
    const { addServer, addServerMember, getServerMembers } = useDiscord.getState();

    addServer({
      id: 'server-shared',
      name: 'Servidor Compartilhado',
    });

    // Add Kirito explicitly to server-shared
    addServerMember('server-shared', 'real-user-2');

    const membersShared = getServerMembers('server-shared');
    expect(membersShared.length).toBe(2);
    expect(membersShared.map((m) => m.name)).toContain('Coronel');
    expect(membersShared.map((m) => m.name)).toContain('Kirito');

    // Another new server remains with only its creator
    addServer({
      id: 'server-isolated',
      name: 'Servidor Isolado',
    });
    const isolatedMembers = getServerMembers('server-isolated');
    expect(isolatedMembers.length).toBe(1);
    expect(isolatedMembers[0].name).toBe('Coronel');
  });
});
