import { db } from "../lib/supabase";
import type { MessageAttachment, Profile, Reaction } from "../types";
export const presenceLabels: Record<string, string> = {
  online: "Online",
  away: "Ausente",
  busy: "Ocupado",
  invisible: "Invisível",
  offline: "Offline",
};
export interface Presence {
  user_id: string;
  status: string;
  expires_at: string | null;
}
export function visiblePresence(p: Presence | undefined, now = Date.now()) {
  return p &&
    p.status !== "offline" &&
    p.expires_at &&
    Date.parse(p.expires_at) > now
    ? p.status
    : "offline";
}
export interface Friendship {
  user_low: string;
  user_high: string;
  requester_id: string;
  state: string;
}
export interface Conversation {
  id: string;
  peer_id: string;
  last_seq: number;
  last_read_seq: number;
  unread_count: number;
  updated_at: string;
}
export interface DirectMessage {
  id: string;
  conversation_id: string;
  author_id: string;
  seq: number;
  content: string;
  reply_to: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  attachments?: MessageAttachment[];
  reactions?: Reaction[];
  reply: {
    id: string;
    content: string;
    deleted_at: string | null;
    author_id: string;
  } | null;
}
export async function socialAction<T = unknown>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  try {
    const { data, error } = await db().rpc("social_action", { action, payload });
    if (error) {
      console.error(`[socialAction] RPC ERROR for "${action}":`, error);
      throw error;
    }
    return data as T;
  } catch (err) {
    console.error(`[socialAction] EXCEPTION for "${action}":`, err);
    throw err;
  }
}
export async function presenceAction(
  action: string,
  sessionId: string,
  preference?: string,
) {
  try {
    const { data, error } = await db().rpc("presence_action", {
      action,
      session_id: sessionId,
      ...(preference ? { preference } : {}),
    });
    if (error) {
      console.error(`[presenceAction] RPC ERROR for "${action}":`, error);
      throw error;
    }
    return data as { preference: string; status: string };
  } catch (err) {
    console.error(`[presenceAction] EXCEPTION for "${action}":`, err);
    throw err;
  }
}
export async function loadSocial(userId: string) {
  try {
    const [friends, blocks, conversations, presence] = await Promise.all([
      db().from("friendships").select("*"),
      db().from("user_blocks").select("blocked_id").eq("active", true),
      db().rpc("dm_inbox"),
      db().from("user_presence").select("*"),
    ]);
    for (const [table, res] of [["friendships", friends], ["user_blocks", blocks], ["dm_inbox", conversations], ["user_presence", presence]] as const) {
      if (res.error) {
        console.error(`[loadSocial] ERROR in ${table}: ${JSON.stringify(res.error)}`);
        throw res.error;
      }
    }
    const peers = [
      ...new Set([
        ...(friends.data || []).flatMap((f) => [f.user_low, f.user_high]),
        ...(blocks.data || []).map((b) => b.blocked_id),
        ...(conversations.data || []).map((c: Conversation) => c.peer_id),
      ]),
    ].filter((p) => p !== userId);
    const profiles: Record<string, Profile> = {};
    if (peers.length) {
      const { data, error } = await db()
        .from("profiles")
        .select("*")
        .in("id", peers);
      if (error) {
        console.error("[loadSocial] ERROR in profiles query:", error);
        throw error;
      }
      for (const p of data || []) {
        profiles[p.id] = normalizePublicPerson(p as Profile);
      }
    }
    return {
      friends: friends.data as Friendship[],
      blocks: (blocks.data || []).map((b) => String(b.blocked_id)),
      conversations: conversations.data as Conversation[],
      presence: presence.data as Presence[],
      profiles,
    };
  } catch (err) {
    console.error("[loadSocial] EXCEPTION:", err);
    throw err;
  }
}

export function normalizeUsername(username?: string | null, displayName?: string | null): string {
  if (!username) {
    return displayName?.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "") || "usuario";
  }
  if (/^u_[0-9a-f]{16,}$/i.test(username) && displayName) {
    const friendly = displayName.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
    if (friendly.length >= 2) return friendly;
  }
  return username;
}

export function normalizePublicPerson<T extends { username: string; display_name?: string }>(p: T): T {
  return {
    ...p,
    username: normalizeUsername(p.username, p.display_name),
  };
}

export async function ensureFriendlyUsername(profile: Profile) {
  if (!profile?.id) return;
  if (/^u_[0-9a-f]{16,}$/i.test(profile.username) && profile.display_name) {
    const friendly = profile.display_name.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
    if (friendly.length >= 3 && friendly.length <= 32) {
      try {
        await db().from("profiles").update({ username: friendly }).eq("id", profile.id);
        profile.username = friendly;
      } catch (e) {
        console.warn("[ensureFriendlyUsername] Could not auto-update username:", e);
      }
    }
  }
}

export type PublicPerson = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url"
>;
export type FriendState =
  | "NONE"
  | "PENDING_OUTGOING"
  | "PENDING_INCOMING"
  | "FRIENDS"
  | "BLOCKED";

export function getFriendState(
  friends: Friendship[],
  userId: string,
  peerId: string,
  blocked = false,
): FriendState {
  if (peerId === userId) return "NONE";
  if (blocked) return "BLOCKED";
  const relation = friends.find(
    (f) =>
      (f.user_low === userId && f.user_high === peerId) ||
      (f.user_high === userId && f.user_low === peerId),
  );
  if (relation?.state === "accepted") return "FRIENDS";
  if (relation?.state === "pending")
    return relation.requester_id === userId
      ? "PENDING_OUTGOING"
      : "PENDING_INCOMING";
  return "NONE";
}

export function friendRequestStatus(
  friends: Friendship[],
  userId: string,
  peerId: string,
  blocked = false,
) {
  if (peerId === userId) return "Você";
  if (blocked) return "Usuário bloqueado";
  const relation = friends.find(
    (f) =>
      (f.user_low === userId && f.user_high === peerId) ||
      (f.user_high === userId && f.user_low === peerId),
  );
  if (relation?.state === "accepted") return "Já são amigos";
  if (relation?.state === "pending")
    return relation.requester_id === userId
      ? "Solicitação enviada"
      : "Solicitação recebida";
  return null;
}
export async function findPersonByUsername(
  username: string,
  currentUserId?: string,
) {
  const clean = username.trim().replace(/^@/, "").trim().toLowerCase();
  if (!clean) return null;
  let q = db()
    .from("profiles")
    .select("id,username,display_name,avatar_url");
  if (currentUserId) {
    q = q.neq("id", currentUserId);
  }
  const { data, error } = await q
    .or(`username.ilike.${clean},display_name.ilike.${clean}`)
    .limit(1)
    .maybeSingle();
  if (error) {
    const fallback = await db()
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .ilike("username", clean)
      .limit(1)
      .maybeSingle();
    if (fallback.data) return normalizePublicPerson(fallback.data as PublicPerson);
    throw error;
  }
  return data ? normalizePublicPerson(data as PublicPerson) : null;
}
export async function findPeople(query: string, userId: string) {
  const safe = query
    .trim()
    .replace(/^@/, "")
    .trim()
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .slice(0, 40);
  if (safe.length < 2)
    throw Error("Digite pelo menos 2 caracteres do nome ou username.");
  const { data, error } = await db()
    .from("profiles")
    .select("id,username,display_name,avatar_url")
    .neq("id", userId)
    .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
    .order("username")
    .limit(25);
  if (error) throw error;
  return (data || []).map((p) => normalizePublicPerson(p as PublicPerson));
}
export async function dmHistory(conversationId: string, pages = 1) {
  try {
    const rows: DirectMessage[] = [];
    let before: number | undefined;
    for (let page = 0; page < pages; page++) {
      let q = db()
        .from("dm_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("seq", { ascending: false })
        .limit(40);
      if (before !== undefined) q = q.lt("seq", before);
      const { data, error } = await q;
      if (error) {
        console.error(`[dmHistory] ERROR querying dm_messages: ${JSON.stringify(error)}`);
        throw error;
      }
      rows.push(...(data as DirectMessage[]));
      if (data.length < 40) break;
      before = data[data.length - 1].seq;
    }
    // Fetch reply previews under the same conversation RLS instead of relying on
    // PostgREST inference for a composite self-reference.
    const replyIds = [
      ...new Set(rows.flatMap((row) => (row.reply_to ? [row.reply_to] : []))),
    ];
    const replies = new Map<string, DirectMessage["reply"]>();
    for (let offset = 0; offset < replyIds.length; offset += 100) {
      try {
        const { data, error } = await db()
          .from("dm_messages")
          .select("id,content,deleted_at,author_id")
          .eq("conversation_id", conversationId)
          .in("id", replyIds.slice(offset, offset + 100));
        if (error) {
          console.warn("[dmHistory] Warning querying reply previews:", error);
        } else {
          for (const row of data || []) replies.set(row.id, row);
        }
      } catch (err) {
        console.warn("[dmHistory] Exception querying reply previews:", err);
      }
    }

    const messageIds = rows.map((r) => r.id);
    const reactionsMap = new Map<string, Reaction[]>();
    if (messageIds.length > 0) {
      try {
        const { data: rxData, error: rxErr } = await db()
          .from("dm_message_reactions")
          .select("message_id,user_id,emoji")
          .eq("conversation_id", conversationId)
          .in("message_id", messageIds);
        if (!rxErr && rxData) {
          for (const rx of rxData) {
            const list = reactionsMap.get(rx.message_id) || [];
            list.push(rx as Reaction);
            reactionsMap.set(rx.message_id, list);
          }
        }
      } catch {
        // Ignored if table not ready
      }
    }

    return rows.reverse().map((row) => ({
      ...row,
      reply: row.reply_to ? replies.get(row.reply_to) || null : null,
      reactions: reactionsMap.get(row.id) || [],
      attachments: (row.attachments || []) as MessageAttachment[],
    }));
  } catch (err) {
    console.error("[dmHistory] EXCEPTION:", err);
    throw err;
  }
}
