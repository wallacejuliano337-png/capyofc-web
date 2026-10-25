import { Phone, PhoneOff, Video } from "lucide-react";
import { Avatar } from "../../components/ui";
import type { Profile } from "../../types";
import type { DMCall } from "../../services/dm-calls";
import "./dm-calls.css";

export function IncomingCallModal({
  call,
  peer,
  onAnswer,
  onDecline,
}: {
  call: DMCall;
  peer: Profile | { id: string; username: string; display_name: string; avatar_url: string | null };
  onAnswer: () => void;
  onDecline: () => void;
}) {
  const isVideo = call.call_type === "video";

  return (
    <div
      className="incoming-call-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Chamada recebida"
    >
      <div className="incoming-call-card">
        <div className="incoming-call-avatar-wrapper">
          <Avatar
            userId={peer.id}
            name={peer.display_name}
            url={peer.avatar_url}
            size={80}
          />
          <div className="incoming-call-pulse-ring" />
        </div>

        <h3 className="incoming-call-title">{peer.display_name}</h3>
        {peer.username && (
          <small style={{ color: "#8c9cb8", fontSize: "12px", marginTop: "-2px", marginBottom: "6px" }}>
            @{peer.username}
          </small>
        )}
        <p className="incoming-call-subtitle">
          {isVideo ? (
            <>
              <Video size={16} /> Chamada de vídeo recebida
            </>
          ) : (
            <>
              <Phone size={16} /> Chamada de voz recebida
            </>
          )}
        </p>

        <div className="incoming-call-actions">
          <button
            type="button"
            className="incoming-btn-decline"
            onClick={onDecline}
            title="Recusar"
            aria-label="Recusar"
          >
            <PhoneOff size={24} />
            <span>Recusar</span>
          </button>

          <button
            type="button"
            className="incoming-btn-answer"
            onClick={onAnswer}
            title="Aceitar"
            aria-label="Aceitar"
          >
            <Phone size={24} />
            <span>Aceitar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
