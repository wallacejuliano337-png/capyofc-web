import {
  Mic,
  MicOff,
  MonitorUp,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
} from "lucide-react";
import type { Profile } from "../../types";
import { formatCallDuration, type CallStatus } from "../../services/dm-calls";
import "./dm-calls.css";

export function MiniCallOverlay({
  peer,
  callStatus,
  duration,
  isMicEnabled,
  isCameraEnabled,
  isScreenSharing,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onEndCall,
  onReturnToDM,
}: {
  peer: Profile;
  callStatus: CallStatus;
  duration: number;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
  onReturnToDM: () => void;
}) {
  return (
    <div
      className="mini-call-pip-window"
      role="region"
      aria-label="Chamada em andamento"
    >
      <div
        className="mini-call-header"
        onClick={onReturnToDM}
        title="Clique para voltar para a chamada na DM"
      >
        <span className="mini-call-peer-name">{peer.display_name}</span>
        <span className="mini-call-status">
          <i className="status-dot connected" />
          {callStatus === "connected"
            ? `Conectado ${formatCallDuration(duration)}`
            : "Conectando..."}
        </span>
      </div>

      <div className="mini-call-controls">
        <button
          type="button"
          className={`mini-ctrl-btn ${!isMicEnabled ? "off" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMic();
          }}
          title={isMicEnabled ? "Desativar microfone" : "Ativar microfone"}
          aria-label={isMicEnabled ? "Desativar microfone" : "Ativar microfone"}
        >
          {isMicEnabled ? <Mic size={15} /> : <MicOff size={15} />}
        </button>

        <button
          type="button"
          className={`mini-ctrl-btn ${isScreenSharing ? "active-share" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleScreenShare();
          }}
          title={
            isScreenSharing
              ? "Parar compartilhamento de tela"
              : "Compartilhar tela"
          }
          aria-label={
            isScreenSharing
              ? "Parar compartilhamento de tela"
              : "Compartilhar tela"
          }
        >
          <MonitorUp size={15} />
        </button>

        <button
          type="button"
          className={`mini-ctrl-btn ${isCameraEnabled ? "active-video" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCamera();
          }}
          title={isCameraEnabled ? "Desligar câmera" : "Ligar câmera"}
          aria-label={isCameraEnabled ? "Desligar câmera" : "Ligar câmera"}
        >
          {isCameraEnabled ? (
            <VideoIcon size={15} />
          ) : (
            <VideoOff size={15} />
          )}
        </button>

        <button
          type="button"
          className="mini-ctrl-btn end-call"
          onClick={(e) => {
            e.stopPropagation();
            onEndCall();
          }}
          title="Encerrar chamada"
          aria-label="Encerrar chamada"
        >
          <PhoneOff size={15} />
        </button>
      </div>
    </div>
  );
}
