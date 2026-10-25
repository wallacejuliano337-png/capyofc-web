import { db } from '../lib/supabase';
import type { Server, Role, ChannelCategory } from '../types/discord';

export interface ServerTemplateChannel {
  name: string;
  type: 'text' | 'voice' | 'announcement' | 'forum';
  topic?: string;
  isPrivate?: boolean;
  position?: number;
}

export interface ServerTemplateCategory {
  name: string;
  position: number;
  channels: ServerTemplateChannel[];
}

export interface ServerTemplateRole {
  name: string;
  color: string;
  position: number;
  permissions: {
    viewChannels?: boolean;
    manageChannels?: boolean;
    manageRoles?: boolean;
    kickMembers?: boolean;
    banMembers?: boolean;
    connectVoice?: boolean;
    streamScreen?: boolean;
    administrator?: boolean;
  };
}

export interface ServerTemplateSettings {
  defaultNotification?: 'all' | 'mentions';
  verificationLevel?: 'none' | 'low' | 'medium' | 'high' | 'highest';
  explicitContentFilter?: 'none' | 'noroles' | 'all';
  rules?: string[];
  traits?: string[];
}

export interface ServerTemplateData {
  version: 1;
  id: string; // e.g. "cpt_a1b2c3d4"
  name: string;
  description: string;
  creatorName?: string;
  createdAt: string;
  sourceServerName?: string;
  categories: ServerTemplateCategory[];
  roles: ServerTemplateRole[];
  settings?: ServerTemplateSettings;
}

const TEMPLATES_STORAGE_KEY = 'lyc_server_templates_registry';

/**
 * Sanitizes and generates a template code slug (e.g. "cpt_capychat-oficial-7x9q")
 */
export function generateTemplateCode(serverName: string): string {
  const clean = serverName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `cpt_${clean || 'servidor'}-${randomSuffix}`;
}

/**
 * Exports a server into a clean, sanitized ServerTemplateData structure.
 * Guaranteed to exclude: credentials, tokens, sessions, chat messages, user IDs, webhooks, active invites.
 */
export function exportServerToTemplate(
  server: Server,
  options?: {
    templateId?: string;
    name?: string;
    description?: string;
    creatorName?: string;
    customRoles?: Role[];
  }
): ServerTemplateData {
  const templateName = (options?.name || `${server.name} (Modelo)`).trim();
  const templateDescription = (
    options?.description ||
    server.description ||
    'Modelo oficial de canais, categorias e cargos do CapyChat.'
  ).trim();

  // 1. Sanitize categories and channels
  const categories: ServerTemplateCategory[] = (server.categories || []).map((cat, catIdx) => ({
    name: cat.name.trim() || `Categoria ${catIdx + 1}`,
    position: catIdx,
    channels: (cat.channels || []).map((ch, chIdx) => ({
      name: ch.name.trim().toLowerCase().replace(/\s+/g, '-'),
      type: ch.type || 'text',
      topic: ch.topic ? ch.topic.trim() : undefined,
      isPrivate: Boolean(ch.isPrivate),
      position: chIdx,
    })),
  }));

  // 2. Sanitize custom roles (excluding internal ids and member lists)
  const sourceRoles = options?.customRoles || server.roles || [];
  const roles: ServerTemplateRole[] = sourceRoles
    .filter((r) => r.name.toLowerCase() !== '@everyone' && !r.isDefault)
    .map((r, roleIdx) => ({
      name: r.name.trim(),
      color: r.color || '#99aab5',
      position: typeof r.position === 'number' ? r.position : roleIdx + 1,
      permissions: {
        viewChannels: r.permissions?.viewChannels ?? true,
        manageChannels: Boolean(r.permissions?.manageChannels),
        manageRoles: Boolean(r.permissions?.manageRoles),
        kickMembers: Boolean(r.permissions?.kickMembers),
        banMembers: Boolean(r.permissions?.banMembers),
        connectVoice: r.permissions?.connectVoice ?? true,
        streamScreen: r.permissions?.streamScreen ?? true,
        administrator: Boolean(r.permissions?.administrator),
      },
    }));

  // 3. Safe settings
  const settings: ServerTemplateSettings = {
    defaultNotification: server.defaultNotification || 'mentions',
    verificationLevel: server.verificationLevel || 'low',
    explicitContentFilter: server.explicitContentFilter || 'noroles',
    rules: Array.isArray(server.rules) ? server.rules.map((r) => String(r).trim()).filter(Boolean) : [],
    traits: Array.isArray(server.traits) ? server.traits.map((t) => String(t).trim()).filter(Boolean) : [],
  };

  return {
    version: 1,
    id: options?.templateId || generateTemplateCode(server.name),
    name: templateName,
    description: templateDescription,
    creatorName: options?.creatorName || 'Comunidade CapyChat',
    createdAt: new Date().toISOString(),
    sourceServerName: server.name,
    categories,
    roles,
    settings,
  };
}

/**
 * Validates any object or JSON payload as a compliant ServerTemplateData.
 */
export function validateServerTemplate(data: unknown): {
  valid: boolean;
  errors: string[];
  template?: ServerTemplateData;
} {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['O modelo informado não é um objeto JSON válido.'] };
  }

  const raw = data as Record<string, unknown>;

  if (raw.version !== 1) {
    errors.push('Versão de modelo incompatível. Esperado: version 1.');
  }

  if (typeof raw.name !== 'string' || !raw.name.trim()) {
    errors.push('O nome do modelo é obrigatório e deve ter até 100 caracteres.');
  } else if (raw.name.length > 100) {
    errors.push('O nome do modelo excede o limite de 100 caracteres.');
  }

  if (typeof raw.description !== 'string') {
    errors.push('A descrição do modelo deve ser um texto.');
  } else if (raw.description.length > 500) {
    errors.push('A descrição excede o limite de 500 caracteres.');
  }

  if (!Array.isArray(raw.categories)) {
    errors.push('O modelo precisa conter uma lista válida de categorias.');
  } else if (raw.categories.length > 50) {
    errors.push('O modelo excede o limite de 50 categorias.');
  } else {
    raw.categories.forEach((cat, catIdx) => {
      if (!cat || typeof cat !== 'object') {
        errors.push(`Categoria na posição ${catIdx} é inválida.`);
        return;
      }
      const c = cat as Record<string, unknown>;
      if (typeof c.name !== 'string' || !c.name.trim()) {
        errors.push(`Categoria #${catIdx + 1} não possui nome válido.`);
      }
      if (!Array.isArray(c.channels)) {
        errors.push(`Categoria "${c.name || catIdx}" não possui lista de canais.`);
      } else if (c.channels.length > 100) {
        errors.push(`Categoria "${c.name}" excede o limite de 100 canais.`);
      } else {
        c.channels.forEach((ch, chIdx) => {
          if (!ch || typeof ch !== 'object') {
            errors.push(`Canal #${chIdx} na categoria "${c.name}" é inválido.`);
            return;
          }
          const chObj = ch as Record<string, unknown>;
          if (typeof chObj.name !== 'string' || !chObj.name.trim()) {
            errors.push(`Canal na posição ${chIdx} da categoria "${c.name}" não possui nome válido.`);
          }
          const validTypes = ['text', 'voice', 'announcement', 'forum'];
          if (chObj.type && !validTypes.includes(String(chObj.type))) {
            errors.push(`Tipo de canal "${chObj.type}" não é suportado.`);
          }
        });
      }
    });
  }

  if (raw.roles && !Array.isArray(raw.roles)) {
    errors.push('A lista de cargos do modelo é inválida.');
  } else if (Array.isArray(raw.roles) && raw.roles.length > 50) {
    errors.push('O modelo excede o limite de 50 cargos.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Construct sanitized return
  const template: ServerTemplateData = {
    version: 1,
    id: typeof raw.id === 'string' && raw.id ? raw.id : generateTemplateCode(String(raw.name)),
    name: String(raw.name).trim(),
    description: String(raw.description || '').trim(),
    creatorName: typeof raw.creatorName === 'string' ? raw.creatorName.trim() : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    sourceServerName: typeof raw.sourceServerName === 'string' ? raw.sourceServerName.trim() : undefined,
    categories: (raw.categories as any[]).map((cat, idx) => ({
      name: String(cat.name).trim(),
      position: typeof cat.position === 'number' ? cat.position : idx,
      channels: (cat.channels || []).map((ch: any, chIdx: number) => ({
        name: String(ch.name).trim().toLowerCase().replace(/\s+/g, '-'),
        type: ['text', 'voice', 'announcement', 'forum'].includes(ch.type) ? ch.type : 'text',
        topic: ch.topic ? String(ch.topic).trim() : undefined,
        isPrivate: Boolean(ch.isPrivate),
        position: typeof ch.position === 'number' ? ch.position : chIdx,
      })),
    })),
    roles: Array.isArray(raw.roles)
      ? raw.roles.map((r: any, rIdx: number) => ({
          name: String(r.name).trim(),
          color: typeof r.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(r.color) ? r.color : '#99aab5',
          position: typeof r.position === 'number' ? r.position : rIdx + 1,
          permissions: r.permissions && typeof r.permissions === 'object' ? r.permissions : {},
        }))
      : [],
    settings: raw.settings && typeof raw.settings === 'object' ? (raw.settings as ServerTemplateSettings) : undefined,
  };

  return { valid: true, errors: [], template };
}

/**
 * Extracts a template code from either a full URL or a raw code.
 * E.g. "https://capy.ofc/template/cpt_jogos-123" -> "cpt_jogos-123"
 */
export function parseTemplateCode(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes('/template/')) {
    const parts = trimmed.split('/template/');
    return parts[parts.length - 1].replace(/[^a-zA-Z0-9_-]/g, '');
  }
  return trimmed.replace(/^https?:\/\/[^\/]+\//, '').replace(/[^a-zA-Z0-9_-]/g, '');
}

export interface SaveTemplateResult {
  code: string;
  url: string;
  success: boolean;
  remoteSaved: boolean;
  remoteStatus: 'synced' | 'schema_missing' | 'permission_denied' | 'network_error' | 'not_authenticated';
  error?: string;
  statusMessage: string;
}

/**
 * Saves a template into the local registry and attempts Supabase persistence if connected.
 */
export async function saveServerTemplate(
  template: ServerTemplateData,
  creatorUserId?: string
): Promise<SaveTemplateResult> {
  const validation = validateServerTemplate(template);
  if (!validation.valid || !validation.template) {
    return {
      code: template.id,
      url: `https://capy.ofc/template/${template.id}`,
      success: false,
      remoteSaved: false,
      remoteStatus: 'not_authenticated',
      error: validation.errors.join(' '),
      statusMessage: validation.errors.join(' '),
    };
  }

  const validTemplate = validation.template;

  // 1. Local storage registry cache
  try {
    if (typeof localStorage !== 'undefined') {
      const existingRaw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      const registry: Record<string, ServerTemplateData> = existingRaw ? JSON.parse(existingRaw) : {};
      registry[validTemplate.id] = validTemplate;
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(registry));
    }
  } catch (err) {
    console.warn('[ServerTemplates] Failed to save in localStorage:', err);
  }

  // 2. Database persistence if Supabase is connected
  let remoteSaved = false;
  let remoteStatus: SaveTemplateResult['remoteStatus'] = 'not_authenticated';
  let statusMessage = 'Modelo salvo no cache local.';

  if (creatorUserId) {
    try {
      const supabaseClient = db();
      const { error: dbError } = await supabaseClient.from('server_templates').upsert({
        id: validTemplate.id,
        name: validTemplate.name,
        description: validTemplate.description,
        creator_id: creatorUserId,
        data: validTemplate,
        updated_at: new Date().toISOString(),
      });

      if (!dbError) {
        remoteSaved = true;
        remoteStatus = 'synced';
        statusMessage = 'Modelo publicado com sucesso no Supabase Cloud!';
      } else {
        if (dbError.code === 'PGRST205' || dbError.code === '42P01') {
          remoteStatus = 'schema_missing';
          statusMessage = 'Modelo salvo no cache local (tabela remota server_templates pendente de migração no Supabase Cloud).';
        } else if (dbError.code === '42501') {
          remoteStatus = 'permission_denied';
          statusMessage = 'Permissão negada pelo RLS no Supabase Cloud.';
        } else {
          remoteStatus = 'network_error';
          statusMessage = `Falha de sincronização com Supabase Cloud: ${dbError.message}`;
        }
      }
    } catch (err: any) {
      remoteStatus = 'network_error';
      statusMessage = `Erro de conexão com Supabase: ${err?.message || err}`;
    }
  }

  return {
    code: validTemplate.id,
    url: `https://capy.ofc/template/${validTemplate.id}`,
    success: true,
    remoteSaved,
    remoteStatus,
    statusMessage,
  };
}

/**
 * Retrieves a template by code or URL. Checks Supabase Cloud first for cross-device sharing, then local cache.
 */
export async function fetchServerTemplate(codeOrUrl: string): Promise<ServerTemplateData | null> {
  const code = parseTemplateCode(codeOrUrl);
  if (!code) return null;

  // 1. Check Supabase Cloud first (allows cross-computer and cross-account retrieval)
  try {
    const supabaseClient = db();
    const { data, error } = await supabaseClient
      .from('server_templates')
      .select('data')
      .eq('id', code)
      .maybeSingle();

    if (!error && data && data.data) {
      const validated = validateServerTemplate(data.data);
      if (validated.valid && validated.template) {
        // Cache locally for offline usage
        try {
          if (typeof localStorage !== 'undefined') {
            const existingRaw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
            const registry: Record<string, ServerTemplateData> = existingRaw ? JSON.parse(existingRaw) : {};
            registry[code] = validated.template;
            localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(registry));
          }
        } catch {}
        return validated.template;
      }
    }
  } catch {}

  // 2. Fallback: check local registry
  try {
    if (typeof localStorage !== 'undefined') {
      const existingRaw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (existingRaw) {
        const registry: Record<string, ServerTemplateData> = JSON.parse(existingRaw);
        if (registry[code]) {
          return registry[code];
        }
      }
    }
  } catch {}

  // 3. Fallback: check built-in templates
  const builtIn = getBuiltInTemplates().find((t) => t.id === code);
  if (builtIn) return builtIn;

  return null;
}

/**
 * Returns list of all locally saved templates.
 */
export function listSavedTemplates(): ServerTemplateData[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const existingRaw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (existingRaw) {
        const registry: Record<string, ServerTemplateData> = JSON.parse(existingRaw);
        return Object.values(registry);
      }
    }
  } catch {}
  return [];
}

/**
 * Triggers a browser download of the template as a clean .json file.
 */
export function downloadTemplateAsJson(template: ServerTemplateData): void {
  const jsonStr = JSON.stringify(template, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const filename = `capychat-template-${template.id}.json`;
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Applies a template to build a complete, safe Server data object for creation.
 */
export function buildServerFromTemplate(
  template: ServerTemplateData,
  serverName: string,
  ownerId: string,
  icon?: string
): {
  serverData: Partial<Server>;
  customRoles: Role[];
} {
  const timestamp = Date.now();
  const safeName = serverName.trim() || template.name;
  const initials = safeName
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 3)
    .join('')
    .toUpperCase() || 'SRV';

  // Build categories with fresh unique IDs
  const categories: ChannelCategory[] = template.categories.map((cat, catIdx) => {
    const categoryId = `cat-${timestamp}-${catIdx + 1}`;
    return {
      id: categoryId,
      name: cat.name,
      channels: cat.channels.map((ch, chIdx) => ({
        id: `ch-${timestamp}-${catIdx + 1}-${chIdx + 1}`,
        name: ch.name,
        type: ch.type,
        topic: ch.topic,
        isPrivate: ch.isPrivate,
      })),
    };
  });

  // Ensure there is at least one text channel
  if (categories.length === 0 || !categories[0].channels.length) {
    categories.push({
      id: `cat-${timestamp}-default`,
      name: 'CANAIS DE TEXTO',
      channels: [
        { id: `ch-${timestamp}-geral`, name: 'geral', type: 'text', topic: 'Bate-papo geral do servidor.' },
      ],
    });
  }

  // Build custom roles with fresh unique IDs
  const customRoles: Role[] = template.roles.map((r, rIdx) => ({
    id: `role-${timestamp}-${rIdx + 1}`,
    name: r.name,
    color: r.color,
    position: r.position,
    isDefault: false,
    permissions: {
      viewChannels: r.permissions?.viewChannels ?? true,
      manageChannels: Boolean(r.permissions?.manageChannels),
      manageRoles: Boolean(r.permissions?.manageRoles),
      kickMembers: Boolean(r.permissions?.kickMembers),
      banMembers: Boolean(r.permissions?.banMembers),
      connectVoice: r.permissions?.connectVoice ?? true,
      streamScreen: r.permissions?.streamScreen ?? true,
      administrator: Boolean(r.permissions?.administrator),
    },
  }));

  const serverData: Partial<Server> = {
    id: `server-${timestamp}`,
    name: safeName,
    initials,
    icon: icon || undefined,
    bannerColor: '#5865f2',
    description: template.description || 'Servidor criado a partir de um modelo do CapyChat Oficial.',
    ownerId,
    memberIds: [ownerId],
    memberCount: 1,
    categories,
    defaultNotification: template.settings?.defaultNotification || 'mentions',
    verificationLevel: template.settings?.verificationLevel || 'low',
    explicitContentFilter: template.settings?.explicitContentFilter || 'noroles',
    rules: template.settings?.rules || [],
    traits: template.settings?.traits || [],
  };

  return { serverData, customRoles };
}

/**
 * Built-in standard templates for CapyChat Oficial.
 */
export function getBuiltInTemplates(): ServerTemplateData[] {
  return [
    {
      version: 1,
      id: 'capychat-gaming',
      name: 'Jogos & Comunidade',
      description: 'Ideal para grupos de games, clipes, bate-papo de voz e canais de streaming.',
      creatorName: 'CapyChat Oficial',
      createdAt: '2026-10-23T00:00:00Z',
      categories: [
        {
          name: 'INFORMAÇÕES',
          position: 0,
          channels: [
            { name: 'boas-vindas', type: 'text', topic: 'Apresentações e regras gerais.' },
            { name: 'anuncios', type: 'announcement', topic: 'Notícias e novidades do grupo.' },
          ],
        },
        {
          name: 'TEXTO',
          position: 1,
          channels: [
            { name: 'chat-geral', type: 'text', topic: 'Bate-papo livre sobre tudo.' },
            { name: 'clipes-e-destaques', type: 'text', topic: 'Compartilhe suas melhores jogadas!' },
          ],
        },
        {
          name: 'SALAS DE VOZ',
          position: 2,
          channels: [
            { name: 'Lobby Principal', type: 'voice' },
            { name: 'Duo / Squad 1', type: 'voice' },
            { name: 'Duo / Squad 2', type: 'voice' },
          ],
        },
      ],
      roles: [
        {
          name: 'Moderador',
          color: '#23a55a',
          position: 2,
          permissions: { viewChannels: true, manageChannels: true, kickMembers: true, banMembers: true, connectVoice: true, streamScreen: true },
        },
        {
          name: 'Gamer',
          color: '#5865f2',
          position: 1,
          permissions: { viewChannels: true, connectVoice: true, streamScreen: true },
        },
      ],
    },
    {
      version: 1,
      id: 'capychat-estudos',
      name: 'Estudos & Foco',
      description: 'Perfeito para turmas, grupos de estudo, sessões pomodoro e materiais didáticos.',
      creatorName: 'CapyChat Oficial',
      createdAt: '2026-10-23T00:00:00Z',
      categories: [
        {
          name: 'GERAL',
          position: 0,
          channels: [
            { name: 'regras-e-horarios', type: 'text', topic: 'Horários de sessões e combinados da turma.' },
            { name: 'duvidas-e-perguntas', type: 'text', topic: 'Tire suas dúvidas com os colegas.' },
          ],
        },
        {
          name: 'SALAS DE FOCO',
          position: 1,
          channels: [
            { name: 'Foco Silencioso', type: 'voice' },
            { name: 'Debate em Grupo', type: 'voice' },
          ],
        },
      ],
      roles: [
        {
          name: 'Monitor',
          color: '#f0b232',
          position: 2,
          permissions: { viewChannels: true, manageChannels: true, connectVoice: true, streamScreen: true },
        },
        {
          name: 'Estudante',
          color: '#57f287',
          position: 1,
          permissions: { viewChannels: true, connectVoice: true, streamScreen: true },
        },
      ],
    },
  ];
}
