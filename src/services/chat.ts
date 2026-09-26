import { db, supabase } from "../lib/supabase";
import { cleanContent } from "../lib/permissions";
import { readLocal, writeLocal, demoProfile } from "./demo";
import type { Message } from "../types";
export async function history(
  channel: string,
  before?: string,
): Promise<Message[]> {
  if (!supabase)
    return readLocal()
      .messages.filter(
        (m) => m.channel_id === channel && (!before || m.created_at < before),
      )
      .slice(-40);
  let q = db()
    .from("messages")
    // Specify the author: PostgREST also finds profiles through message_reactions.
    .select("*,profiles!messages_author_id_fkey(*),message_reactions(*)")
    .eq("channel_id", channel)
    .order("created_at", { ascending: false })
    .limit(40);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Message[]).reverse();
}
export async function send(
  channel_id: string,
  author_id: string,
  content: string,
  reply_to: string | null,
) {
  content = cleanContent(content);
  if (!supabase) {
    const d = readLocal();
    d.messages.push({
      id: crypto.randomUUID(),
      channel_id,
      author_id,
      content,
      reply_to,
      created_at: new Date().toISOString(),
      edited_at: null,
      profiles: demoProfile,
      message_reactions: [],
    });
    writeLocal(d);
    return;
  }
  const { error } = await db()
    .from("messages")
    .insert({ channel_id, author_id, content, reply_to });
  if (error) throw error;
}
export async function edit(id: string, content: string) {
  content = cleanContent(content);
  if (!supabase) {
    const d = readLocal();
    d.messages = d.messages.map((m) =>
      m.id === id ? { ...m, content, edited_at: new Date().toISOString() } : m,
    );
    writeLocal(d);
    return;
  }
  const { error } = await db()
    .from("messages")
    .update({ content, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
export async function remove(id: string) {
  if (!supabase) {
    const d = readLocal();
    d.messages = d.messages.filter((m) => m.id !== id);
    writeLocal(d);
    return;
  }
  const { error } = await db().from("messages").delete().eq("id", id);
  if (error) throw error;
}
export async function reactTo(m: Message, user_id: string) {
  const exists = m.message_reactions?.some(
    (r) => r.user_id === user_id && r.emoji === "🔥",
  );
  if (!supabase) {
    const d = readLocal();
    d.messages = d.messages.map((v) =>
      v.id === m.id
        ? {
            ...v,
            message_reactions: exists
              ? v.message_reactions?.filter((r) => r.user_id !== user_id)
              : [
                  ...(v.message_reactions || []),
                  { message_id: m.id, user_id, emoji: "🔥" },
                ],
          }
        : v,
    );
    writeLocal(d);
    return;
  }
  const q = db().from("message_reactions");
  const { error } = exists
    ? await q
        .delete()
        .eq("message_id", m.id)
        .eq("user_id", user_id)
        .eq("emoji", "🔥")
    : await q.insert({ message_id: m.id, user_id, emoji: "🔥" });
  if (error) throw error;
}
