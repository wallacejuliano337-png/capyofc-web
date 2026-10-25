import { useState, useEffect } from "react";
import { X, Bell, Check } from "lucide-react";
import type { Channel } from "../../types";
import {
  loadChannelNotificationLevel,
  saveChannelNotificationLevel,
  type ChannelNotificationLevel,
} from "../../services/notifications";

interface ChannelNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  userId: string;
}

export function ChannelNotificationModal({
  isOpen,
  onClose,
  channel,
  userId,
}: ChannelNotificationModalProps) {
  const [level, setLevel] = useState<ChannelNotificationLevel>("default");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    loadChannelNotificationLevel(channel.id, userId).then((lvl) => {
      if (active) {
        setLevel(lvl);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [channel.id, userId, isOpen]);

  const handleSelectLevel = async (newLevel: ChannelNotificationLevel) => {
    setLevel(newLevel);
    try {
      await saveChannelNotificationLevel(channel.id, userId, newLevel);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 350);
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="channel-notif-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card channel-notif-modal" style={{ maxWidth: 460 }}>
        <header className="modal-header">
          <div className="modal-header-info">
            <div className="modal-header-icon">
              <Bell size={20} color="#5865f2" />
            </div>
            <div>
              <h2 id="channel-notif-title" className="modal-title">
                Notificações de #{channel.name}
              </h2>
              <p className="modal-subtitle">
                Escolha o nível de alertas que deseja receber para este canal.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="modal-body" style={{ padding: "16px 20px" }}>
          {loading ? (
            <p className="muted">Carregando configurações...</p>
          ) : (
            <div className="channel-notif-options" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                {
                  id: "default",
                  label: "Padrão da comunidade",
                  desc: "Usa as configurações padrão definidas no servidor.",
                },
                {
                  id: "all",
                  label: "Todas as mensagens",
                  desc: "Receba alertas sonoros e no desktop para qualquer mensagem nova.",
                },
                {
                  id: "mentions",
                  label: "Apenas @menções",
                  desc: "Receba alertas apenas quando seu nome, @everyone ou @here for citado.",
                },
                {
                  id: "nothing",
                  label: "Nada (Silenciado)",
                  desc: "Nenhum som ou notificação no desktop para este canal.",
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`safety-option-item ${level === opt.id ? "selected" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 14px",
                    background: level === opt.id ? "rgba(88, 101, 242, 0.12)" : "#1e1f22",
                    border: `1px solid ${level === opt.id ? "#5865f2" : "rgba(255, 255, 255, 0.06)"}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "inherit",
                  }}
                  onClick={() => handleSelectLevel(opt.id as ChannelNotificationLevel)}
                >
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      border: `2px solid ${level === opt.id ? "#5865f2" : "#949ba4"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {level === opt.id && (
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#5865f2",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <strong style={{ fontSize: "14px", color: level === opt.id ? "#ffffff" : "#dbdee1" }}>
                      {opt.label}
                    </strong>
                    <span style={{ fontSize: "12px", color: "#949ba4" }}>{opt.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <footer
          className="modal-footer"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "12px 20px",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          {saved && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#23a55a", fontSize: "13px", marginRight: "auto" }}>
              <Check size={16} /> Salvo com sucesso!
            </span>
          )}
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            style={{ padding: "6px 16px", borderRadius: "4px" }}
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
