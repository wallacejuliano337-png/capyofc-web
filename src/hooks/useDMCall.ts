import { useCallback, useEffect, useRef, useState } from "react";
import { Room, ConnectionState, RoomEvent, Track } from "livekit-client";
import { supabase, db } from "../lib/supabase";
import type { Profile, Source } from "../types";
import {
  type CallStatus,
  type CallType,
  type DMCall,
  startCall as apiStartCall,
  answerCall as apiAnswerCall,
  declineCall as apiDeclineCall,
  endCall as apiEndCall,
  missCall as apiMissCall,
  getActiveCall as apiGetActiveCall,
} from "../services/dm-calls";
import { requestCallToken, shareScreen, qualities } from "../services/media";
import { audioSettings } from "../services/audio-settings";

export function useDMCall(
  userId?: string,
  _currentProfile?: Profile | null,
) {
  const [call, setCall] = useState<DMCall | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [peerProfile, setPeerProfile] = useState<Profile | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  const roomRef = useRef<Room>(
    new Room({ adaptiveStream: true, dynacast: true }),
  );
  const room = roomRef.current;

  const stopScreenShare = useRef<(() => void) | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callRef = useRef<DMCall | null>(null);
  callRef.current = call;

  // Bind audio settings to room
  useEffect(() => {
    return audioSettings.bind(room);
  }, [room]);

  // Load peer profile helper
  const loadPeerProfile = useCallback(
    async (peerId: string) => {
      try {
        const { data } = await db()
          .from("profiles")
          .select("*")
          .eq("id", peerId)
          .single();
        if (data) setPeerProfile(data as Profile);
      } catch {
        // Ignored
      }
    },
    [],
  );

  // Connect to LiveKit Room
  const connectLiveKit = useCallback(
    async (activeCall: DMCall) => {
      if (room.state === ConnectionState.Connected) return;
      setCallStatus("connecting");
      setError("");

      const abort = new AbortController();
      try {
        const creds = await requestCallToken(activeCall.id, abort.signal);
        await room.connect(creds.url, creds.token);

        try {
          await room.startAudio();
        } catch {
          // Playback might need user gesture
        }

        // Setup initial tracks
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMicEnabled(true);

        if (activeCall.call_type === "video") {
          try {
            await room.localParticipant.setCameraEnabled(true);
            setIsCameraEnabled(true);
          } catch {
            setIsCameraEnabled(false);
          }
        } else {
          setIsCameraEnabled(false);
        }

        setCallStatus("connected");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Falha ao conectar na sala de mídia.",
        );
        setCallStatus("failed");
      }
    },
    [room],
  );

  // Disconnect & cleanup
  const cleanupCall = useCallback(
    async (terminalStatus?: CallStatus) => {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
      if (stopScreenShare.current) {
        stopScreenShare.current();
        stopScreenShare.current = null;
      }
      setIsScreenSharing(false);
      setIsCameraEnabled(false);
      setIsMicEnabled(true);
      setIsDeafened(false);

      try {
        for (const pub of room.localParticipant.trackPublications.values()) {
          if (pub.track) {
            pub.track.stop();
            try {
              pub.track.mediaStreamTrack?.stop();
            } catch {
              // Ignored
            }
          }
        }
      } catch {
        // Ignored
      }

      if (room.state !== ConnectionState.Disconnected) {
        await room.disconnect().catch(() => {});
      }

      if (terminalStatus && terminalStatus !== "ended") {
        setCallStatus(terminalStatus);
        setTimeout(() => {
          setCall(null);
          setPeerProfile(null);
          setCallStatus("idle");
          setDuration(0);
          setError("");
        }, 1200);
      } else {
        setCall(null);
        setPeerProfile(null);
        setCallStatus("idle");
        setDuration(0);
        setError("");
      }
    },
    [room],
  );

  // Check initial active call on load
  useEffect(() => {
    if (!userId) return;
    let active = true;

    void apiGetActiveCall()
      .then(async (c) => {
        if (!active || !c) return;
        setCall(c);
        const peerId = c.caller_id === userId ? c.receiver_id : c.caller_id;
        void loadPeerProfile(peerId);

        if (c.status === "connected") {
          void connectLiveKit(c);
        } else if (c.status === "calling") {
          if (c.caller_id === userId) {
            setCallStatus("calling");
          } else {
            setCallStatus("ringing");
          }
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [userId, loadPeerProfile, connectLiveKit]);

  // Duration counter when connected
  useEffect(() => {
    if (callStatus !== "connected") return;
    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  // Realtime subscription to dm_calls
  useEffect(() => {
    if (!userId || !supabase) return;
    let active = true;

    const channel = supabase
      .channel("dm-calls:" + userId + ":" + crypto.randomUUID())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_calls" },
        (payload) => {
          if (!active) return;
          const newCall = payload.new as DMCall;
          if (!newCall || !newCall.id) return;

          // Only process calls relevant to current user
          if (
            newCall.caller_id !== userId &&
            newCall.receiver_id !== userId
          ) {
            return;
          }

          const currentActive = callRef.current;

          // Incoming new call
          if (newCall.status === "calling") {
            if (newCall.receiver_id === userId) {
              setCall(newCall);
              setCallStatus("ringing");
              void loadPeerProfile(newCall.caller_id);

              // Auto miss call after 40 seconds ringing
              if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
              ringTimeoutRef.current = setTimeout(() => {
                void apiMissCall(newCall.id).catch(() => {});
              }, 40000);
            } else if (newCall.caller_id === userId) {
              setCall(newCall);
              setCallStatus("calling");
              void loadPeerProfile(newCall.receiver_id);
            }
          }

          // Call answered
          else if (newCall.status === "connected") {
            if (ringTimeoutRef.current) {
              clearTimeout(ringTimeoutRef.current);
              ringTimeoutRef.current = null;
            }
            setCall(newCall);
            if (room.state !== ConnectionState.Connected) {
              void connectLiveKit(newCall);
            }
          }

          // Call declined, ended, missed, or failed
          else if (
            currentActive?.id === newCall.id &&
            ["declined", "missed", "ended", "failed"].includes(newCall.status)
          ) {
            void cleanupCall(newCall.status);
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase?.removeChannel(channel);
    };
  }, [userId, loadPeerProfile, connectLiveKit, cleanupCall, room]);

  // Actions
  const handleStartCall = useCallback(
    async (conversationId: string, peer: Profile, type: CallType = "voice") => {
      console.log("[DM_CALL] handleStartCall initiated:", {
        conversationId,
        peerId: peer.id,
        peerName: peer.display_name,
        type,
        currentUserId: userId,
      });

      setError("");
      setDuration(0);

      // 1. Immediately create optimistic local outgoing call (Requirement 2)
      const optimisticCall: DMCall = {
        id: "local-" + crypto.randomUUID(),
        conversation_id: conversationId,
        caller_id: userId || "",
        receiver_id: peer.id,
        call_type: type,
        status: "calling",
        room_name: `dm_${conversationId}_${Date.now()}`,
        duration_seconds: 0,
        started_at: new Date().toISOString(),
        connected_at: null,
        ended_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 2. Transition immediately to local calling state without waiting for network/RPC
      setCall(optimisticCall);
      setPeerProfile(peer);
      setCallStatus("calling");
      setIsMicEnabled(true);
      setIsDeafened(false);
      setIsCameraEnabled(type === "video");

      // 3. Concurrently send request to backend (Requirement 2 & 3)
      const startTime = Date.now();
      try {
        console.log("[DM_CALL] Sending apiStartCall to backend...");
        const newCall = await apiStartCall(conversationId, type);
        console.log("[DM_CALL] apiStartCall resolved successfully:", newCall);
        setCall(newCall);

        // Timeout for unanswered outgoing call (40 seconds)
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = setTimeout(() => {
          void apiMissCall(newCall.id).catch(() => {});
        }, 40000);
      } catch (err) {
        // Ensure "Chamando..." is visible for at least 1500ms so it does not flash
        const elapsed = Date.now() - startTime;
        if (elapsed < 1500) {
          await new Promise((resolve) => setTimeout(resolve, 1500 - elapsed));
        }

        const errorMsg =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err && "message" in err
              ? String((err as { message: unknown }).message)
              : String(err);

        console.error("[DM_CALL] apiStartCall failed with real error:", err);
        setError(`Não foi possível iniciar a chamada: ${errorMsg}`);
        setCallStatus("failed");

        // Voltar a área para o estado anterior de forma limpa após reportar erro
        setTimeout(() => {
          setCall((curr) => (curr?.id.startsWith("local-") ? null : curr));
          setPeerProfile((curr) => (curr?.id === peer.id ? null : curr));
          setCallStatus((curr) => (curr === "failed" ? "idle" : curr));
        }, 3500);
      }
    },
    [userId],
  );

  const handleAnswerCall = useCallback(async () => {
    if (!call) return;
    setError("");
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    try {
      const answered = await apiAnswerCall(call.id);
      setCall(answered);
      await connectLiveKit(answered);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao atender chamada.",
      );
      setCallStatus("failed");
    }
  }, [call, connectLiveKit]);

  const handleDeclineCall = useCallback(async () => {
    if (!call) return;
    try {
      if (!call.id.startsWith("local-") && !call.id.startsWith("temp-")) {
        await apiDeclineCall(call.id);
      }
    } finally {
      await cleanupCall("declined");
    }
  }, [call, cleanupCall]);

  const handleEndCall = useCallback(async () => {
    if (!call) return;
    try {
      if (!call.id.startsWith("local-") && !call.id.startsWith("temp-")) {
        await apiEndCall(call.id);
      }
    } finally {
      await cleanupCall("ended");
    }
  }, [call, cleanupCall]);

  // Room event listeners (Requirement 14)
  useEffect(() => {
    const handleDisconnected = () => {
      void cleanupCall("ended");
    };
    const handleParticipantDisconnected = () => {
      // 1-on-1 call: if remote peer disconnects, end the call
      void cleanupCall("ended");
    };
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room, cleanupCall]);

  // Window unload cleanup (Requirement 14)
  useEffect(() => {
    const handleUnload = () => {
      const active = callRef.current;
      if (
        active &&
        ["calling", "ringing", "connected"].includes(active.status)
      ) {
        void apiEndCall(active.id).catch(() => {});
        void room.disconnect().catch(() => {});
      }
    };
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [room]);

  const toggleMicrophone = useCallback(async () => {
    try {
      const next = !isMicEnabled;
      await room.localParticipant.setMicrophoneEnabled(next);
      setIsMicEnabled(next);
    } catch {
      // Ignored
    }
  }, [room, isMicEnabled]);

  const toggleCamera = useCallback(async () => {
    try {
      if (isCameraEnabled) {
        await room.localParticipant.setCameraEnabled(false);
        const camPub = room.localParticipant.getTrackPublication(
          Track.Source.Camera,
        );
        if (camPub?.track) {
          camPub.track.stop();
          try {
            camPub.track.mediaStreamTrack?.stop();
          } catch {
            // Ignored
          }
        }
        setIsCameraEnabled(false);
        return;
      }

      const freshDevices = await navigator.mediaDevices
        .enumerateDevices()
        .catch(() => []);
      const hasCamera = freshDevices.some((d) => d.kind === "videoinput");
      if (!hasCamera) {
        setError("Câmera não encontrada.");
        return;
      }

      await room.localParticipant.setCameraEnabled(true);
      setIsCameraEnabled(true);
    } catch (err) {
      console.error("Camera permission error in DM call:", err);
      setError("Não foi possível acessar a câmera.");
    }
  }, [room, isCameraEnabled]);

  const startScreenShare = useCallback(
    async (
      source?: Source,
      quality: keyof typeof qualities = "720p30",
      audio = true,
    ) => {
      if (isScreenSharing) {
        if (stopScreenShare.current) {
          stopScreenShare.current();
          stopScreenShare.current = null;
        }
        setIsScreenSharing(false);
        return;
      }

      if (source) {
        await window.arena?.selectSource(source.id, audio);
      }
      let result;
      try {
        result = await shareScreen(room, quality, audio);
      } catch (error) {
        if (
          source &&
          quality !== "720p30" &&
          error instanceof DOMException &&
          ["OverconstrainedError", "NotReadableError"].includes(error.name)
        ) {
          await window.arena?.selectSource(source.id, false);
          result = await shareScreen(room, "720p30", false);
        } else {
          setIsScreenSharing(false);
          throw error;
        }
      }
      stopScreenShare.current = result.stop;
      setIsScreenSharing(true);

      const handleEnded = () => {
        setIsScreenSharing(false);
        stopScreenShare.current = null;
      };

      if (result.videoTrack) {
        result.videoTrack.addEventListener("ended", handleEnded, { once: true });
      } else {
        const pub = room.localParticipant.getTrackPublication(
          Track.Source.ScreenShare,
        );
        pub?.track?.mediaStreamTrack?.addEventListener("ended", handleEnded, {
          once: true,
        });
      }
    },
    [room, isScreenSharing],
  );

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      if (stopScreenShare.current) {
        stopScreenShare.current();
        stopScreenShare.current = null;
      }
      setIsScreenSharing(false);
      return;
    }
    await startScreenShare();
  }, [isScreenSharing, startScreenShare]);

  const toggleDeafened = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev;
      // Mute/unmute all remote audio playback
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.audioTrackPublications.values()) {
          if (pub.track) {
            pub.track.mediaStreamTrack.enabled = !next;
          }
        }
      }
      return next;
    });
  }, [room]);

  return {
    call,
    callStatus,
    peerProfile,
    duration,
    error,
    room,
    isMicEnabled,
    isCameraEnabled,
    isScreenSharing,
    isDeafened,
    startCall: handleStartCall,
    answerCall: handleAnswerCall,
    declineCall: handleDeclineCall,
    endCall: handleEndCall,
    toggleMicrophone,
    toggleCamera,
    startScreenShare,
    toggleScreenShare,
    toggleDeafened,
    clearError: () => setError(""),
  };
}

export type DMCallState = ReturnType<typeof useDMCall>;
