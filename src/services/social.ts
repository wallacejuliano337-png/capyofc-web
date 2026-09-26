import { db } from "../lib/supabase";
import type { Profile } from "../types";
export const presenceLabels: Record<string, string> = {
  online: "Online",
  away: "Ausente",
  busy: "Não perturbe",
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
  const { data, error } = await db().rpc("social_action", { action, payload });
  if (error) throw error;
  return data as T;
}
export async function presenceAction(
  action: string,
  sessionId: string,
  preference?: string,
) {
  const { data, error } = await db().rpc("presence_action", {
    action,
    session_id: sessionId,
    ...(preference ? { preference } : {}),
  });
  if (error) throw error;
  return data as { preference: string; status: string };
}
export async function loadSocial(userId: string) {
  const [friends, blocks, conversations, presence] = await Promise.all([
    db().from("friendships").select("*"),
    db().from("user_blocks").select("blocked_id").eq("active", true),
    db().rpc("dm_inbox"),
    db().from("user_presence").select("*"),
  ]);
  for (const r of [friends, blocks, conversations, presence])
    if (r.error) throw r.error;
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
    if (error) throw error;
    for (const p of data || []) profiles[p.id] = p;
  }
  return {
    friends: friends.data as Friendship[],
    blocks: (blocks.data || []).map((b) => String(b.blocked_id)),
    conversations: conversations.data as Conversation[],
    presence: presence.data as Presence[],
    profiles,
  };
}
export type PublicPerson = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url"
>;
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
export async function findPeople(query: string, userId: string) {
  const safe = query
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
  return data as PublicPerson[];
}
export async function dmHistory(conversationId: string, pages = 1) {
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
    if (error) throw error;
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
    const { data, error } = await db()
      .from("dm_messages")
      .select("id,content,deleted_at,author_id")
      .eq("conversation_id", conversationId)
      .in("id", replyIds.slice(offset, offset + 100));
    if (error) throw error;
    for (const row of data || []) replies.set(row.id, row);
  }
  return rows.reverse().map((row) => ({
    ...row,
    reply: row.reply_to ? replies.get(row.reply_to) || null : null,
  }));
}
