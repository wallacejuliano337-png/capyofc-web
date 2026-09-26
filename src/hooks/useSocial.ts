import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, messageOf } from "../lib/supabase";
import { useAsync } from "./useAsync";
import { loadSocial, presenceAction } from "../services/social";
export function useSocial(userId?: string) {
  const [revision, setRevision] = useState(0),
    [connection, setConnection] = useState("Conectando…"),
    [preference, setPreference] = useState("online"),
    [presenceError, setPresenceError] = useState("");
  const sessionRef = useRef(crypto.randomUUID());
  const [now, setNow] = useState(Date.now());
  const state = useAsync(
    useCallback(
      async () => (userId && supabase ? loadSocial(userId) : null),
      [userId],
    ),
  );
  const reloadRef = useRef(state.reload);
  reloadRef.current = state.reload;
  useEffect(() => {
    if (!userId || !supabase) return;
    const sessionId = crypto.randomUUID();
    sessionRef.current = sessionId;
    let active = true;
    let debounce: ReturnType<typeof setTimeout>;
    const client = supabase;
    const invalidate = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (active) {
          setRevision((r) => r + 1);
          void reloadRef.current();
        }
      }, 50);
    };
    const channel = client
      .channel("social:" + userId + ":" + crypto.randomUUID())
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "social_inbox",
          filter: "user_id=eq." + userId,
        },
        () => {
          invalidate();
          void presenceAction("get", sessionId)
            .then((v) => {
              if (active) setPreference(v.preference);
            })
            .catch(() => {});
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        invalidate,
      );
    void client.realtime
      .setAuth()
      .then(() => {
        if (active)
          channel.subscribe((status) => {
            if (!active) return;
            setConnection(
              status === "SUBSCRIBED"
                ? "Conectado"
                : status === "CHANNEL_ERROR"
                  ? "Reconectando…"
                  : status,
            );
            if (status === "SUBSCRIBED") invalidate();
          });
      })
      .catch((e) => {
        if (active) setConnection(messageOf(e));
      });
    const heartbeat = () =>
      void presenceAction("heartbeat", sessionId)
        .then((v) => {
          if (active) {
            setPreference(v.preference);
            setPresenceError("");
          }
        })
        .catch((e) => {
          if (active) setPresenceError(messageOf(e));
        });
    heartbeat();
    const beat = setInterval(heartbeat, 25000);
    const clock = setInterval(() => setNow(Date.now()), 5000);
    const wake = () => {
      heartbeat();
      invalidate();
    };
    const leave = () => {
      void presenceAction("leave", sessionId).catch(() => {});
    };
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pagehide", leave);
    return () => {
      active = false;
      clearTimeout(debounce);
      clearInterval(beat);
      clearInterval(clock);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pagehide", leave);
      void client.removeChannel(channel);
      leave();
    };
  }, [userId]);
  return {
    ...state,
    revision,
    connection,
    preference,
    presenceError,
    now,
    setPresence: async (value: string) => {
      try {
        const r = await presenceAction("set", sessionRef.current, value);
        setPreference(r.preference);
        setPresenceError("");
        await state.reload();
      } catch (e) {
        setPresenceError(messageOf(e));
      }
    },
    refresh: async () => {
      setRevision((r) => r + 1);
      await state.reload();
    },
  };
}
