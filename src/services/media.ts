import { Room, Track, LocalAudioTrack, LocalVideoTrack } from "livekit-client";
import { db } from "../lib/supabase";
export const qualities = {
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
    (import.meta.env.VITE_SUPABASE_URL
      ? import.meta.env.VITE_SUPABASE_URL + "/functions/v1/livekit-token"
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
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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
            quality === "720p30"
              ? 2500000
              : quality === "1080p60"
                ? 6000000
                : 4000000,
          maxFramerate: qualities[quality].frameRate,
        },
      });
    }
    const stop = () => {
      for (const track of tracks) {
        void room.localParticipant.unpublishTrack(track);
        track.stop();
      }
    };
    stream.getVideoTracks()[0]?.addEventListener("ended", stop, { once: true });
    return { stop, hasAudio: stream.getAudioTracks().length > 0 };
  } catch (e) {
    for (const t of tracks) {
      void room.localParticipant.unpublishTrack(t);
      t.stop();
    }
    stream.getTracks().forEach((t) => t.stop());
    throw e;
  }
}
