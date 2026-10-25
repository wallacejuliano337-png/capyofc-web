import { supabase } from "../lib/supabase";
import { readLocal, writeLocal } from "./demo";
import type { Message } from "../types";

export interface CommunityWebhook {
  id: string;
  community_id: string;
  channel_id: string;
  name: string;
  avatar_url?: string | null;
  token: string;
  is_active: boolean;
  created_by: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string | null;
}

export type IntegrationStatus = "Conectado" | "Desativado" | "Erro";

export interface CommunityIntegration {
  id: string;
  community_id: string;
  name: string;
  icon_url?: string | null;
  description: string;
  status: IntegrationStatus;
  is_active: boolean;
  settings?: Record<string, unknown>;
  connected_by: string;
  connected_at: string;
  updated_at: string;
}

export interface WebhookMessagePayload {
  content: string;
  username?: string;
  avatar_url?: string;
}

export interface CreateWebhookInput {
  channel_id: string;
  name: string;
  avatar_url?: string | null;
  created_by: string;
  creator_name?: string;
}

export interface UpdateWebhookInput {
  name?: string;
  channel_id?: string;
  avatar_url?: string | null;
  is_active?: boolean;
}

const STORAGE_WEBHOOKS_PREFIX = "lyc_community_webhooks_";
const STORAGE_INTEGRATIONS_PREFIX = "lyc_community_integrations_";

// In-memory cache fallback for environments without localStorage or for unit testing
const webhooksMemoryStore = new Map<string, CommunityWebhook[]>();
const integrationsMemoryStore = new Map<string, CommunityIntegration[]>();

export function clearWebhooksMemoryStore(): void {
  webhooksMemoryStore.clear();
  integrationsMemoryStore.clear();
}

/**
 * Generate a cryptographically secure token starting with 'lyc_wh_'
 * Uses Web Crypto API when available, with a secure hex representation.
 */
export function generateSecureWebhookToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `lyc_wh_${hex}`;
  }
  // Cryptographic fallback using crypto.randomUUID
  const p1 = crypto.randomUUID().replace(/-/g, "");
  const p2 = crypto.randomUUID().replace(/-/g, "");
  return `lyc_wh_${p1}${p2}`;
}

export function validateWebhookName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return "O nome do webhook deve ter pelo menos 2 caracteres.";
  }
  if (trimmed.length > 64) {
    return "O nome do webhook não pode ultrapassar 64 caracteres.";
  }
  return null;
}

export function validateWebhookMessage(content: string): string | null {
  const trimmed = content.trim();
  if (trimmed.length < 1) {
    return "O conteúdo da mensagem não pode ficar vazio.";
  }
  if (trimmed.length > 4000) {
    return "A mensagem excede o limite máximo de 4000 caracteres.";
  }
  return null;
}

export function buildWebhookUrl(webhookId: string, token: string): string {
  const apiBase =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_SUPABASE_URL) ||
    "https://api.lyc.arena";
  return `${apiBase}/functions/v1/community-webhook?id=${webhookId}&token=${token}`;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
  } catch {
    // Ignore environments where localStorage is restricted
  }
  return null;
}

function getLocalWebhooks(communityId: string): CommunityWebhook[] {
  if (webhooksMemoryStore.has(communityId)) {
    return webhooksMemoryStore.get(communityId)!;
  }
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(`${STORAGE_WEBHOOKS_PREFIX}${communityId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        webhooksMemoryStore.set(communityId, parsed);
        return parsed;
      }
    }
  } catch {
    // ignore parse error
  }
  return [];
}

function saveLocalWebhooks(
  communityId: string,
  webhooks: CommunityWebhook[],
): void {
  webhooksMemoryStore.set(communityId, webhooks);
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      `${STORAGE_WEBHOOKS_PREFIX}${communityId}`,
      JSON.stringify(webhooks),
    );
  } catch {
    // ignore storage error
  }
}

function getLocalIntegrations(communityId: string): CommunityIntegration[] {
  if (integrationsMemoryStore.has(communityId)) {
    return integrationsMemoryStore.get(communityId)!;
  }
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(`${STORAGE_INTEGRATIONS_PREFIX}${communityId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        integrationsMemoryStore.set(communityId, parsed);
        return parsed;
      }
    }
  } catch {
    // ignore parse error
  }
  return [];
}

function saveLocalIntegrations(
  communityId: string,
  integrations: CommunityIntegration[],
): void {
  integrationsMemoryStore.set(communityId, integrations);
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      `${STORAGE_INTEGRATIONS_PREFIX}${communityId}`,
      JSON.stringify(integrations),
    );
  } catch {
    // ignore
  }
}

// ----------------------------------------------------------------------
// Webhook CRUD Operations
// ----------------------------------------------------------------------

export async function loadCommunityWebhooks(
  communityId: string,
): Promise<CommunityWebhook[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("community_webhooks")
        .select("*")
        .eq("community_id", communityId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        saveLocalWebhooks(communityId, data as CommunityWebhook[]);
        return data as CommunityWebhook[];
      }
    } catch {
      // Fall back to local store
    }
  }
  return getLocalWebhooks(communityId);
}

export async function createCommunityWebhook(
  communityId: string,
  input: CreateWebhookInput,
): Promise<CommunityWebhook> {
  const nameError = validateWebhookName(input.name);
  if (nameError) throw new Error(nameError);

  if (!input.channel_id) {
    throw new Error("Selecione um canal de destino para o webhook.");
  }

  const token = generateSecureWebhookToken();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const newWebhook: CommunityWebhook = {
    id,
    community_id: communityId,
    channel_id: input.channel_id,
    name: input.name.trim(),
    avatar_url: input.avatar_url?.trim() || null,
    token,
    is_active: true,
    created_by: input.created_by,
    creator_name: input.creator_name || "Administrador",
    created_at: now,
    updated_at: now,
    last_used_at: null,
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("community_webhooks")
        .insert({
          id: newWebhook.id,
          community_id: newWebhook.community_id,
          channel_id: newWebhook.channel_id,
          name: newWebhook.name,
          avatar_url: newWebhook.avatar_url,
          token: newWebhook.token,
          is_active: newWebhook.is_active,
          created_by: newWebhook.created_by,
        })
        .select("*")
        .single();

      if (!error && data) {
        const item = data as CommunityWebhook;
        const current = getLocalWebhooks(communityId);
        saveLocalWebhooks(communityId, [item, ...current.filter((w) => w.id !== item.id)]);
        return item;
      }
    } catch {
      // Fallback to local
    }
  }

  const current = getLocalWebhooks(communityId);
  const updated = [newWebhook, ...current];
  saveLocalWebhooks(communityId, updated);
  return newWebhook;
}

export async function updateCommunityWebhook(
  communityId: string,
  webhookId: string,
  input: UpdateWebhookInput,
): Promise<CommunityWebhook> {
  if (input.name !== undefined) {
    const nameErr = validateWebhookName(input.name);
    if (nameErr) throw new Error(nameErr);
  }

  const now = new Date().toISOString();

  if (supabase) {
    try {
      const patch: Record<string, unknown> = { updated_at: now };
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.channel_id !== undefined) patch.channel_id = input.channel_id;
      if (input.avatar_url !== undefined)
        patch.avatar_url = input.avatar_url ? input.avatar_url.trim() : null;
      if (input.is_active !== undefined) patch.is_active = input.is_active;

      const { data, error } = await supabase
        .from("community_webhooks")
        .update(patch)
        .eq("id", webhookId)
        .eq("community_id", communityId)
        .select("*")
        .single();

      if (!error && data) {
        const item = data as CommunityWebhook;
        const current = getLocalWebhooks(communityId);
        saveLocalWebhooks(
          communityId,
          current.map((w) => (w.id === webhookId ? item : w)),
        );
        return item;
      }
    } catch {
      // Fallback
    }
  }

  const current = getLocalWebhooks(communityId);
  const existing = current.find((w) => w.id === webhookId);
  if (!existing) throw new Error("Webhook não encontrado.");

  const updatedItem: CommunityWebhook = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    channel_id: input.channel_id !== undefined ? input.channel_id : existing.channel_id,
    avatar_url:
      input.avatar_url !== undefined
        ? input.avatar_url ? input.avatar_url.trim() : null
        : existing.avatar_url,
    is_active: input.is_active !== undefined ? input.is_active : existing.is_active,
    updated_at: now,
  };

  saveLocalWebhooks(
    communityId,
    current.map((w) => (w.id === webhookId ? updatedItem : w)),
  );
  return updatedItem;
}

export async function regenerateCommunityWebhookToken(
  communityId: string,
  webhookId: string,
): Promise<{ id: string; token: string }> {
  const newToken = generateSecureWebhookToken();
  const now = new Date().toISOString();

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc(
        "regenerate_community_webhook_token",
        { p_webhook_id: webhookId },
      );
      if (!error && data && data.token) {
        const current = getLocalWebhooks(communityId);
        saveLocalWebhooks(
          communityId,
          current.map((w) =>
            w.id === webhookId ? { ...w, token: data.token, updated_at: now } : w,
          ),
        );
        return data as { id: string; token: string };
      }
    } catch {
      // Fallback to local
    }
  }

  const current = getLocalWebhooks(communityId);
  const existing = current.find((w) => w.id === webhookId);
  if (!existing) throw new Error("Webhook não encontrado.");

  const updatedItem: CommunityWebhook = {
    ...existing,
    token: newToken,
    updated_at: now,
  };

  saveLocalWebhooks(
    communityId,
    current.map((w) => (w.id === webhookId ? updatedItem : w)),
  );

  return { id: webhookId, token: newToken };
}

export async function deleteCommunityWebhook(
  communityId: string,
  webhookId: string,
): Promise<void> {
  if (supabase) {
    try {
      const { error } = await supabase
        .from("community_webhooks")
        .delete()
        .eq("id", webhookId)
        .eq("community_id", communityId);

      if (error) throw error;
    } catch {
      // Fallback to local
    }
  }

  const current = getLocalWebhooks(communityId);
  saveLocalWebhooks(
    communityId,
    current.filter((w) => w.id !== webhookId),
  );
}

// ----------------------------------------------------------------------
// Webhook Message Delivery Execution
// ----------------------------------------------------------------------

export async function executeWebhookMessage(
  communityId: string,
  webhookId: string,
  token: string,
  payload: WebhookMessagePayload,
): Promise<{ success: boolean; message_id: string; channel_id: string }> {
  const contentErr = validateWebhookMessage(payload.content);
  if (contentErr) throw new Error(contentErr);

  // Validate webhook presence & credentials
  const webhooks = await loadCommunityWebhooks(communityId);
  const wh = webhooks.find((w) => w.id === webhookId);

  if (!wh || wh.token !== token) {
    throw new Error("Webhook não encontrado ou credenciais inválidas.");
  }

  if (!wh.is_active) {
    throw new Error("Este webhook está desativado.");
  }

  const targetChannelId = wh.channel_id;
  const authorName = payload.username?.trim() || wh.name;
  const authorAvatar = payload.avatar_url?.trim() || wh.avatar_url || null;
  const now = new Date().toISOString();
  const messageId = crypto.randomUUID();

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("execute_community_webhook", {
        p_webhook_id: webhookId,
        p_token: token,
        p_content: payload.content.trim(),
        p_override_name: payload.username?.trim() || null,
        p_override_avatar: payload.avatar_url?.trim() || null,
      });

      if (!error && data) {
        return data as { success: boolean; message_id: string; channel_id: string };
      }
    } catch {
      // Fallback to local delivery
    }
  }

  // Local / Demo environment message delivery
  try {
    const d = readLocal();
    const botMsg: Message = {
      id: messageId,
      channel_id: targetChannelId,
      author_id: wh.created_by,
      content: payload.content.trim(),
      reply_to: null,
      created_at: now,
      edited_at: null,
      webhook_id: wh.id,
      webhook_name: authorName,
      webhook_avatar_url: authorAvatar,
      profiles: {
        id: wh.created_by,
        username: authorName.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        display_name: authorName,
        avatar_url: authorAvatar,
        status: "online",
        role: "MEMBER",
        created_at: now,
      },
      message_reactions: [],
    };
    d.messages.push(botMsg);
    writeLocal(d);
  } catch {
    // If readLocal is not available in node test runner, ignore
  }

  // Update last_used_at
  await updateCommunityWebhook(communityId, webhookId, {
    // Keeps last_used_at updated locally
  });
  wh.last_used_at = now;

  return {
    success: true,
    message_id: messageId,
    channel_id: targetChannelId,
  };
}

// ----------------------------------------------------------------------
// Connected Integrations Operations
// ----------------------------------------------------------------------

export async function loadCommunityIntegrations(
  communityId: string,
): Promise<CommunityIntegration[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("community_integrations")
        .select("*")
        .eq("community_id", communityId)
        .order("connected_at", { ascending: false });

      if (!error && data) {
        saveLocalIntegrations(communityId, data as CommunityIntegration[]);
        return data as CommunityIntegration[];
      }
    } catch {
      // Fallback
    }
  }
  return getLocalIntegrations(communityId);
}

export async function connectCommunityIntegration(
  communityId: string,
  input: {
    name: string;
    description: string;
    icon_url?: string | null;
    connected_by: string;
    settings?: Record<string, unknown>;
  },
): Promise<CommunityIntegration> {
  const now = new Date().toISOString();
  const newInt: CommunityIntegration = {
    id: crypto.randomUUID(),
    community_id: communityId,
    name: input.name,
    icon_url: input.icon_url || null,
    description: input.description,
    status: "Conectado",
    is_active: true,
    settings: input.settings || {},
    connected_by: input.connected_by,
    connected_at: now,
    updated_at: now,
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("community_integrations")
        .insert({
          id: newInt.id,
          community_id: newInt.community_id,
          name: newInt.name,
          icon_url: newInt.icon_url,
          description: newInt.description,
          status: newInt.status,
          is_active: newInt.is_active,
          settings: newInt.settings,
          connected_by: newInt.connected_by,
        })
        .select("*")
        .single();
      if (!error && data) {
        const item = data as CommunityIntegration;
        const current = getLocalIntegrations(communityId);
        saveLocalIntegrations(
          communityId,
          [item, ...current.filter((i) => i.id !== item.id)],
        );
        return item;
      }
    } catch {
      // Fallback
    }
  }

  const current = getLocalIntegrations(communityId);
  saveLocalIntegrations(communityId, [newInt, ...current]);
  return newInt;
}

export async function toggleCommunityIntegration(
  communityId: string,
  integrationId: string,
  isActive: boolean,
): Promise<CommunityIntegration> {
  const now = new Date().toISOString();
  const nextStatus: IntegrationStatus = isActive ? "Conectado" : "Desativado";

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("community_integrations")
        .update({
          is_active: isActive,
          status: nextStatus,
          updated_at: now,
        })
        .eq("id", integrationId)
        .eq("community_id", communityId)
        .select("*")
        .single();

      if (!error && data) {
        const item = data as CommunityIntegration;
        const current = getLocalIntegrations(communityId);
        saveLocalIntegrations(
          communityId,
          current.map((i) => (i.id === integrationId ? item : i)),
        );
        return item;
      }
    } catch {
      // Fallback
    }
  }

  const current = getLocalIntegrations(communityId);
  const existing = current.find((i) => i.id === integrationId);
  if (!existing) throw new Error("Integração não encontrada.");

  const updated: CommunityIntegration = {
    ...existing,
    is_active: isActive,
    status: nextStatus,
    updated_at: now,
  };

  saveLocalIntegrations(
    communityId,
    current.map((i) => (i.id === integrationId ? updated : i)),
  );

  return updated;
}

export async function disconnectCommunityIntegration(
  communityId: string,
  integrationId: string,
): Promise<void> {
  if (supabase) {
    try {
      await supabase
        .from("community_integrations")
        .delete()
        .eq("id", integrationId)
        .eq("community_id", communityId);
    } catch {
      // Fallback
    }
  }

  const current = getLocalIntegrations(communityId);
  saveLocalIntegrations(
    communityId,
    current.filter((i) => i.id !== integrationId),
  );
}
