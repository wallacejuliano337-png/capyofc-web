import { useState } from "react";
import { Track } from "livekit-client";
import { useTracks, VideoTrack } from "@livekit/components-react";
import { Maximize } from "lucide-react";
import { ErrorNotice, Modal } from "../../components/ui";
import "./screen-shares.css";

/** Same subscribed publications as the room; audio belongs to RoomAudioRenderer. */
export function ScreenShares() {
  const tracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const screen = tracks.find(
    (track) => track.publication.trackSid === expanded,
  );
  const fullscreen = async (element: HTMLElement | null) => {
    if (!element) return;
    try {
      await element.requestFullscreen();
      setError("");
    } catch {
      setError("Não foi possível abrir a tela cheia. Tente novamente.");
    }
  };
  if (!tracks.length) return null;
  return (
    <>
      <ErrorNotice text={error} />
      <div className="room-screen-grid" aria-label="Transmissões da sala">
        {tracks.map((track) => {
          const name = track.participant.name || track.participant.identity;
          return (
            <section className="room-screen" key={track.publication.trackSid}>
              <header>
                <span className="live-dot">AO VIVO</span>
                <b>{name}</b>
              </header>
              <div className="room-screen-stage">
                <button
                  type="button"
                  className="room-screen-expand"
                  aria-label={"Ampliar transmissão de " + name}
                  onClick={() => setExpanded(track.publication.trackSid)}
                >
                  <VideoTrack trackRef={track} autoPlay playsInline muted />
                </button>
                <button
                  type="button"
                  className="room-screen-fullscreen"
                  onClick={(e) =>
                    void fullscreen(e.currentTarget.parentElement)
                  }
                >
                  <Maximize size={16} />
                  Tela cheia
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {screen && (
        <Modal
          title={
            "AO VIVO · " +
            (screen.participant.name || screen.participant.identity)
          }
          onClose={() => setExpanded(null)}
        >
          <div className="video-stage">
            <VideoTrack trackRef={screen} autoPlay playsInline muted />
            <button
              type="button"
              onClick={(e) => void fullscreen(e.currentTarget.parentElement)}
            >
              <Maximize size={16} />
              Tela cheia
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
