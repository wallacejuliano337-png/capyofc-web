import { describe, it, expect } from 'vitest';
import {
  isOfficialCommunity,
  OFFICIAL_COMMUNITY_ID,
  OFFICIAL_SERVER_ID,
} from '../src/services/communityLevel';
import {
  mockServers,
  reconcileOfficialCategories,
} from '../src/store/discordStore';

describe('Official Community Exclusivity & Channels Structure', () => {
  it('identifies official community strictly by stable IDs', () => {
    // Correct IDs
    expect(isOfficialCommunity(OFFICIAL_SERVER_ID)).toBe(true);
    expect(isOfficialCommunity(OFFICIAL_COMMUNITY_ID)).toBe(true);
    expect(isOfficialCommunity({ id: 'server-lyc' })).toBe(true);
    expect(isOfficialCommunity({ id: 'd3f2173f-79f0-4362-b60a-ad079f724b54' })).toBe(true);

    // Other communities must return false
    expect(isOfficialCommunity('server-testes')).toBe(false);
    expect(isOfficialCommunity('server-sdn')).toBe(false);
    expect(isOfficialCommunity('c944d471-7033-4f93-b6d3-241f893d9b01')).toBe(false);
    expect(isOfficialCommunity({ id: 'other-server' })).toBe(false);
    expect(isOfficialCommunity(null as any)).toBe(false);
    expect(isOfficialCommunity(undefined as any)).toBe(false);
  });

  it('guarantees that ∞ symbol is never granted based solely on display name', () => {
    // Attempt spoofing name
    expect(isOfficialCommunity({ id: 'fake-id', name: 'CapyChat Oficial' } as any)).toBe(false);
    expect(isOfficialCommunity({ id: 'spoof-server', name: 'Capychat Oficial' } as any)).toBe(false);
  });

  it('verifies that CapyChat Oficial contains all required suggestion and announcement channels', () => {
    const officialServer = mockServers.find((s) => s.id === OFFICIAL_SERVER_ID);
    expect(officialServer).toBeDefined();

    const allChannels = officialServer!.categories.flatMap((cat) => cat.channels);
    const channelNames = allChannels.map((c) => c.name);
    const channelIds = allChannels.map((c) => c.id);

    // Required channels
    expect(channelNames).toContain('💬・geral');
    expect(channelNames).toContain('✨・novidades');
    expect(channelNames).toContain('💡・ideias');
    expect(channelNames).toContain('🖼️・molduras');
    expect(channelNames).toContain('🎨・banners');
    expect(channelNames).toContain('🤖・mascotes');

    // Root message channel id must remain 'ch-geral' for backward compatibility
    expect(channelIds).toContain('ch-geral');
    const chGeral = allChannels.find((c) => c.id === 'ch-geral');
    expect(chGeral?.name).toBe('💬・geral');

    // Existing channels must be preserved
    expect(channelIds).toContain('ch-boas-vindas');
    expect(channelIds).toContain('ch-regras');
    expect(channelIds).toContain('ch-anuncios');
    expect(channelIds).toContain('ch-forum-dev');
    expect(channelIds).toContain('ch-clips');
    expect(channelIds).toContain('ch-dev-tech');
    expect(channelIds).toContain('ch-bot-comandos');
    expect(channelIds).toContain('ch-voice-1');
    expect(channelIds).toContain('ch-voice-arena');
    expect(channelIds).toContain('ch-voice-stream');
  });

  it('reconciles categories seamlessly for existing localStorage state', () => {
    const defaultCategories = mockServers[0].categories;
    const legacySavedCategories = [
      {
        id: 'cat-info',
        name: 'INFORMAÇÕES & REGRAS',
        channels: [
          { id: 'ch-boas-vindas', name: 'boas-vindas', type: 'text' as const },
        ],
      },
      {
        id: 'cat-custom',
        name: 'MEUS CANAIS',
        channels: [
          { id: 'ch-custom-1', name: 'privado', type: 'text' as const },
        ],
      },
    ];

    const reconciled = reconcileOfficialCategories(defaultCategories, legacySavedCategories);

    // Preserved custom category
    expect(reconciled.some((c) => c.id === 'cat-custom')).toBe(true);

    // Injected missing official categories and channels
    const allChannels = reconciled.flatMap((c) => c.channels);
    const names = allChannels.map((c) => c.name);
    expect(names).toContain('💬・geral');
    expect(names).toContain('✨・novidades');
    expect(names).toContain('💡・ideias');
    expect(names).toContain('🖼️・molduras');
    expect(names).toContain('🎨・banners');
    expect(names).toContain('🤖・mascotes');
  });
});
