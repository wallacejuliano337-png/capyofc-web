import { Room, Track, LocalAudioTrack, LocalVideoTrack } from "livekit-client";
import { db, supabaseUrl, supabaseKey } from "../lib/supabase";
export const qualities = {
  "144p10": { width: 256, height: 144, frameRate: 10 },
  "240p15": { width: 426, height: 240, frameRate: 15 },
  "360p15": { width: 640, height: 360, frameRate: 15 },
  "480p30": { width: 854, height: 480, frameRate: 30 },
  "720p30": { width: 1280, height: 720, frameRate: 30 },
  "1080p30": { width: 1920, height: 1080, frameRate: 30 },
  "1080p60": { width: 1920, height: 1080, frameRate: 60 },
};
export async function requestVoiceToken(
  channelId: string,
  signal: AbortSignal,
) {
  const endpoint =
    import.meta.env.VITE_LIVEKIT_TOKEN_ENDPOINT ||
    (supabaseUrl
      ? supabaseUrl + "/functions/v1/livekit-token"
      : "");
  if (!endpoint)
    throw new Error(
      "Configure o endpoint seguro de tokens LiveKit para entrar na sala.",
    );
  if (!endpoint.startsWith("https://"))
    throw new Error("O endpoint deve usar HTTPS.");
  const { data } = await db().auth.getSession();
  if (!data.session) throw new Error("Entre na sua conta para acessar a voz.");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + data.session.access_token,
      apikey: supabaseKey,
    },
    body: JSON.stringify({ channelId }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok)
    throw new Error(
      response.status === 503
        ? "O serviço de voz ainda não está configurado. Tente novamente após a configuração."
        : "Acesso à sala recusado ou serviço indisponível (" +
            response.status +
            ").",
    );
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== "object" ||
    !("token" in value) ||
    !("url" in value) ||
    typeof value.token !== "string" ||
    typeof value.url !== "string" ||
    !value.url.startsWith("wss://")
  )
    throw new Error("Resposta inválida do servidor de voz.");
  return { url: value.url, token: value.token };
}
export async function requestCallToken(
  callId: string,
  signal: AbortSignal,
) {
  const endpoint =
    import.meta.env.VITE_LIVEKIT_TOKEN_ENDPOINT ||
    (supabaseUrl
      ? supabaseUrl + "/functions/v1/livekit-token"
      : "");
  if (!endpoint)
    throw new Error(
      "Configure o endpoint seguro de tokens LiveKit para entrar na chamada.",
    );
  if (!endpoint.startsWith("https://"))
    throw new Error("O endpoint deve usar HTTPS.");
  const { data } = await db().auth.getSession();
  if (!data.session)
    throw new Error("Entre na sua conta para acessar a chamada.");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + data.session.access_token,
      apikey: supabaseKey,
    },
    body: JSON.stringify({ callId }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) {
    let errorDetail: string;
    try {
      const errJson = await response.json();
      errorDetail = typeof errJson?.error === "string" ? errJson.error : JSON.stringify(errJson);
    } catch {
      try {
        errorDetail = await response.text();
      } catch {
        errorDetail = "";
      }
    }
    if (response.status === 503) {
      throw new Error("O serviço de voz/vídeo ainda não está configurado. Tente novamente após a configuração.");
    }
    const message = errorDetail
      ? `Acesso à chamada recusado (${response.status}): ${errorDetail}`
      : `Acesso à chamada recusado ou serviço indisponível (${response.status}).`;
    throw new Error(message);
  }
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== "object" ||
    !("token" in value) ||
    !("url" in value) ||
    typeof value.token !== "string" ||
    typeof value.url !== "string" ||
    !value.url.startsWith("wss://")
  )
    throw new Error("Resposta inválida do servidor de chamada.");
  return { url: value.url, token: value.token };
}
export async function shareScreen(
  room: Room,
  quality: keyof typeof qualities,
  audio: boolean,
) {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: qualities[quality],
    audio,
  });
  const tracks: (LocalVideoTrack | LocalAudioTrack)[] = [];
  try {
    for (const raw of stream.getTracks()) {
      const track =
        raw.kind === "video"
          ? new LocalVideoTrack(raw)
          : new LocalAudioTrack(raw);
      tracks.push(track);
      await room.localParticipant.publishTrack(track, {
        source:
          raw.kind === "video"
            ? Track.Source.ScreenShare
            : Track.Source.ScreenShareAudio,
        simulcast: false,
        videoEncoding: {
          maxBitrate:
            quality === "144p10"
              ? 200000
              : quality === "240p15"
                ? 350000
                : quality === "360p15"
                  ? 700000
                  : quality === "480p30"
                    ? 1200000
                    : quality === "720p30"
                      ? 2500000
                      : quality === "1080p60"
                        ? 6000000
                        : 4000000,
          maxFramerate: qualities[quality]?.frameRate || 30,
        },
      });
    }
    const stop = () => {
      for (const track of tracks) {
        void room.localParticipant.unpublishTrack(track);
        track.stop();
        try {
          track.mediaStreamTrack?.stop();
        } catch {
          // Ignored
        }
      }
    };
    stream.getVideoTracks()[0]?.addEventListener("ended", stop, { once: true });
    return { stop, hasAudio: stream.getAudioTracks().length > 0, videoTrack: stream.getVideoTracks()[0] };
  } catch (e) {
    for (const t of tracks) {
      void room.localParticipant.unpublishTrack(t);
      t.stop();
    }
    stream.getTracks().forEach((t) => t.stop());
    throw e;
  }
}
