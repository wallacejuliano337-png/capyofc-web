import { useState } from "react";
import { Volume2 } from "lucide-react";
import { Modal, ErrorNotice } from "../../components/ui";
import { qualities } from "../../services/media";
import type { Source } from "../../types";

export interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Source[] | null;
  quality: keyof typeof qualities;
  onQualityChange: (quality: keyof typeof qualities) => void;
  audio: boolean;
  onAudioChange: (audio: boolean) => void;
  onSelectSource: (source: Source) => void | Promise<void>;
  busy?: boolean;
  error?: string;
}

export function ScreenShareModal({
  isOpen,
  onClose,
  sources,
  quality,
  onQualityChange,
  audio,
  onAudioChange,
  onSelectSource,
  busy = false,
  error = "",
}: ScreenShareModalProps) {
  const [sourceCategory, setSourceCategory] = useState<"screens" | "windows">(
    "screens",
  );

  if (!isOpen || !sources) return null;

  const screens = sources.filter((s) => s.id.startsWith("screen:"));
  const windows = sources.filter((s) => !s.id.startsWith("screen:"));
  const displayedSources = sourceCategory === "screens" ? screens : windows;

  return (
    <Modal title="O que você quer compartilhar?" onClose={onClose}>
      <ErrorNotice text={error} />
      <div className="share-config-row">
        <label className="share-quality-label">
          Qualidade
          <select
            value={quality}
            onChange={(e) =>
              onQualityChange(e.target.value as keyof typeof qualities)
            }
          >
            <option value="720p30">720p / 30 FPS</option>
            <option value="1080p30">1080p / 30 FPS</option>
            <option value="1080p60">1080p / 60 FPS</option>
          </select>
        </label>
        <div className="share-audio-col">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={audio}
              onChange={(e) => onAudioChange(e.target.checked)}
            />
            <Volume2 size={16} /> Incluir áudio do sistema
          </label>
          <span className="share-audio-hint">
            Áudio do sistema inteiro. Use fones para evitar eco.
          </span>
        </div>
      </div>

      <div className="source-category-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={sourceCategory === "screens"}
          className={`source-tab ${sourceCategory === "screens" ? "active" : ""}`}
          onClick={() => setSourceCategory("screens")}
        >
          TELAS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sourceCategory === "windows"}
          className={`source-tab ${sourceCategory === "windows" ? "active" : ""}`}
          onClick={() => setSourceCategory("windows")}
        >
          APLICATIVOS
        </button>
      </div>

      <div className="source-grid">
        {displayedSources.map((s) => (
          <button
            key={s.id}
            disabled={busy}
            onClick={() => void onSelectSource(s)}
          >
            <img src={s.thumbnail} alt="Prévia da fonte" />
            <span title={s.name}>{s.name}</span>
          </button>
        ))}
      </div>
      {displayedSources.length === 0 && (
        <p className="muted source-empty-msg">
          {sourceCategory === "screens"
            ? "Nenhuma tela disponível."
            : "Nenhum aplicativo aberto disponível para compartilhamento."}
        </p>
      )}
    </Modal>
  );
}
