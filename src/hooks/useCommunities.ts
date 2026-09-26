import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  loadCommunities,
  loadCommunity,
  loadLegacyCommunity,
} from "../services/communities";
import { useAsync } from "./useAsync";
export function useCommunities(userId?: string) {
  const [selected, setSelected] = useState<string | null>(null);
  const listState = useAsync(
    useCallback(
      async () =>
        userId && supabase ? loadCommunities() : { available: true, items: [] },
      [userId],
    ),
  );
  const list = { ...listState, data: listState.data?.items };
  const legacy = listState.data?.available === false;
  const current =
    list.data?.find((c) => c.id === selected) || list.data?.[0] || null;
  const id = current?.id;
  const detail = useAsync(
    useCallback(
      async () =>
        legacy
          ? loadLegacyCommunity()
          : id
            ? loadCommunity(id)
            : {
                communityId: undefined,
                channels: [],
                categories: [],
                members: [],
                roles: [],
                permissions: [],
              },
      [id, legacy],
    ),
  );
  const reloadDetail = useRef(detail.reload);
  reloadDetail.current = detail.reload;
  useEffect(() => {
    if (!userId || !supabase) return;
    let active = true;
    const client = supabase;
    const ch = client
      .channel("community-directory:" + userId + ":" + crypto.randomUUID())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "communities" },
        () => {
          void list.reload();
          void reloadDetail.current();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_members",
          filter: "user_id=eq." + userId,
        },
        () => {
          void list.reload();
          void reloadDetail.current();
        },
      );
    // Session restoration may finish before the Realtime socket has its JWT.
    // Authenticate before subscribing so Postgres Changes evaluates user RLS.
    void client.realtime.setAuth().then(() => {
      if (!active) return;
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void list.reload();
          void reloadDetail.current();
        }
      });
    });
    return () => {
      active = false;
      void client.removeChannel(ch);
    };
  }, [userId, list.reload]);
  return {
    legacy,
    list,
    current,
    detail: {
      ...detail,
      data: detail.data?.communityId === id ? detail.data : undefined,
    },
    select: setSelected,
    reload: async () => {
      await list.reload();
      await detail.reload();
    },
  };
}
