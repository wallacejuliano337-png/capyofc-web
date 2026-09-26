import { audioSettings, useAudioSettings } from "../../services/audio-settings";
import { ScreenShares } from "./ScreenShares";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
type SidebarHosts = {
  controlsHost?: HTMLElement | null;
  membersHost?: HTMLElement | null;
};
import {
  Room,
  RoomEvent,
  ConnectionState,
  Track,
  type Participant,
} from "livekit-client";
import {
  RoomContext,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useIsSpeaking,
  useTrackMutedIndicator,
} from "@livekit/components-react";
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  MonitorUp,
  PhoneOff,
  Radio,
  Volume2,
} from "lucide-react";
import type { Channel, Source } from "../../types";
import { Avatar, ErrorNotice, Modal, useTask } from "../../components/ui";
import {
  requestVoiceToken,
  qualities,
  shareScreen,
} from "../../services/media";
import { VoiceSession } from "../../services/voice-session";
export function Voice({
  channel,
  visible,
  onLeave,
  controlsHost,
  membersHost,
}: {
  channel: Channel | null;
  visible: boolean;
  onLeave: () => void;
} & SidebarHosts) {
  const [room] = useState(
    () => new Room({ adaptiveStream: true, dynacast: true }),
  );
  return (
    <RoomContext.Provider value={room}>
      <div className={visible ? "voice-page" : "hidden"}>
        <VoiceRoom
          room={room}
          channel={channel}
          onLeave={onLeave}
          controlsHost={controlsHost}
          membersHost={membersHost}
        />
      </div>
    </RoomContext.Provider>
  );
}
function VoiceRoom({
  room,
  channel,
  onLeave,
  controlsHost,
  membersHost,
}: {
  room: Room;
  channel: Channel | null;
  onLeave: () => void;
} & SidebarHosts) {
  const preferences = useAudioSettings();
  useEffect(() => audioSettings.bind(room), [room]);
  const session = useMemo(
    () => new VoiceSession(room, requestVoiceToken),
    [room],
  );
  const [joining, setJoining] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [state, setState] = useState(room.state);
  const [deaf, setDeaf] = useState(false);
  const [sources, setSources] = useState<Source[] | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [quality, setQuality] = useState<keyof typeof qualities>("720p30");
  const [audio, setAudio] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState("");
  const stop = useRef<(() => void) | null>(null);
  const task = useTask();
  const connected = state === ConnectionState.Connected;
  useEffect(() => {
    let active = true;
    if (channel) {
      setJoining(true);
      setVoiceError("");
      setNotice("");
      setDeaf(false);
      void session
        .enter(channel.id)
        .then(async () => {
          if (!active) return;
          try {
            await room.startAudio();
            if (active && !room.canPlaybackAudio) {
              setDeaf(true);
              setNotice("Clique em Ativar áudio recebido para ouvir a sala.");
            }
          } catch {
            if (active) {
              setDeaf(true);
              setNotice("Clique em Ativar áudio recebido para ouvir a sala.");
            }
          }
        })
        .catch((error: unknown) => {
          if (active)
            setVoiceError(
              error instanceof Error
                ? error.message
                : "Não foi possível entrar na sala.",
            );
        })
        .finally(() => {
          if (active) setJoining(false);
        });
    } else {
      setVoiceError("");
      setNotice("");
      setJoining(false);
    }
    return () => {
      active = false;
      void session.leave().catch(() => {});
    };
  }, [channel?.id, room, session, attempt]);
  useEffect(() => {
    const update = (value: ConnectionState) => {
      setState(value);
      if (value === ConnectionState.Disconnected) {
        stop.current?.();
        stop.current = null;
        setSharing(false);
      }
    };
    room.on(RoomEvent.ConnectionStateChanged, update);
    const devicesChanged = () => {
      void navigator.mediaDevices
        .enumerateDevices()
        .then(setDevices)
        .catch(() => {});
    };
    devicesChanged();
    navigator.mediaDevices.addEventListener("devicechange", devicesChanged);
    return () => {
      room.off(RoomEvent.ConnectionStateChanged, update);
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        devicesChanged,
      );
      stop.current?.();
    };
  }, [room]);
  const start = async (source?: Source) => {
    if (source) await window.arena?.selectSource(source.id, audio);
    let result;
    let fallback = false;
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
        setQuality("720p30");
        fallback = true;
        setNotice("Fallback: captura reduzida para 720p / 30 FPS, sem áudio.");
      } else throw error;
    }
    stop.current = result.stop;
    setSharing(true);
    setSources(null);
    setNotice(
      fallback
        ? "Fallback: captura reduzida para 720p / 30 FPS, sem áudio."
        : audio && !result.hasAudio
          ? "A fonte não forneceu áudio. Compartilhando somente vídeo."
          : "",
    );
    const publication = localParticipant.getTrackPublication(
      Track.Source.ScreenShare,
    );
    publication?.track?.mediaStreamTrack.addEventListener(
      "ended",
      () => setSharing(false),
      { once: true },
    );
  };
  const audioControls = (
    <>
      <button
        title={isMicrophoneEnabled ? "Desativar microfone" : "Ativar microfone"}
        aria-pressed={!isMicrophoneEnabled}
        disabled={task.busy || joining}
        onClick={() =>
          void task.run(async () => {
            await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
            setDevices(await navigator.mediaDevices.enumerateDevices());
          })
        }
      >
        {isMicrophoneEnabled ? <Mic /> : <MicOff />}
      </button>
      <button
        title={deaf ? "Ativar áudio recebido" : "Desativar áudio recebido"}
        aria-pressed={deaf}
        onClick={() =>
          void task.run(async () => {
            await room.startAudio();
            setDeaf(!deaf);
            setNotice("");
          })
        }
      >
        {deaf ? <HeadphoneOff /> : <Headphones />}
      </button>
    </>
  );
  return (
    <>
      {connected && controlsHost && createPortal(audioControls, controlsHost)}
      {connected &&
        membersHost &&
        createPortal(
          participants.map((p) => (
            <VoiceParticipant key={p.identity} participant={p} compact />
          )),
          membersHost,
        )}
      <div className="page-heading">
        <div>
          <span className="eyebrow">SUA VOZ NA ARENA</span>
          <h1>{channel?.name || "Salas de voz"}</h1>
          <p className="muted">
            Converse com seu squad e compartilhe cada jogada.
          </p>
        </div>
        <span className="badge">
          <Radio size={13} />
          {joining || state === ConnectionState.Connecting
            ? "Conectando…"
            : connected
              ? "Conectado"
              : state === ConnectionState.Reconnecting ||
                  state === ConnectionState.SignalReconnecting
                ? "Reconectando…"
                : "Desconectado"}
        </span>
      </div>
      <ErrorNotice text={voiceError || task.error} />
      {notice && <p className="notice">{notice}</p>}
      {!connected ? (
        <div className="voice-welcome">
          <div className="voice-orbit">
            <Headphones size={45} />
          </div>
          <h2>O jogo fica melhor em equipe.</h2>
          <p className="muted">
            Entre na sala com o microfone desligado.
            <br />
            Você decide quando falar.
          </p>
          <button
            className="primary"
            disabled={!channel || joining || task.busy}
            onClick={() => setAttempt((value) => value + 1)}
          >
            {joining
              ? "Entrando…"
              : "Entrar em " + (channel?.name || "uma sala")}
          </button>
          {channel && (
            <button className="danger" onClick={onLeave}>
              Cancelar / sair da sala
            </button>
          )}
          <small>Requer Supabase e LiveKit configurados.</small>
        </div>
      ) : (
        <>
          <div className="participants">
            {participants.map((p) => (
              <VoiceParticipant key={p.identity} participant={p} />
            ))}
          </div>
          <ScreenShares key={channel?.id} />
          <div className="voice-controls">
            {audioControls}
            <button
              className={sharing ? "danger" : "primary"}
              disabled={task.busy}
              onClick={() => {
                if (sharing) {
                  stop.current?.();
                  setSharing(false);
                  return;
                }
                void task.run(async () => {
                  if (window.arena) setSources(await window.arena.sources());
                  else await start();
                });
              }}
            >
              <MonitorUp size={19} />
              {sharing ? "Parar transmissão" : "Compartilhar tela"}
            </button>
            <button
              className="danger"
              onClick={() =>
                void task.run(async () => {
                  stop.current?.();
                  onLeave();
                })
              }
              title="Sair da sala"
            >
              <PhoneOff />
            </button>
          </div>
          <div className="device-settings">
            <label>
              Microfone
              <select
                value={preferences.input}
                onChange={(e) =>
                  void task.run(async () => {
                    await audioSettings.select("audioinput", e.target.value);
                  })
                }
              >
                <option value="default">Padrão do sistema</option>
                {devices
                  .filter(
                    (d) => d.kind === "audioinput" && d.deviceId !== "default",
                  )
                  .map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "Microfone " + (i + 1)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Saída de áudio
              <select
                value={preferences.output}
                disabled={!("setSinkId" in HTMLMediaElement.prototype)}
                onChange={(e) =>
                  void task.run(async () => {
                    await audioSettings.select("audiooutput", e.target.value);
                  })
                }
              >
                <option value="default">Padrão do sistema</option>
                {devices
                  .filter(
                    (d) => d.kind === "audiooutput" && d.deviceId !== "default",
                  )
                  .map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "Saída " + (i + 1)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </>
      )}
      <RoomAudioRenderer muted={deaf} volume={preferences.volume} />
      {sources && (
        <Modal
          title="O que você quer compartilhar?"
          onClose={() => setSources(null)}
        >
          <ErrorNotice text={task.error} />
          <div className="button-row">
            <label>
              Qualidade
              <select
                value={quality}
                onChange={(e) =>
                  setQuality(e.target.value as keyof typeof qualities)
                }
              >
                <option value="720p30">720p / 30 FPS</option>
                <option value="1080p30">1080p / 30 FPS</option>
                <option value="1080p60">1080p / 60 FPS</option>
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={audio}
                onChange={(e) => setAudio(e.target.checked)}
              />
              <Volume2 size={16} /> Incluir áudio do sistema
            </label>
          </div>
          <p className="muted">
            O áudio inclui o sistema inteiro, mesmo ao selecionar uma janela.
            Use fones para evitar eco. Se houver falha, tente 720p sem áudio.
          </p>
          <div className="source-grid">
            {sources.map((s) => (
              <button
                disabled={task.busy}
                key={s.id}
                onClick={() => void task.run(() => start(s))}
              >
                <img src={s.thumbnail} alt="Prévia da fonte" />
                <span>{s.name}</span>
              </button>
            ))}
          </div>
          {!sources.length && (
            <p>Nenhuma fonte disponível. Feche e tente novamente.</p>
          )}
        </Modal>
      )}
    </>
  );
}

function VoiceParticipant({
  participant,
  compact = false,
}: {
  participant: Participant;
  compact?: boolean;
}) {
  const speaking = useIsSpeaking(participant);
  const { isMuted } = useTrackMutedIndicator({
    participant,
    source: Track.Source.Microphone,
  });
  let avatar: string | undefined;
  try {
    const value = JSON.parse(participant.metadata || "{}").avatar_url;
    if (typeof value === "string" && value.startsWith("https://"))
      avatar = value;
  } catch {
    /* Optional profile metadata. */
  }
  return (
    <div
      className={
        (compact ? "sidebar-voice-participant " : "participant ") +
        (speaking ? "speaking" : "")
      }
    >
      <Avatar
        userId={participant.identity}
        name={participant.name || "Membro"}
        url={avatar}
        size={compact ? 24 : 68}
      />
      <b>
        {participant.name || "Membro"}
        {participant.isLocal ? " (você)" : ""}
      </b>
      <small>
        {speaking
          ? "Falando"
          : isMuted || !participant.isMicrophoneEnabled
            ? "Microfone desligado"
            : "Microfone ativo"}
      </small>
    </div>
  );
}
