import { useEffect } from "react";
import { X, Download, ExternalLink } from "lucide-react";
import "./modern-chat.css";

export function ImageLightboxModal({
  url,
  name,
  onClose,
}: {
  url: string;
  name: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="modern-image-lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de imagem"
      onClick={onClose}
    >
      <div
        className="lightbox-container"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="lightbox-header">
          <span className="lightbox-filename" title={name}>
            {name}
          </span>
          <div className="lightbox-actions">
            <a
              href={url}
              download={name}
              target="_blank"
              rel="noopener noreferrer"
              className="lightbox-btn"
              title="Baixar imagem"
              aria-label="Baixar imagem"
            >
              <Download size={16} />
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="lightbox-btn"
              title="Abrir original"
              aria-label="Abrir original"
            >
              <ExternalLink size={16} />
            </a>
            <button
              type="button"
              className="lightbox-btn close"
              onClick={onClose}
              title="Fechar"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="lightbox-image-wrap">
          <img src={url} alt={name} className="lightbox-image" />
        </div>
      </div>
    </div>
  );
}
