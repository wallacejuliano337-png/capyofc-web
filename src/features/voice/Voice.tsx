import { audioSettings, useAudioSettings } from "../../services/audio-settings";
import { ScreenShares } from "./ScreenShares";
import { ScreenShareModal } from "./ScreenShareModal";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
type SidebarHosts = {
  controlsHost?: HTMLElement | null;
  membersHost?: HTMLElement | null;
  callBarHost?: HTMLElement | null;
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
  VideoTrack,
  useParticipants,
  useLocalParticipant,
  useIsSpeaking,
  useTrackMutedIndicator,
  useTracks,
  type TrackReference,
  isTrackReference,
} from "@livekit/components-react";
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  MonitorUp,
  MonitorOff,
  PhoneOff,
  Radio,
  Video,
  VideoOff,
} from "lucide-react";
import type { Channel, Profile, Source } from "../../types";
import type { OpenUserProfile } from "../profile/UserProfilePopover";
import { Avatar, ErrorNotice, useTask } from "../../components/ui";
import {
  requestVoiceToken,
  qualities,
  shareScreen,
} from "../../services/media";
import { VoiceSession } from "../../services/voice-session";
export function Voice({
  channel,
  visible,
  profile,
  onLeave,
  onOpenStage,
  onVoiceStateChange,
  onUserProfile,
  controlsHost,
  membersHost,
  callBarHost,
}: {
  channel: Channel | null;
  visible: boolean;
  profile?: Profile | null;
  onLeave: () => void;
  onOpenStage?: () => void;
  onVoiceStateChange?: (state: { connected: boolean; joining: boolean; hasStream: boolean }) => void;
  onUserProfile?: OpenUserProfile;
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
          profile={profile}
          onLeave={onLeave}
          onOpenStage={onOpenStage}
          onVoiceStateChange={onVoiceStateChange}
          onUserProfile={onUserProfile}
          controlsHost={controlsHost}
          membersHost={membersHost}
          callBarHost={callBarHost}
        />
      </div>
    </RoomContext.Provider>
  );
}
function VoiceRoom({
  room,
  channel,
  profile,
  onLeave,
  onOpenStage,
  onVoiceStateChange,
  onUserProfile,
  controlsHost,
  membersHost,
  callBarHost,
}: {
  room: Room;
  channel: Channel | null;
  profile?: Profile | null;
  onLeave: () => void;
  onOpenStage?: () => void;
  onVoiceStateChange?: (state: { connected: boolean; joining: boolean; hasStream: boolean }) => void;
  onUserProfile?: OpenUserProfile;
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
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant();
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
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  const cameraTracks = useTracks([Track.Source.Camera]);
  const hasStream =
    screenTracks.length > 0 || participants.some((p) => p.isScreenShareEnabled);

  useEffect(() => {
    onVoiceStateChange?.({
      connected,
      joining,
      hasStream,
    });
  }, [connected, joining, hasStream, onVoiceStateChange]);
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
  const toggleScreenShare = () => {
    if (sharing) {
      stop.current?.();
      setSharing(false);
      return;
    }
    void task.run(async () => {
      if (window.arena) {
        setSources(await window.arena.sources());
      } else {
        await start();
      }
    });
  };

  const toggleCamera = () => {
    void task.run(async () => {
      try {
        setNotice("");
        if (isCameraEnabled) {
          await localParticipant.setCameraEnabled(false);
          return;
        }

        const freshDevices = await navigator.mediaDevices
          .enumerateDevices()
          .catch(() => []);
        const hasCamera = freshDevices.some((d) => d.kind === "videoinput");
        if (!hasCamera) {
          setNotice("Câmera não encontrada.");
          return;
        }

        await localParticipant.setCameraEnabled(true);
      } catch (err: unknown) {
        console.warn("Failed to toggle camera:", err);
        const name = err instanceof DOMException ? err.name : "";
        const message =
          err instanceof Error
            ? err.message.toLowerCase()
            : String(err).toLowerCase();

        if (
          name === "NotFoundError" ||
          name === "DevicesNotFoundError" ||
          message.includes("not found") ||
          message.includes("notfound")
        ) {
          setNotice("Câmera não encontrada.");
        } else if (
          name === "NotAllowedError" ||
          name === "PermissionDeniedError" ||
          message.includes("permission") ||
          message.includes("denied")
        ) {
          setNotice("Não foi possível acessar sua câmera.");
        } else {
          setNotice("Não foi possível acessar sua câmera.");
        }
      }
    });
  };

  const getParticipantCameraTrack = (
    p: Participant,
  ): TrackReference | undefined => {
    const fromTracks = cameraTracks.find(
      (t) => t.participant.identity === p.identity && !t.publication?.isMuted,
    );
    if (
      fromTracks &&
      isTrackReference(fromTracks) &&
      fromTracks.publication?.track
    ) {
      return fromTracks;
    }
    const pub = p.getTrackPublication(Track.Source.Camera);
    if (pub?.track && !pub.isMuted) {
      return {
        participant: p,
        publication: pub,
        source: Track.Source.Camera,
      };
    }
    return fromTracks && isTrackReference(fromTracks) ? fromTracks : undefined;
  };

  const callBarActions = (
    <>
      <button
        type="button"
        className={
          "voice-panel-btn camera-btn " + (isCameraEnabled ? "active" : "")
        }
        title={isCameraEnabled ? "Desligar câmera" : "Ligar câmera"}
        aria-label={isCameraEnabled ? "Desligar câmera" : "Ligar câmera"}
        disabled={task.busy || !connected}
        onClick={toggleCamera}
      >
        {isCameraEnabled ? <Video size={16} /> : <VideoOff size={16} />}
      </button>
      <button
        type="button"
        className={"voice-panel-btn share-btn " + (sharing ? "active" : "")}
        title={sharing ? "Parar transmissão" : "Compartilhar tela"}
        aria-label={sharing ? "Parar transmissão" : "Compartilhar tela"}
        disabled={task.busy || !connected}
        onClick={toggleScreenShare}
      >
        {sharing ? <MonitorOff size={16} /> : <MonitorUp size={16} />}
      </button>
      <button
        type="button"
        className="voice-panel-btn disconnect-btn"
        title="Desconectar"
        aria-label="Desconectar"
        disabled={task.busy}
        onClick={() => {
          stop.current?.();
          onLeave();
        }}
      >
        <PhoneOff size={16} />
      </button>
    </>
  );

  const callControlsSection = (
    <>
      <div className="voice-controls">
        {audioControls}
        <button
          type="button"
          className={isCameraEnabled ? "active" : ""}
          disabled={task.busy || !connected}
          onClick={toggleCamera}
          title={isCameraEnabled ? "Desligar câmera" : "Ligar câmera"}
        >
          {isCameraEnabled ? <Video size={19} /> : <VideoOff size={19} />}
          <span>{isCameraEnabled ? "Desligar câmera" : "Ligar câmera"}</span>
        </button>
        <button
          className={sharing ? "danger" : "primary"}
          disabled={task.busy}
          onClick={toggleScreenShare}
        >
          {sharing ? <MonitorOff size={19} /> : <MonitorUp size={19} />}
          <span>{sharing ? "Parar transmissão" : "Compartilhar tela"}</span>
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
        {devices.some((d) => d.kind === "videoinput") && (
          <label>
            Câmera
            <select
              value={preferences.video || "default"}
              onChange={(e) =>
                void task.run(async () => {
                  await audioSettings.select("videoinput", e.target.value);
                })
              }
            >
              <option value="default">Padrão do sistema</option>
              {devices
                .filter(
                  (d) => d.kind === "videoinput" && d.deviceId !== "default",
                )
                .map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || "Câmera " + (i + 1)}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
    </>
  );

  return (
    <>
      {connected && controlsHost && createPortal(audioControls, controlsHost)}
      {channel && callBarHost && createPortal(callBarActions, callBarHost)}
      {joining &&
        !connected &&
        membersHost &&
        createPortal(
          <div className="sidebar-voice-participant connecting">
            <button
              type="button"
              className="sidebar-voice-user-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (profile?.id)
                  onUserProfile?.(profile.id, e.currentTarget, profile);
              }}
              title="Ver seu perfil"
            >
              <Avatar
                userId={profile?.id || "local"}
                name={profile?.display_name || profile?.username || "Você"}
                url={profile?.avatar_url || undefined}
                size={24}
              />
              <div className="sidebar-voice-details">
                <span className="sidebar-voice-name">
                  {profile?.display_name || profile?.username || "Você"} (você)
                </span>
                <span className="sidebar-voice-connecting-label">
                  conectando…
                </span>
              </div>
            </button>
          </div>,
          membersHost,
        )}
      {connected &&
        membersHost &&
        createPortal(
          participants.map((p) => {
            const isSharing =
              screenTracks.some((t) => t.participant.identity === p.identity) ||
              Boolean(p.isScreenShareEnabled);
            return (
              <VoiceParticipant
                key={p.identity}
                participant={p}
                compact
                isSharing={isSharing}
                onWatch={onOpenStage}
                onUserProfile={onUserProfile}
                localProfile={profile}
              />
            );
          }),
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
        <div className="voice-connecting-stage">
          {joining ? (
            <>
              <div className="voice-connecting-spinner" />
              <h2>Conectando à sala de voz…</h2>
              <p className="muted">
                Entrando em <b>{channel?.name || "sala de voz"}</b>. Aguarde um momento.
              </p>
              {channel && (
                <button className="secondary" onClick={onLeave}>
                  Cancelar
                </button>
              )}
            </>
          ) : channel ? (
            <>
              <Headphones size={42} className="muted" />
              <h2>Pronto para entrar</h2>
              <p className="muted">
                Conecte-se a <b>{channel.name}</b> para conversar e transmitir.
              </p>
              <button
                className="primary"
                disabled={task.busy}
                onClick={() => setAttempt((value) => value + 1)}
              >
                Conectar agora
              </button>
            </>
          ) : (
            <>
              <Headphones size={42} className="muted" />
              <h2>Nenhuma sala selecionada</h2>
              <p className="muted">
                Selecione uma sala de voz na barra lateral para começar a conversar.
              </p>
            </>
          )}
        </div>
      ) : hasStream ? (
        <div className="voice-stage-layout">
          <aside
            className="voice-stage-participants"
            aria-label="Participantes da chamada"
          >
            <div className="voice-stage-participants-header">
              <span>Participantes</span>
              <span className="voice-stage-participants-count">
                {participants.length}
              </span>
            </div>
            <div className="voice-stage-participants-list">
              {participants.map((p) => {
                const isSharing =
                  screenTracks.some(
                    (t) => t.participant.identity === p.identity,
                  ) || Boolean(p.isScreenShareEnabled);
                const camTrack = getParticipantCameraTrack(p);
                return (
                  <StageParticipant
                    key={p.identity}
                    participant={p}
                    isSharing={isSharing}
                    cameraTrack={camTrack}
                    onUserProfile={onUserProfile}
                    localProfile={profile}
                  />
                );
              })}
            </div>
          </aside>

          <section className="voice-stage-content">
            <div className="voice-stage-screen-area">
              <ScreenShares key={channel?.id} />
            </div>

            {callControlsSection}
          </section>
        </div>
      ) : (
        <div className="voice-call-stage">
          <div className="voice-call-grid-area">
            <div
              className={`voice-grid-container count-${Math.min(participants.length, 6)}`}
            >
              {participants.map((p) => {
                const camTrack = getParticipantCameraTrack(p);
                return (
                  <VoiceGridParticipant
                    key={p.identity}
                    participant={p}
                    isSingle={participants.length === 1}
                    cameraTrack={camTrack}
                    onUserProfile={onUserProfile}
                    localProfile={profile}
                  />
                );
              })}
            </div>
          </div>

          {callControlsSection}
        </div>
      )}
      <RoomAudioRenderer muted={deaf} volume={preferences.volume} />
      {sources &&
        typeof document !== "undefined" &&
        document.body &&
        createPortal(
          <ScreenShareModal
            isOpen={Boolean(sources)}
            onClose={() => setSources(null)}
            sources={sources}
            quality={quality}
            onQualityChange={setQuality}
            audio={audio}
            onAudioChange={setAudio}
            onSelectSource={(s) => task.run(() => start(s))}
            busy={task.busy}
            error={task.error}
          />,
          document.body,
        )}
    </>
  );
}

function VoiceParticipant({
  participant,
  compact = false,
  isSharing = false,
  onWatch,
  onUserProfile,
  localProfile,
}: {
  participant: Participant;
  compact?: boolean;
  isSharing?: boolean;
  onWatch?: () => void;
  onUserProfile?: OpenUserProfile;
  localProfile?: Profile | null;
}) {
  const speaking = useIsSpeaking(participant);
  let avatar: string | undefined;
  try {
    const value = JSON.parse(participant.metadata || "{}").avatar_url;
    if (typeof value === "string" && value.startsWith("https://"))
      avatar = value;
  } catch {
    /* Optional profile metadata. */
  }
  if (
    !avatar &&
    (participant.isLocal || participant.identity === localProfile?.id)
  ) {
    avatar = localProfile?.avatar_url || undefined;
  }

  const name =
    participant.name ||
    (participant.isLocal
      ? localProfile?.display_name || localProfile?.username
      : "") ||
    "Membro";

  const handleOpenProfile = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    onUserProfile?.(
      participant.identity,
      e.currentTarget,
      participant.isLocal || participant.identity === localProfile?.id
        ? localProfile || undefined
        : undefined,
    );
  };

  if (compact) {
    return (
      <div
        className={
          "sidebar-voice-participant " +
          (speaking ? "speaking " : "") +
          (isSharing ? "is-sharing" : "")
        }
      >
        <button
          type="button"
          className="sidebar-voice-user-btn"
          onClick={handleOpenProfile}
          title={"Ver perfil de " + name}
        >
          <Avatar
            userId={participant.identity}
            name={name}
            url={avatar}
            size={24}
          />
          <div className="sidebar-voice-details">
            <span className="sidebar-voice-name">
              {name}
              {participant.isLocal ? " (você)" : ""}
            </span>
          </div>
        </button>
        {isSharing && (
          <span
            className="sidebar-voice-live-indicator"
            onClick={(e) => {
              e.stopPropagation();
              onWatch?.();
            }}
            title="Transmitindo tela — Clique para assistir"
            style={{ cursor: "pointer" }}
          >
            <span className="sidebar-voice-live-dot" />
            <span>AO VIVO</span>
          </span>
        )}
      </div>
    );
  }
  return null;
}

function StageParticipant({
  participant,
  isSharing = false,
  cameraTrack,
  onUserProfile,
  localProfile,
}: {
  participant: Participant;
  isSharing?: boolean;
  cameraTrack?: TrackReference;
  onUserProfile?: OpenUserProfile;
  localProfile?: Profile | null;
}) {
  const speaking = useIsSpeaking(participant);
  const { isMuted } = useTrackMutedIndicator({
    participant,
    source: Track.Source.Microphone,
  });
  const hasCamera = Boolean(
    cameraTrack && cameraTrack.publication && !cameraTrack.publication.isMuted,
  );
  let avatar: string | undefined;
  try {
    const value = JSON.parse(participant.metadata || "{}").avatar_url;
    if (typeof value === "string" && value.startsWith("https://"))
      avatar = value;
  } catch {
    /* Optional profile metadata. */
  }
  if (
    !avatar &&
    (participant.isLocal || participant.identity === localProfile?.id)
  ) {
    avatar = localProfile?.avatar_url || undefined;
  }

  const name =
    participant.name ||
    (participant.isLocal
      ? localProfile?.display_name || localProfile?.username
      : "") ||
    "Membro";

  const handleOpenProfile = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    onUserProfile?.(
      participant.identity,
      e.currentTarget,
      participant.isLocal || participant.identity === localProfile?.id
        ? localProfile || undefined
        : undefined,
    );
  };

  return (
    <div
      className={
        "voice-column-card " +
        (speaking ? "speaking " : "") +
        (isSharing ? "is-sharing " : "") +
        (hasCamera ? "has-camera" : "")
      }
    >
      <div className="voice-column-avatar-wrapper">
        {hasCamera && cameraTrack ? (
          <div
            className="voice-column-video-wrapper"
            onClick={handleOpenProfile}
            title={"Ver perfil de " + name}
          >
            <VideoTrack
              trackRef={cameraTrack}
              autoPlay
              playsInline
              className={
                "voice-participant-video " +
                (participant.isLocal ? "local" : "")
              }
            />
          </div>
        ) : (
          <button
            type="button"
            className="voice-column-avatar-btn"
            onClick={handleOpenProfile}
            title={"Ver perfil de " + name}
          >
            <Avatar
              userId={participant.identity}
              name={name}
              url={avatar}
              size={38}
            />
          </button>
        )}
      </div>
      <button
        type="button"
        className="voice-column-name-btn"
        onClick={handleOpenProfile}
        title={"Ver perfil de " + name}
      >
        <span>
          {name}
          {participant.isLocal ? " (você)" : ""}
        </span>
      </button>
      <div className="voice-column-badges">
        {isSharing && (
          <span className="voice-column-live-badge">
            <span className="live-dot-pulse" />
            AO VIVO
          </span>
        )}
        <span
          className={
            "voice-column-mic-badge " +
            (isMuted || !participant.isMicrophoneEnabled
              ? "muted"
              : speaking
                ? "speaking"
                : "active")
          }
          title={
            isMuted || !participant.isMicrophoneEnabled
              ? "Microfone desligado"
              : speaking
                ? "Falando"
                : "Microfone ativo"
          }
        >
          {isMuted || !participant.isMicrophoneEnabled ? (
            <MicOff size={12} />
          ) : (
            <Mic size={12} />
          )}
        </span>
      </div>
    </div>
  );
}

function VoiceGridParticipant({
  participant,
  isSingle,
  cameraTrack,
  onUserProfile,
  localProfile,
}: {
  participant: Participant;
  isSingle: boolean;
  cameraTrack?: TrackReference;
  onUserProfile?: OpenUserProfile;
  localProfile?: Profile | null;
}) {
  const speaking = useIsSpeaking(participant);
  const { isMuted } = useTrackMutedIndicator({
    participant,
    source: Track.Source.Microphone,
  });
  const hasCamera = Boolean(
    cameraTrack && cameraTrack.publication && !cameraTrack.publication.isMuted,
  );
  let avatar: string | undefined;
  try {
    const value = JSON.parse(participant.metadata || "{}").avatar_url;
    if (typeof value === "string" && value.startsWith("https://"))
      avatar = value;
  } catch {
    /* Optional profile metadata. */
  }
  if (
    !avatar &&
    (participant.isLocal || participant.identity === localProfile?.id)
  ) {
    avatar = localProfile?.avatar_url || undefined;
  }

  const name =
    participant.name ||
    (participant.isLocal
      ? localProfile?.display_name || localProfile?.username
      : "") ||
    "Membro";

  const handleOpenProfile = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    onUserProfile?.(
      participant.identity,
      e.currentTarget,
      participant.isLocal || participant.identity === localProfile?.id
        ? localProfile || undefined
        : undefined,
    );
  };

  const avatarSize = isSingle ? 88 : 72;

  return (
    <div
      className={
        "voice-grid-card " +
        (speaking ? "speaking " : "") +
        (isSingle ? "single " : "") +
        (hasCamera ? "has-camera" : "")
      }
    >
      <div className="voice-grid-avatar-wrapper">
        {hasCamera && cameraTrack ? (
          <div
            className="voice-grid-video-wrapper"
            onClick={handleOpenProfile}
            title={"Ver perfil de " + name}
          >
            <VideoTrack
              trackRef={cameraTrack}
              autoPlay
              playsInline
              className={
                "voice-participant-video " +
                (participant.isLocal ? "local" : "")
              }
            />
          </div>
        ) : (
          <button
            type="button"
            className="voice-grid-avatar-btn"
            onClick={handleOpenProfile}
            title={"Ver perfil de " + name}
          >
            <Avatar
              userId={participant.identity}
              name={name}
              url={avatar}
              size={avatarSize}
            />
          </button>
        )}
      </div>

      <button
        type="button"
        className="voice-grid-name-btn"
        onClick={handleOpenProfile}
        title={"Ver perfil de " + name}
      >
        <span>
          {name}
          {participant.isLocal ? " (você)" : ""}
        </span>
      </button>

      <div className="voice-grid-status">
        <span
          className={
            "voice-grid-mic-badge " +
            (isMuted || !participant.isMicrophoneEnabled
              ? "muted"
              : speaking
                ? "speaking"
                : "active")
          }
          title={
            isMuted || !participant.isMicrophoneEnabled
              ? "Microfone desligado"
              : speaking
                ? "Falando"
                : "Microfone ativo"
          }
        >
          {isMuted || !participant.isMicrophoneEnabled ? (
            <MicOff size={16} />
          ) : (
            <Mic size={16} />
          )}
        </span>
      </div>
    </div>
  );
}
