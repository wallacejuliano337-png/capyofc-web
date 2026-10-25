import { supabase, db } from "../lib/supabase";

export type AuditLogActionType =
  // Membros
  | "member_ban"
  | "member_unban"
  | "member_role_add"
  | "member_role_remove"
  | "member_kick"
  // Cargos
  | "role_create"
  | "role_update"
  | "role_delete"
  // Canais
  | "channel_create"
  | "channel_update"
  | "channel_delete"
  // Categorias
  | "category_create"
  | "category_update"
  | "category_delete"
  // Convites
  | "invite_create"
  | "invite_revoke"
  // Comunidade
  | "community_update"
  // Segurança
  | "safety_update"
  // Expressões
  | "emoji_create"
  | "emoji_update"
  | "emoji_delete"
  | "sticker_create"
  | "sticker_update"
  | "sticker_delete"
  | "sound_create"
  | "sound_update"
  | "sound_delete"
  // Webhooks
  | "webhook_create"
  | "webhook_update"
  | "webhook_token_regenerate"
  | "webhook_delete"
  // Integrações
  | "integration_connect"
  | "integration_disconnect";

export type AuditLogTargetType =
  | "member"
  | "role"
  | "channel"
  | "category"
  | "invite"
  | "community"
  | "safety"
  | "emoji"
  | "sticker"
  | "sound"
  | "webhook"
  | "integration";

export interface AuditChangeDetail {
  field: string;
  before?: string | number | boolean | null;
  after?: string | number | boolean | null;
}

export interface AuditLogEntry {
  id: string;
  community_id: string;
  actor_user_id: string;
  actor_name: string;
  actor_username: string;
  actor_avatar_url?: string | null;
  action_type: AuditLogActionType;
  target_type: AuditLogTargetType;
  target_id?: string;
  target_name?: string;
  metadata?: {
    reason?: string;
    changes?: AuditChangeDetail[];
    [key: string]: unknown;
  };
  created_at: string; // ISO 8601
}

const STORAGE_PREFIX = "lyc_community_audit_logs_";
const MAX_LOG_ENTRIES = 500;

export function canViewAuditLog(
  isOwner: boolean,
  permissions: string[] = [],
): boolean {
  return (
    isOwner ||
    permissions.includes("manage_community") ||
    permissions.includes("manage_roles") ||
    permissions.includes("manage_channels") ||
    permissions.includes("moderate_members")
  );
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
  } catch {
    // ignore
  }
  return null;
}

export function getCommunityAuditLogs(
  communityId: string,
  auth?: { isOwner: boolean; permissions: string[] },
): AuditLogEntry[] {
  if (auth && !canViewAuditLog(auth.isOwner, auth.permissions)) {
    return [];
  }
  try {
    const storage = getStorage();
    if (!storage) return [];
    const raw = storage.getItem(`${STORAGE_PREFIX}${communityId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function loadCommunityAuditLogs(
  communityId: string,
  auth?: { isOwner: boolean; permissions: string[] },
): Promise<AuditLogEntry[]> {
  if (auth && !canViewAuditLog(auth.isOwner, auth.permissions)) {
    return [];
  }

  if (supabase) {
    try {
      const { data, error } = await db()
        .from("community_audit_logs")
        .select(
          `
          id,
          community_id,
          actor_id,
          action_type,
          target_type,
          target_id,
          target_name,
          metadata,
          created_at,
          actor_profile:actor_id(id, display_name, username, avatar_url)
        `,
        )
        .eq("community_id", communityId)
        .order("created_at", { ascending: false })
        .limit(MAX_LOG_ENTRIES);

      if (!error && Array.isArray(data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: AuditLogEntry[] = data.map((row: any) => ({
          id: String(row.id),
          community_id: row.community_id,
          actor_user_id: row.actor_id,
          actor_name: row.actor_profile?.display_name || "Administrador",
          actor_username: row.actor_profile?.username || "admin",
          actor_avatar_url: row.actor_profile?.avatar_url || null,
          action_type: row.action_type as AuditLogActionType,
          target_type: row.target_type as AuditLogTargetType,
          target_id: row.target_id || undefined,
          target_name: row.target_name || undefined,
          metadata: row.metadata || {},
          created_at: row.created_at,
        }));

        const storage = getStorage();
        if (storage) {
          try {
            storage.setItem(
              `${STORAGE_PREFIX}${communityId}`,
              JSON.stringify(mapped),
            );
          } catch {
            // ignore
          }
        }

        return mapped;
      }
    } catch {
      // Fallback to local storage
    }
  }

  return getCommunityAuditLogs(communityId, auth);
}

export function recordAuditLogEntry(
  communityId: string,
  actor: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
  },
  entry: {
    action_type: AuditLogActionType;
    target_type: AuditLogTargetType;
    target_id?: string;
    target_name?: string;
    metadata?: {
      reason?: string;
      changes?: AuditChangeDetail[];
      [key: string]: unknown;
    };
  },
): AuditLogEntry {
  const newEntry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    community_id: communityId,
    actor_user_id: actor.id,
    actor_name: actor.display_name,
    actor_username: actor.username,
    actor_avatar_url: actor.avatar_url,
    action_type: entry.action_type,
    target_type: entry.target_type,
    target_id: entry.target_id,
    target_name: entry.target_name,
    metadata: entry.metadata,
    created_at: new Date().toISOString(),
  };

  try {
    const storage = getStorage();
    if (storage) {
      const existing = getCommunityAuditLogs(communityId);
      const updated = [newEntry, ...existing].slice(0, MAX_LOG_ENTRIES);
      storage.setItem(
        `${STORAGE_PREFIX}${communityId}`,
        JSON.stringify(updated),
      );
    }
  } catch {
    // Graceful degrade if localStorage fails
  }

  if (supabase && actor.id && actor.id !== "moderator" && actor.id !== "local-user") {
    void db()
      .from("community_audit_logs")
      .insert({
        community_id: communityId,
        actor_id: actor.id,
        action_type: entry.action_type,
        target_type: entry.target_type,
        target_id: entry.target_id || null,
        target_name: entry.target_name || null,
        metadata: entry.metadata || {},
      })
      .then(({ error }) => {
        if (error) {
          // Log locally if insert policy restricted
        }
      });
  }

  return newEntry;
}

export function formatAuditActionVerb(actionType: AuditLogActionType): string {
  switch (actionType) {
    case "member_ban":
      return "baniu o membro";
    case "member_unban":
      return "revogou o banimento de";
    case "member_role_add":
      return "atribuiu cargo para";
    case "member_role_remove":
      return "removeu cargo de";
    case "member_kick":
      return "expulsou o membro";
    case "role_create":
      return "criou o cargo";
    case "role_update":
      return "alterou as configurações do cargo";
    case "role_delete":
      return "excluiu o cargo";
    case "channel_create":
      return "criou o canal";
    case "channel_update":
      return "editou o canal";
    case "channel_delete":
      return "excluiu o canal";
    case "category_create":
      return "criou a categoria";
    case "category_update":
      return "editou a categoria";
    case "category_delete":
      return "excluiu a categoria";
    case "invite_create":
      return "gerou um código de convite";
    case "invite_revoke":
      return "revogou o convite";
    case "community_update":
      return "atualizou o perfil do servidor";
    case "safety_update":
      return "alterou as configurações de segurança";
    case "emoji_create":
      return "adicionou o emoji";
    case "emoji_update":
      return "editou o emoji";
    case "emoji_delete":
      return "excluiu o emoji";
    case "sticker_create":
      return "adicionou a figurinha";
    case "sticker_update":
      return "editou a figurinha";
    case "sticker_delete":
      return "excluiu a figurinha";
    case "sound_create":
      return "adicionou o efeito sonoro";
    case "sound_update":
      return "editou o efeito sonoro";
    case "sound_delete":
      return "excluiu o efeito sonoro";
    case "webhook_create":
      return "criou o webhook";
    case "webhook_update":
      return "editou o webhook";
    case "webhook_token_regenerate":
      return "regenerou a chave de acesso do webhook";
    case "webhook_delete":
      return "excluiu o webhook";
    case "integration_connect":
      return "conectou a integração";
    case "integration_disconnect":
      return "desconectou a integração";
    default:
      return "realizou uma alteração administrativa";
  }
}

export function formatAuditDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    const timeStr = d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) return `Hoje às ${timeStr}`;
    if (isYesterday) return `Ontem às ${timeStr}`;

    const dateStr = d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return `${dateStr} às ${timeStr}`;
  } catch {
    return isoString;
  }
}
