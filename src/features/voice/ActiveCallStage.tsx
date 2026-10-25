import {
  RoomContext,
  RoomAudioRenderer,
  useTracks,
  useIsSpeaking,
  useTrackMutedIndicator,
  useRemoteParticipants,
  VideoTrack,
  isTrackReference,
  type TrackReference,
} from "@livekit/components-react";
import { Room, Track, type Participant } from "livekit-client";
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  MonitorUp,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Maximize,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Avatar } from "../../components/ui";
import type { Profile, Source } from "../../types";
import type { OpenUserProfile } from "../profile/UserProfilePopover";
import {
  formatCallDuration,
  type CallStatus,
  type DMCall,
} from "../../services/dm-calls";
import { qualities } from "../../services/media";
import { ScreenShareModal } from "./ScreenShareModal";
import "./dm-calls.css";

export function ActiveCallStage({
  room,
  call,
  peer,
  callStatus,
  duration,
  isMicEnabled,
  isCameraEnabled,
  isScreenSharing,
  isDeafened,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onStartScreenShare,
  onToggleDeafened,
  onEndCall,
  onUserProfile,
  localProfile,
}: {
  room?: Room | null;
  call: DMCall;
  peer: Profile;
  callStatus: CallStatus;
  duration: number;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onStartScreenShare?: (
    source?: Source,
    quality?: keyof typeof qualities,
    audio?: boolean,
  ) => Promise<void>;
  onToggleDeafened: () => void;
  onEndCall: () => void;
  onUserProfile?: OpenUserProfile;
  localProfile?: Profile | null;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // If in collapsed state (Requirement 10)
  if (isCollapsed) {
    const collapsedBar = (
      <CollapsedCallBar
        peer={peer}
        callStatus={callStatus}
        duration={duration}
        isMicEnabled={isMicEnabled}
        isDeafened={isDeafened}
        onToggleMic={onToggleMic}
        onToggleDeafened={onToggleDeafened}
        onEndCall={onEndCall}
        onExpand={() => setIsCollapsed(false)}
      />
    );

    if (room) {
      return (
        <RoomContext.Provider value={room}>
          <RoomAudioRenderer muted={isDeafened} />
          {collapsedBar}
        </RoomContext.Provider>
      );
    }
    return collapsedBar;
  }

  // Pre-call stage (Requirement 1: calling / connecting before LiveKit connects, or failed)
  if (
    !room ||
    callStatus === "calling" ||
    callStatus === "ringing" ||
    callStatus === "connecting" ||
    callStatus === "failed"
  ) {
    return (
      <PreCallStage
        peer={peer}
        callStatus={callStatus}
        isMicEnabled={isMicEnabled}
        isDeafened={isDeafened}
        isCameraEnabled={isCameraEnabled}
        onToggleMic={onToggleMic}
        onToggleDeafened={onToggleDeafened}
        onToggleCamera={onToggleCamera}
        onEndCall={onEndCall}
        onCollapse={() => setIsCollapsed(true)}
      />
    );
  }

  // Connected call stage (Requirement 2, 5, 6, 7)
  return (
    <RoomContext.Provider value={room}>
      <RoomAudioRenderer muted={isDeafened} />
      <ActiveCallContent
        room={room}
        call={call}
        peer={peer}
        callStatus={callStatus}
        duration={duration}
        isMicEnabled={isMicEnabled}
        isCameraEnabled={isCameraEnabled}
        isScreenSharing={isScreenSharing}
        isDeafened={isDeafened}
        onToggleMic={onToggleMic}
        onToggleCamera={onToggleCamera}
        onToggleScreenShare={onToggleScreenShare}
        onStartScreenShare={onStartScreenShare}
        onToggleDeafened={onToggleDeafened}
        onEndCall={onEndCall}
        onUserProfile={onUserProfile}
        localProfile={localProfile}
        onCollapse={() => setIsCollapsed(true)}
      />
    </RoomContext.Provider>
  );
}

function CollapsedCallBar({
  peer,
  callStatus,
  duration,
  isMicEnabled,
  isDeafened,
  onToggleMic,
  onToggleDeafened,
  onEndCall,
  onExpand,
}: {
  peer: Profile;
  callStatus: CallStatus;
  duration: number;
  isMicEnabled: boolean;
  isDeafened: boolean;
  onToggleMic: () => void;
  onToggleDeafened: () => void;
  onEndCall: () => void;
  onExpand: () => void;
}) {
  return (
    <div
      className="active-call-stage collapsed"
      onClick={onExpand}
      role="region"
      aria-label="Chamada em andamento (recolhida)"
    >
      <div className="call-collapsed-bar">
        <div className="call-collapsed-left">
          <span className="call-collapsed-dot" />
          <Avatar
            userId={peer.id}
            name={peer.display_name}
            url={peer.avatar_url}
            size={24}
          />
          <span className="call-collapsed-text">
            {callStatus === "connected"
              ? `Em chamada com ${peer.display_name}`
              : `Chamando ${peer.display_name}...`}
          </span>
          {callStatus === "connected" && (
            <span className="call-collapsed-duration">
              • {formatCallDuration(duration)}
            </span>
          )}
        </div>

        <div
          className="call-collapsed-right"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`call-ctrl-btn compact ${!isMicEnabled ? "off" : ""}`}
            onClick={onToggleMic}
            title={isMicEnabled ? "Desativar microfone" : "Ativar microfone"}
            aria-label={isMicEnabled ? "Desativar microfone" : "Ativar microfone"}
          >
            {isMicEnabled ? <Mic size={15} /> : <MicOff size={15} />}
          </button>
          <button
            type="button"
            className={`call-ctrl-btn compact ${isDeafened ? "off" : ""}`}
            onClick={onToggleDeafened}
            title={isDeafened ? "Ativar áudio" : "Desativar áudio"}
            aria-label={isDeafened ? "Ativar áudio" : "Desativar áudio"}
          >
            {isDeafened ? <HeadphoneOff size={15} /> : <Headphones size={15} />}
          </button>
          <button
            type="button"
            className="call-ctrl-btn compact end-call"
            onClick={onEndCall}
            title="Encerrar chamada"
            aria-label="Encerrar chamada"
          >
            <PhoneOff size={15} />
          </button>
          <button
            type="button"
            className="call-collapsed-expand-btn"
            onClick={onExpand}
            title="Expandir chamada"
            aria-label="Expandir chamada"
          >
            <ChevronDown size={14} />
            <span>Expandir</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PreCallStage({
  peer,
  callStatus,
  isMicEnabled,
  isDeafened,
  isCameraEnabled,
  onToggleMic,
  onToggleDeafened,
  onToggleCamera,
  onEndCall,
  onCollapse,
}: {
  peer: Profile;
  callStatus: CallStatus;
  isMicEnabled: boolean;
  isDeafened: boolean;
  isCameraEnabled: boolean;
  onToggleMic: () => void;
  onToggleDeafened: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
  onCollapse: () => void;
}) {
  return (
    <div className="active-call-stage pre-call">
      {/* Top Header Bar */}
      <div className="call-stage-header-bar">
        <div className="call-stage-status">
          <span className={`status-badge ${callStatus}`}>
            {callStatus === "calling"
              ? "Chamando..."
              : callStatus === "failed"
                ? "Falha na chamada"
                : "Conectando..."}
          </span>
        </div>
        <button
          type="button"
          className="call-collapse-toggle-btn"
          onClick={onCollapse}
          title="Recolher chamada"
          aria-label="Recolher chamada"
        >
          <ChevronUp size={14} />
          <span>Recolher</span>
        </button>
      </div>

      {/* Main Pre-call view */}
      <div className="pre-call-container">
        <div className="pre-call-avatar-wrapper">
          <div className="pre-call-pulse-ring" />
          <Avatar
            userId={peer.id}
            name={peer.display_name}
            url={peer.avatar_url}
            size={80}
          />
        </div>
        <h3 className="pre-call-name">{peer.display_name}</h3>
        <span className="pre-call-user">@{peer.username}</span>
        <span className={`pre-call-status-badge ${callStatus}`}>
          {callStatus === "calling"
            ? "Chamando..."
            : callStatus === "failed"
              ? "Falha na chamada"
              : "Conectando..."}
        </span>
      </div>

      {/* Bottom Controls Bar */}
      <footer className="call-controls-bar">
        <button
          type="button"
          className={`call-ctrl-btn ${!isMicEnabled ? "off" : ""}`}
          onClick={onToggleMic}
          title={isMicEnabled ? "Desativar microfone" : "Ativar microfone"}
          aria-label={isMicEnabled ? "Desativar microfone" : "Ativar microfone"}
        >
          {isMicEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        </button>

        <button
          type="button"
          className={`call-ctrl-btn ${isDeafened ? "off" : ""}`}
          onClick={onToggleDeafened}
          title={isDeafened ? "Ativar áudio" : "Desativar áudio"}
          aria-label={isDeafened ? "Ativar áudio" : "Desativar áudio"}
        >
          {isDeafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
        </button>

        <button
          type="button"
          className={`call-ctrl-btn ${isCameraEnabled ? "active-video" : ""}`}
          onClick={onToggleCamera}
          title={isCameraEnabled ? "Desativar câmera" : "Ativar câmera"}
          aria-label={isCameraEnabled ? "Desativar câmera" : "Ativar câmera"}
        >
          {isCameraEnabled ? <VideoIcon size={18} /> : <VideoOff size={18} />}
        </button>

        <button
          type="button"
          className="call-ctrl-btn end-call"
          onClick={onEndCall}
          title="Cancelar chamada"
          aria-label="Cancelar chamada"
        >
          <PhoneOff size={18} />
        </button>
      </footer>
    </div>
  );
}

function ActiveCallContent({
  room,
  call: _call,
  peer,
  callStatus: _callStatus,
  duration,
  isMicEnabled,
  isCameraEnabled,
  isScreenSharing,
  isDeafened,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onStartScreenShare,
  onToggleDeafened,
  onEndCall,
  onUserProfile,
  localProfile,
  onCollapse,
}: {
  room: Room;
  call: DMCall;
  peer: Profile;
  callStatus: CallStatus;
  duration: number;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onStartScreenShare?: (
    source?: Source,
    quality?: keyof typeof qualities,
    audio?: boolean,
  ) => Promise<void>;
  onToggleDeafened: () => void;
  onEndCall: () => void;
  onUserProfile?: OpenUserProfile;
  localProfile?: Profile | null;
  onCollapse: () => void;
}) {
  const cameraTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  });
  const screenTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: false,
  });

  // Modal screen share state
  const [sources, setSources] = useState<Source[] | null>(null);
  const [shareQuality, setShareQuality] =
    useState<keyof typeof qualities>("720p30");
  const [shareAudio, setShareAudio] = useState(true);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");

  const localParticipant = room.localParticipant;
  const remoteParticipants = useRemoteParticipants();
  const remoteParticipant =
    remoteParticipants[0] || Array.from(room.remoteParticipants.values())[0];

  const hasScreenShare = screenTracks.length > 0;
  const primaryScreen = screenTracks[0];

  const handleFullscreen = async (el: HTMLElement | null) => {
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // Ignored
    }
  };

  const handleOpenScreenShare = async () => {
    if (isScreenSharing) {
      onToggleScreenShare();
      return;
    }
    if (window.arena) {
      try {
        setShareBusy(true);
        setShareError("");
        const list = await window.arena.sources();
        setSources(list);
      } catch {
        setShareError("Não foi possível listar janelas e telas.");
      } finally {
        setShareBusy(false);
      }
    } else {
      if (onStartScreenShare) {
        void onStartScreenShare();
      } else {
        onToggleScreenShare();
      }
    }
  };

  const handleSelectSource = async (source: Source) => {
    try {
      setShareBusy(true);
      setShareError("");
      if (onStartScreenShare) {
        await onStartScreenShare(source, shareQuality, shareAudio);
      } else {
        onToggleScreenShare();
      }
      setSources(null);
    } catch (err) {
      setShareError(
        err instanceof Error
          ? err.message
          : "Falha ao iniciar compartilhamento de tela.",
      );
    } finally {
      setShareBusy(false);
    }
  };

  // Find camera tracks for participants
  const localCamTrack = cameraTracks.find(
    (t) => t.participant.isLocal && !t.publication?.isMuted,
  );
  const remoteCamTrack = cameraTracks.find(
    (t) => !t.participant.isLocal && !t.publication?.isMuted,
  );

  const hasLocalCam = Boolean(
    localCamTrack &&
      isTrackReference(localCamTrack) &&
      localCamTrack.publication &&
      !localCamTrack.publication.isMuted &&
      localCamTrack.publication.track,
  );
  const hasRemoteCam = Boolean(
    remoteCamTrack &&
      isTrackReference(remoteCamTrack) &&
      remoteCamTrack.publication &&
      !remoteCamTrack.publication.isMuted &&
      remoteCamTrack.publication.track,
  );

  let gridClass = "call-participants-grid";
  if (hasLocalCam && hasRemoteCam) {
    gridClass += " dual-cam";
  } else if (hasLocalCam && !hasRemoteCam) {
    gridClass += " single-cam-local";
  } else if (!hasLocalCam && hasRemoteCam) {
    gridClass += " single-cam-remote";
  } else {
    gridClass += " no-cameras";
  }

  return (
    <div className="active-call-stage">
      {/* Call Header / Status Indicator & Collapse button */}
      <div className="call-stage-header-bar">
        <div className="call-stage-status">
          <span className="status-badge connected">
            ● Conectado • {formatCallDuration(duration)}
          </span>
        </div>
        <button
          type="button"
          className="call-collapse-toggle-btn"
          onClick={onCollapse}
          title="Recolher chamada"
          aria-label="Recolher chamada"
        >
          <ChevronUp size={14} />
          <span>Recolher</span>
        </button>
      </div>

      {/* Main View Area */}
      <div className="call-stage-body">
        {hasScreenShare && primaryScreen ? (
          /* Screen Sharing Highlight View (Requirement 7) */
          <div className="call-sharing-stage">
            <div className="call-sharing-main">
              <div className="call-sharing-overlay-header">
                <span className="call-sharing-tag">
                  <span className="live-dot">AO VIVO</span>
                  <span>
                    {primaryScreen.participant.isLocal
                      ? "Sua tela"
                      : primaryScreen.participant.name || peer.display_name}
                  </span>
                </span>
                <button
                  type="button"
                  className="call-sharing-fullscreen-btn"
                  title="Tela cheia"
                  aria-label="Tela cheia"
                  onClick={(e) =>
                    void handleFullscreen(
                      e.currentTarget.closest(".call-sharing-main"),
                    )
                  }
                >
                  <Maximize size={16} />
                </button>
              </div>
              <VideoTrack
                trackRef={primaryScreen}
                autoPlay
                playsInline
                muted={primaryScreen.participant.isLocal}
              />
            </div>

            {/* Compact Participants Strip below Screen Share */}
            <div className="call-sharing-participants-strip">
              <ParticipantCard
                key="local-compact"
                participant={localParticipant}
                profile={localProfile}
                displayName={localProfile?.display_name || "Você"}
                username={localProfile?.username}
                avatarUrl={localProfile?.avatar_url}
                isLocal
                isMicEnabled={isMicEnabled}
                cameraTrack={localCamTrack}
                compact
                onUserProfile={onUserProfile}
              />
              <ParticipantCard
                key="remote-compact"
                participant={remoteParticipant}
                profile={peer}
                displayName={peer.display_name}
                username={peer.username}
                avatarUrl={peer.avatar_url}
                isLocal={false}
                isMicEnabled={true}
                cameraTrack={remoteCamTrack}
                compact
                onUserProfile={onUserProfile}
              />
            </div>
          </div>
        ) : (
          /* Participant Cards (Requirement 5 & 6) */
          <div className={gridClass}>
            {/* Card 1: Local User (e.g. Coronel) */}
            <ParticipantCard
              key="local-main"
              participant={localParticipant}
              profile={localProfile}
              displayName={localProfile?.display_name || "Você"}
              username={localProfile?.username}
              avatarUrl={localProfile?.avatar_url}
              isLocal
              isMicEnabled={isMicEnabled}
              cameraTrack={localCamTrack}
              compact={false}
              onUserProfile={onUserProfile}
            />

            {/* Card 2: Remote Peer (e.g. Naori) */}
            <ParticipantCard
              key="remote-main"
              participant={remoteParticipant}
              profile={peer}
              displayName={peer.display_name}
              username={peer.username}
              avatarUrl={peer.avatar_url}
              isLocal={false}
              isMicEnabled={true}
              cameraTrack={remoteCamTrack}
              compact={false}
              onUserProfile={onUserProfile}
            />
          </div>
        )}
      </div>

      {/* Bottom Controls Bar (Requirement 4) */}
      <footer className="call-controls-bar">
        <button
          type="button"
          className={`call-ctrl-btn ${!isMicEnabled ? "off" : ""}`}
          onClick={onToggleMic}
          title={isMicEnabled ? "Desativar microfone" : "Ativar microfone"}
          aria-label={isMicEnabled ? "Desativar microfone" : "Ativar microfone"}
        >
          {isMicEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        </button>

        <button
          type="button"
          className={`call-ctrl-btn ${isDeafened ? "off" : ""}`}
          onClick={onToggleDeafened}
          title={isDeafened ? "Ativar áudio" : "Desativar áudio"}
          aria-label={isDeafened ? "Ativar áudio" : "Desativar áudio"}
        >
          {isDeafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
        </button>

        <button
          type="button"
          className={`call-ctrl-btn ${isCameraEnabled ? "active-video" : ""}`}
          onClick={onToggleCamera}
          title={isCameraEnabled ? "Desativar câmera" : "Ativar câmera"}
          aria-label={isCameraEnabled ? "Desativar câmera" : "Ativar câmera"}
        >
          {isCameraEnabled ? <VideoIcon size={18} /> : <VideoOff size={18} />}
        </button>

        <button
          type="button"
          className={`call-ctrl-btn ${isScreenSharing ? "active-share" : ""}`}
          onClick={() => void handleOpenScreenShare()}
          title={
            isScreenSharing
              ? "Parar compartilhamento"
              : "Compartilhar tela"
          }
          aria-label={
            isScreenSharing
              ? "Parar compartilhamento"
              : "Compartilhar tela"
          }
        >
          <MonitorUp size={18} />
        </button>

        <button
          type="button"
          className="call-ctrl-btn end-call"
          onClick={onEndCall}
          title="Encerrar chamada"
          aria-label="Encerrar chamada"
        >
          <PhoneOff size={18} />
        </button>
      </footer>

      {/* Screen Share Selector Modal (Requirement 7: TELAS | APLICATIVOS) */}
      {sources && (
        <ScreenShareModal
          isOpen={Boolean(sources)}
          onClose={() => setSources(null)}
          sources={sources}
          quality={shareQuality}
          onQualityChange={setShareQuality}
          audio={shareAudio}
          onAudioChange={setShareAudio}
          onSelectSource={handleSelectSource}
          busy={shareBusy}
          error={shareError}
        />
      )}
    </div>
  );
}

function ParticipantCard(props: {
  participant?: Participant | null;
  profile?: Profile | null;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  isLocal: boolean;
  isMicEnabled: boolean;
  cameraTrack?: ReturnType<typeof useTracks>[0];
  compact?: boolean;
  onUserProfile?: OpenUserProfile;
}) {
  if (props.participant) {
    return <LiveParticipantCard {...props} participant={props.participant} />;
  }
  return <StaticParticipantCard {...props} />;
}

function LiveParticipantCard({
  participant,
  profile,
  displayName,
  avatarUrl,
  isLocal,
  isMicEnabled,
  cameraTrack,
  compact = false,
  onUserProfile,
}: {
  participant: Participant;
  profile?: Profile | null;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  isLocal: boolean;
  isMicEnabled: boolean;
  cameraTrack?: ReturnType<typeof useTracks>[0];
  compact?: boolean;
  onUserProfile?: OpenUserProfile;
}) {
  const speaking = useIsSpeaking(participant);
  const muteIndicator = useTrackMutedIndicator({
    participant,
    source: Track.Source.Microphone,
  });

  const isMuted = isLocal ? !isMicEnabled : Boolean(muteIndicator.isMuted);
  const validCameraTrack: TrackReference | undefined =
    cameraTrack &&
    isTrackReference(cameraTrack) &&
    cameraTrack.publication &&
    !cameraTrack.publication.isMuted &&
    cameraTrack.publication.track
      ? cameraTrack
      : undefined;
  const hasCamera = Boolean(validCameraTrack);

  const handleOpenProfile = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (profile) {
      onUserProfile?.(profile.id, e.currentTarget, profile);
    }
  };

  const avatarSize = compact ? 36 : 68;

  return (
    <div
      className={`call-participant-card ${speaking ? "speaking" : ""} ${hasCamera ? "has-camera" : ""} ${compact ? "compact" : ""}`}
    >
      {hasCamera && validCameraTrack ? (
        <VideoTrack
          trackRef={validCameraTrack}
          autoPlay
          playsInline
          muted={isLocal}
          className={`voice-participant-video ${isLocal ? "local" : ""}`}
        />
      ) : (
        <div
          className={`call-participant-avatar-wrap ${speaking ? "speaking" : ""}`}
        >
          <button
            type="button"
            className="call-participant-avatar-btn"
            onClick={handleOpenProfile}
            title={`Ver perfil de ${displayName}`}
            aria-label={`Ver perfil de ${displayName}`}
          >
            <Avatar
              userId={profile?.id}
              name={displayName}
              url={avatarUrl}
              size={avatarSize}
            />
          </button>
        </div>
      )}

      {/* Participant Name Tag & Mute Status (Requirement 6 & 17) */}
      <div className="call-participant-info">
        <button
          type="button"
          className="call-participant-name-tag"
          onClick={handleOpenProfile}
          title={`Ver perfil de ${displayName}`}
          aria-label={`Ver perfil de ${displayName}`}
        >
          <span>{displayName}</span>
        </button>

        <div
          className={`call-participant-status-icon ${isMuted ? "muted" : ""}`}
          title={isMuted ? "Microfone mutado" : "Microfone ativado"}
        >
          {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
        </div>
      </div>
    </div>
  );
}

function StaticParticipantCard({
  profile,
  displayName,
  avatarUrl,
  isLocal,
  isMicEnabled,
  compact = false,
  onUserProfile,
}: {
  profile?: Profile | null;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  isLocal: boolean;
  isMicEnabled: boolean;
  compact?: boolean;
  onUserProfile?: OpenUserProfile;
}) {
  const isMuted = isLocal ? !isMicEnabled : false;

  const handleOpenProfile = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (profile) {
      onUserProfile?.(profile.id, e.currentTarget, profile);
    }
  };

  const avatarSize = compact ? 36 : 68;

  return (
    <div className={`call-participant-card ${compact ? "compact" : ""}`}>
      <div className="call-participant-avatar-wrap">
        <button
          type="button"
          className="call-participant-avatar-btn"
          onClick={handleOpenProfile}
          title={`Ver perfil de ${displayName}`}
          aria-label={`Ver perfil de ${displayName}`}
        >
          <Avatar
            userId={profile?.id}
            name={displayName}
            url={avatarUrl}
            size={avatarSize}
          />
        </button>
      </div>

      {/* Participant Name Tag & Mute Status */}
      <div className="call-participant-info">
        <button
          type="button"
          className="call-participant-name-tag"
          onClick={handleOpenProfile}
          title={`Ver perfil de ${displayName}`}
          aria-label={`Ver perfil de ${displayName}`}
        >
          <span>{displayName}</span>
        </button>

        <div
          className={`call-participant-status-icon ${isMuted ? "muted" : ""}`}
          title={isMuted ? "Microfone mutado" : "Microfone ativado"}
        >
          {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
        </div>
      </div>
    </div>
  );
}
