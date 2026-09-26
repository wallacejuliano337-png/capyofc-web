import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "../lib/supabase";
const urls = new Map<string, string | null>();
const listeners = new Set<() => void>();
let revision = 0;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function publishAvatar(id: string, url: string | null) {
  urls.set(id, url);
  revision++;
  listeners.forEach((fn) => fn());
}
export function useAvatarUrl(id?: string, fallback?: string | null) {
  return useSyncExternalStore(
    subscribe,
    () => (id && urls.has(id) ? urls.get(id) : fallback),
    () => fallback,
  );
}
export function useAvatarSync(userId?: string) {
  useEffect(() => {
    urls.clear();
    revision++;
    listeners.forEach((fn) => fn());
    if (!userId || !supabase) return;
    const client = supabase;
    let active = true;
    const reload = async () => {
      const before = revision;
      const { data, error } = await client
        .from("profiles")
        .select("id,avatar_url");
      if (!active || error || before !== revision) return;
      for (const row of data || []) urls.set(row.id, row.avatar_url);
      listeners.forEach((fn) => fn());
    };
    const channel = client
      .channel("profile-avatars:" + userId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          if (active && typeof payload.new.id === "string")
            publishAvatar(
              payload.new.id,
              payload.new.avatar_url as string | null,
            );
        },
      );
    void client.realtime
      .setAuth()
      .then(() => {
        if (!active) return;
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") void reload();
        });
      })
      .catch(() => {});
    void reload();
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [userId]);
}
