import { useEffect, useRef } from "react";
import {
  Smile,
  Reply,
  Copy,
  Hash,
  Pencil,
  Trash2,
} from "lucide-react";
import "./modern-chat.css";

export function MessageContextMenu({
  x,
  y,
  content,
  messageId,
  isAuthor,
  canDelete,
  onAddReaction,
  onReply,
  onEdit,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  content: string;
  messageId: string;
  isAuthor: boolean;
  canDelete: boolean;
  onAddReaction: () => void;
  onReply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Ensure menu stays within viewport
  const safeX = Math.min(Math.max(10, x), window.innerWidth - 220);
  const safeY = Math.min(Math.max(10, y), window.innerHeight - 260);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Ignored
    }
    onClose();
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(messageId);
    } catch {
      // Ignored
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="modern-msg-context-menu"
      style={{ top: `${safeY}px`, left: `${safeX}px` }}
      role="menu"
      aria-label="Opções da mensagem"
    >
      <button
        type="button"
        role="menuitem"
        className="msg-menu-item"
        onClick={() => {
          onClose();
          onAddReaction();
        }}
      >
        <Smile size={15} />
        <span>Adicionar reação</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="msg-menu-item"
        onClick={() => {
          onClose();
          onReply();
        }}
      >
        <Reply size={15} />
        <span>Responder</span>
      </button>

      <div className="msg-menu-divider" />

      {content && (
        <button
          type="button"
          role="menuitem"
          className="msg-menu-item"
          onClick={handleCopyText}
        >
          <Copy size={15} />
          <span>Copiar texto</span>
        </button>
      )}

      <button
        type="button"
        role="menuitem"
        className="msg-menu-item"
        onClick={handleCopyId}
      >
        <Hash size={15} />
        <span>Copiar ID da mensagem</span>
      </button>

      {(isAuthor || canDelete) && <div className="msg-menu-divider" />}

      {isAuthor && onEdit && (
        <button
          type="button"
          role="menuitem"
          className="msg-menu-item"
          onClick={() => {
            onClose();
            onEdit();
          }}
        >
          <Pencil size={15} />
          <span>Editar mensagem</span>
        </button>
      )}

      {canDelete && onDelete && (
        <button
          type="button"
          role="menuitem"
          className="msg-menu-item danger"
          onClick={() => {
            onClose();
            onDelete();
          }}
        >
          <Trash2 size={15} />
          <span>Excluir mensagem</span>
        </button>
      )}
    </div>
  );
}
