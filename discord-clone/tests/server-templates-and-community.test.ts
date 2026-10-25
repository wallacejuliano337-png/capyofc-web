import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  exportServerToTemplate,
  validateServerTemplate,
  generateTemplateCode,
  parseTemplateCode,
  buildServerFromTemplate,
  ServerTemplateData,
} from '../src/services/server-templates';
import { useDiscord, loadInitialServers } from '../src/store/discordStore';
import type { Server, Role } from '../src/types/discord';

describe('CapyChat Oficial — Modelos de Servidor e Habilitação de Comunidade', () => {
  const dummyServer: Server = {
    id: 'server-custom-alpha',
    name: 'Comunidade Gamer Pro',
    initials: 'CGP',
    description: 'Servidor oficial para competições e amizade.',
    ownerId: 'owner-user-123',
    memberIds: ['owner-user-123', 'member-456'],
    memberCount: 2,
    categories: [
      {
        id: 'cat-1',
        name: 'INFORMAÇÕES',
        channels: [
          { id: 'ch-1', name: 'regras', type: 'text', topic: 'Diretrizes do servidor' },
          { id: 'ch-2', name: 'avisos', type: 'announcement', topic: 'Notícias oficiais' },
        ],
      },
      {
        id: 'cat-2',
        name: 'VOZ & JOGOS',
        channels: [
          { id: 'ch-3', name: 'Geral [Voz]', type: 'voice' },
          { id: 'ch-4', name: 'Squad 1', type: 'voice' },
        ],
      },
    ],
    roles: [
      {
        id: 'role-everyone',
        name: '@everyone',
        color: '#99aab5',
        position: 0,
        permissions: {
          viewChannels: true,
          manageChannels: false,
          manageRoles: false,
          kickMembers: false,
          banMembers: false,
          connectVoice: true,
          streamScreen: true,
          administrator: false,
        },
        isDefault: true,
      },
      {
        id: 'role-vip',
        name: 'Competidor VIP',
        color: '#5865f2',
        position: 1,
        permissions: {
          viewChannels: true,
          manageChannels: false,
          manageRoles: false,
          kickMembers: false,
          banMembers: false,
          connectVoice: true,
          streamScreen: true,
          administrator: false,
        },
      },
    ],
    defaultNotification: 'mentions',
    verificationLevel: 'medium',
    explicitContentFilter: 'noroles',
    rules: ['Respeite todos os membros', 'Sem spam'],
    traits: ['Gaming', 'Competitivo'],
  };

  beforeEach(() => {
    // Reset test storage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('1. Exportação e Higienização de Modelos de Servidor', () => {
    it('exporta a estrutura correta preservando categorias, canais, cargos e configurações', () => {
      const template = exportServerToTemplate(dummyServer, {
        name: 'Modelo Gamer Pro',
        description: 'Modelo de servidor de games',
        creatorName: 'Ares_Admin',
      });

      expect(template.version).toBe(1);
      expect(template.name).toBe('Modelo Gamer Pro');
      expect(template.description).toBe('Modelo de servidor de games');
      expect(template.creatorName).toBe('Ares_Admin');
      expect(template.categories.length).toBe(2);

      // Category 1
      expect(template.categories[0].name).toBe('INFORMAÇÕES');
      expect(template.categories[0].channels.length).toBe(2);
      expect(template.categories[0].channels[0].name).toBe('regras');
      expect(template.categories[0].channels[0].type).toBe('text');
      expect(template.categories[0].channels[1].name).toBe('avisos');
      expect(template.categories[0].channels[1].type).toBe('announcement');

      // Category 2
      expect(template.categories[1].name).toBe('VOZ & JOGOS');
      expect(template.categories[1].channels.length).toBe(2);
      expect(template.categories[1].channels[0].type).toBe('voice');

      // Custom Roles (excludes @everyone)
      expect(template.roles.length).toBe(1);
      expect(template.roles[0].name).toBe('Competidor VIP');
      expect(template.roles[0].color).toBe('#5865f2');

      // Safe settings
      expect(template.settings?.verificationLevel).toBe('medium');
      expect(template.settings?.rules).toEqual(['Respeite todos os membros', 'Sem spam']);
    });

    it('higieniza estritamente e NÃO inclui tokens, senhas, mensagens ou dados pessoais de membros', () => {
      const template = exportServerToTemplate(dummyServer);
      const jsonString = JSON.stringify(template);

      // Verify no sensitive keys exist
      expect(jsonString).not.toContain('password');
      expect(jsonString).not.toContain('token');
      expect(jsonString).not.toContain('secret');
      expect(jsonString).not.toContain('owner-user-123');
      expect(jsonString).not.toContain('member-456');
      expect(jsonString).not.toContain('server-custom-alpha');
      expect((template as any).memberIds).toBeUndefined();
      expect((template as any).messages).toBeUndefined();
      expect((template as any).invites).toBeUndefined();
      expect((template as any).webhooks).toBeUndefined();
    });
  });

  describe('2. Validação e Rejeição de Modelos', () => {
    it('aprova modelo válido e retorna objeto tipado', () => {
      const validPayload: ServerTemplateData = {
        version: 1,
        id: 'cpt_valido-123',
        name: 'Modelo de Comunidade Válido',
        description: 'Descrição de teste',
        createdAt: new Date().toISOString(),
        categories: [
          {
            name: 'Geral',
            position: 0,
            channels: [{ name: 'chat', type: 'text' }],
          },
        ],
        roles: [{ name: 'Membro', color: '#5865f2', position: 1, permissions: { viewChannels: true } }],
      };

      const result = validateServerTemplate(validPayload);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.template?.name).toBe('Modelo de Comunidade Válido');
    });

    it('rejeita payloads inválidos, malformados ou com versão incompatível', () => {
      expect(validateServerTemplate(null).valid).toBe(false);
      expect(validateServerTemplate('string').valid).toBe(false);

      const invalidVersion = { version: 2, name: 'Nome', categories: [] };
      const resVer = validateServerTemplate(invalidVersion);
      expect(resVer.valid).toBe(false);
      expect(resVer.errors.some((e) => e.includes('Versão'))).toBe(true);

      const emptyName = { version: 1, name: '   ', categories: [] };
      const resName = validateServerTemplate(emptyName);
      expect(resName.valid).toBe(false);
      expect(resName.errors.some((e) => e.includes('nome'))).toBe(true);

      const invalidChannelType = {
        version: 1,
        name: 'Nome',
        categories: [
          {
            name: 'Cat',
            channels: [{ name: 'canal', type: 'tipo_desconhecido' }],
          },
        ],
      };
      const resType = validateServerTemplate(invalidChannelType);
      expect(resType.valid).toBe(false);
      expect(resType.errors.some((e) => e.includes('não é suportado'))).toBe(true);
    });
  });

  describe('3. Geração e Resolução de Códigos e URLs de Modelos', () => {
    it('gera código limpo e seguro a partir do nome', () => {
      const code = generateTemplateCode('CapyChat Servidor Oficial!');
      expect(code).toMatch(/^cpt_capychat-servidor-[a-z0-9-]+$/);
    });

    it('extrai corretamente o código de URLs completas ou slugs diretos', () => {
      expect(parseTemplateCode('https://capy.ofc/template/cpt_jogos-7x9q')).toBe('cpt_jogos-7x9q');
      expect(parseTemplateCode('http://localhost:5173/template/meu-modelo')).toBe('meu-modelo');
      expect(parseTemplateCode('cpt_estudos-123')).toBe('cpt_estudos-123');
    });
  });

  describe('4. Construção e Importação de Servidor a partir de Modelo', () => {
    it('gera IDs únicos e mantém ordem de categorias, canais e cargos', () => {
      const template = exportServerToTemplate(dummyServer, { name: 'Template Base' });
      const { serverData, customRoles } = buildServerFromTemplate(
        template,
        'Novo Servidor Importado',
        'novo-usuario-789',
        'https://imagem.com/icon.png'
      );

      expect(serverData.name).toBe('Novo Servidor Importado');
      expect(serverData.ownerId).toBe('novo-usuario-789');
      expect(serverData.icon).toBe('https://imagem.com/icon.png');
      expect(serverData.categories?.length).toBe(2);

      // Verify new IDs are generated and not equal to old dummy IDs
      expect(serverData.categories?.[0].id).not.toBe('cat-1');
      expect(serverData.categories?.[0].channels[0].id).not.toBe('ch-1');
      expect(serverData.categories?.[0].channels[0].name).toBe('regras');
      expect(serverData.categories?.[0].channels[1].name).toBe('avisos');

      // Verify custom roles
      expect(customRoles.length).toBe(1);
      expect(customRoles[0].name).toBe('Competidor VIP');
      expect(customRoles[0].id).not.toBe('role-vip');
    });
  });

  describe('5. Habilitação de Comunidade e Idempotência', () => {
    it('cria canais automáticos #regras e #avisos e ativa isCommunity de forma idempotente', async () => {
      const store = useDiscord.getState();

      // Create a clean server with only standard channels
      const testServerId = `server-test-${Date.now()}`;
      store.addServer({
        id: testServerId,
        name: 'Servidor Limpo para Teste',
        ownerId: store.currentUser.id,
        categories: [
          {
            id: 'cat-main',
            name: 'GERAL',
            channels: [{ id: 'ch-chat', name: 'chat-geral', type: 'text' }],
          },
        ],
      });

      // 1. First enablement: should create #regras and #avisos
      const res1 = await store.enableCommunity(testServerId);
      expect(res1.success).toBe(true);
      expect(res1.createdChannels).toContain('#regras');
      expect(res1.createdChannels).toContain('#avisos');

      const serverAfter1 = useDiscord.getState().servers.find((s) => s.id === testServerId);
      expect(serverAfter1?.isCommunity).toBe(true);
      expect(serverAfter1?.rulesChannelId).toBeDefined();
      expect(serverAfter1?.publicUpdatesChannelId).toBeDefined();

      const allChs1 = serverAfter1?.categories.flatMap((c) => c.channels) || [];
      const regrasChs1 = allChs1.filter((c) => c.name === 'regras');
      const avisosChs1 = allChs1.filter((c) => c.name === 'avisos');
      expect(regrasChs1.length).toBe(1);
      expect(avisosChs1.length).toBe(1);

      // 2. Second enablement (Idempotency check): MUST NOT create duplicates!
      const res2 = await useDiscord.getState().enableCommunity(testServerId);
      expect(res2.success).toBe(true);
      expect(res2.createdChannels?.length).toBe(0); // None newly created

      const serverAfter2 = useDiscord.getState().servers.find((s) => s.id === testServerId);
      const allChs2 = serverAfter2?.categories.flatMap((c) => c.channels) || [];
      const regrasChs2 = allChs2.filter((c) => c.name === 'regras');
      const avisosChs2 = allChs2.filter((c) => c.name === 'avisos');
      expect(regrasChs2.length).toBe(1); // Still exactly 1
      expect(avisosChs2.length).toBe(1); // Still exactly 1

      // 3. Disable community
      const resDisable = await useDiscord.getState().disableCommunity(testServerId);
      expect(resDisable.success).toBe(true);
      const serverDisabled = useDiscord.getState().servers.find((s) => s.id === testServerId);
      expect(serverDisabled?.isCommunity).toBe(false);

      // Clean up server
      await useDiscord.getState().deleteServer(testServerId);
    });

    it('bloqueia ativação por usuário não autorizado', async () => {
      const store = useDiscord.getState();

      const testServerId = `server-locked-${Date.now()}`;
      store.addServer({
        id: testServerId,
        name: 'Servidor de Outro Dono',
        ownerId: 'outro-dono-uuid', // Not current user
        categories: [
          {
            id: 'cat-locked',
            name: 'GERAL',
            channels: [{ id: 'ch-lock', name: 'geral', type: 'text' }],
          },
        ],
      });

      // Temporarily mock currentUser to regular member
      const originalUser = store.currentUser;
      useDiscord.setState({
        currentUser: {
          ...originalUser,
          id: 'random-stranger-id',
          role: 'MEMBER',
        },
      });

      const res = await useDiscord.getState().enableCommunity(testServerId);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Apenas o proprietário ou administradores');

      // Restore user and clean up
      useDiscord.setState({ currentUser: originalUser });
      await useDiscord.getState().deleteServer(testServerId);
    });

    it('registra evento de auditoria ao habilitar a comunidade', async () => {
      const store = useDiscord.getState();
      const testServerId = `server-audit-${Date.now()}`;
      store.addServer({
        id: testServerId,
        name: 'Servidor com Auditoria',
        ownerId: store.currentUser.id,
        categories: [
          {
            id: 'cat-aud',
            name: 'GERAL',
            channels: [{ id: 'ch-aud', name: 'geral', type: 'text' }],
          },
        ],
      });

      await store.enableCommunity(testServerId);
      const logs = store.getAuditLogs(testServerId);
      const communityLog = logs.find(
        (l) => l.action?.includes('Comunidade Oficial') || l.actionType === 'community_update'
      );
      expect(communityLog).toBeDefined();

      await store.deleteServer(testServerId);
    });

    it('persiste a configuração de comunidade e preserva canais vinculados', async () => {
      const store = useDiscord.getState();
      const testServerId = `server-persist-${Date.now()}`;
      store.addServer({
        id: testServerId,
        name: 'Servidor Persistente',
        ownerId: store.currentUser.id,
        categories: [
          {
            id: 'cat-persist',
            name: 'GERAL',
            channels: [{ id: 'ch-p', name: 'geral', type: 'text' }],
          },
        ],
      });

      const res = await store.enableCommunity(testServerId);
      expect(res.success).toBe(true);

      const activeServer = useDiscord.getState().servers.find((s) => s.id === testServerId);
      expect(activeServer).toBeDefined();
      expect(activeServer?.isCommunity).toBe(true);
      expect(activeServer?.rulesChannelId).toBeDefined();
      expect(activeServer?.publicUpdatesChannelId).toBeDefined();

      const allChs = activeServer?.categories.flatMap((c) => c.channels) || [];
      expect(allChs.some((c) => c.id === activeServer?.rulesChannelId)).toBe(true);
      expect(allChs.some((c) => c.id === activeServer?.publicUpdatesChannelId)).toBe(true);

      await store.deleteServer(testServerId);
    });

    it('desativação de comunidade não apaga canais nem histórico sem autorização explícita', async () => {
      const store = useDiscord.getState();
      const testServerId = `server-safe-disable-${Date.now()}`;
      store.addServer({
        id: testServerId,
        name: 'Servidor Seguro',
        ownerId: store.currentUser.id,
        categories: [
          {
            id: 'cat-safe',
            name: 'GERAL',
            channels: [{ id: 'ch-safe', name: 'geral', type: 'text' }],
          },
        ],
      });

      await store.enableCommunity(testServerId);
      const serverActive = useDiscord.getState().servers.find((s) => s.id === testServerId);
      const channelCountBefore = serverActive?.categories.flatMap((c) => c.channels).length || 0;

      // Desativar comunidade
      const disableRes = await store.disableCommunity(testServerId);
      expect(disableRes.success).toBe(true);

      const serverDisabled = useDiscord.getState().servers.find((s) => s.id === testServerId);
      expect(serverDisabled?.isCommunity).toBe(false);

      // Canais devem permanecer intactos (não são deletados)
      const channelCountAfter = serverDisabled?.categories.flatMap((c) => c.channels).length || 0;
      expect(channelCountAfter).toBe(channelCountBefore);

      await store.deleteServer(testServerId);
    });
  });
});
