import { useState, useEffect } from "react";
import {
  Bell,
  Volume2,
  Monitor,
  MessageSquare,
  AtSign,
  PhoneCall,
  Check,
  Play,
} from "lucide-react";
import {
  loadUserNotificationSettings,
  saveUserNotificationSettings,
  type UserNotificationSettings,
} from "../../services/notifications";
import { playNotificationSound } from "../../services/notification-sounds";
import "./notification-settings.css";

interface NotificationSettingsProps {
  userId: string;
}

export function NotificationSettings({ userId }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<UserNotificationSettings>({
    user_id: userId,
    desktop_enabled: true,
    sounds_enabled: true,
    dms_enabled: true,
    mentions_enabled: true,
    calls_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    let active = true;
    loadUserNotificationSettings(userId).then((res) => {
      if (active) {
        setSettings(res);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const toggle = async (key: keyof Omit<UserNotificationSettings, "user_id">) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    try {
      await saveUserNotificationSettings(next);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleTestDesktop = () => {
    if (window.arena?.notify) {
      window.arena.notify(
        "LYC Arena - Teste de Notificação",
        "Esta é uma notificação nativa de teste da área de trabalho do LYC Arena.",
        { type: "mention" },
      );
    }
  };

  const handleTestSound = (type: "message" | "mention" | "call") => {
    void playNotificationSound(type);
  };

  if (loading) {
    return (
      <div className="notif-settings-loading">
        <p className="muted">Carregando preferências de notificações...</p>
      </div>
    );
  }

  return (
    <div className="notif-settings-container">
      <div className="notif-settings-header">
        <div>
          <h2>Notificações</h2>
          <p className="muted">
            Personalize como e quando o LYC Arena deve chamar sua atenção no aplicativo e no desktop.
          </p>
        </div>
        {savedFeedback && (
          <div className="notif-saved-pill">
            <Check size={14} /> Salvo
          </div>
        )}
      </div>

      <div className="notif-sections-list">
        {/* SEÇÃO 1: NOTIFICAÇÕES DESKTOP */}
        <div className="notif-card">
          <div className="notif-card-info">
            <div className="notif-card-title-row">
              <Monitor size={18} className="notif-icon-primary" />
              <strong>Notificações no Desktop</strong>
            </div>
            <p className="notif-card-desc">
              Exibir alertas nativos na bandeja e centro de notificações do Windows quando você receber mensagens ou convites.
            </p>
          </div>
          <div className="notif-card-action">
            <button
              type="button"
              className={`notif-switch ${settings.desktop_enabled ? "active" : ""}`}
              onClick={() => toggle("desktop_enabled")}
              aria-label="Ativar notificações na área de trabalho"
            >
              <span className="notif-switch-thumb" />
            </button>
          </div>
        </div>

        {/* SEÇÃO 2: SONS DE NOTIFICAÇÃO */}
        <div className="notif-card">
          <div className="notif-card-info">
            <div className="notif-card-title-row">
              <Volume2 size={18} className="notif-icon-primary" />
              <strong>Sons de Notificação</strong>
            </div>
            <p className="notif-card-desc">
              Reproduzir toques harmônicos instantâneos para novas mensagens, menções e chamadas ativas.
            </p>
            <div className="notif-sound-tests">
              <button
                type="button"
                className="notif-test-btn"
                onClick={() => handleTestSound("message")}
                title="Ouvir som de mensagem"
              >
                <Play size={12} /> Testar Mensagem
              </button>
              <button
                type="button"
                className="notif-test-btn"
                onClick={() => handleTestSound("mention")}
                title="Ouvir som de menção"
              >
                <Play size={12} /> Testar Menção
              </button>
              {window.arena?.notify && (
                <button
                  type="button"
                  className="notif-test-btn"
                  onClick={handleTestDesktop}
                  title="Testar notificação nativa"
                >
                  <Bell size={12} /> Testar Pop-up Desktop
                </button>
              )}
            </div>
          </div>
          <div className="notif-card-action">
            <button
              type="button"
              className={`notif-switch ${settings.sounds_enabled ? "active" : ""}`}
              onClick={() => toggle("sounds_enabled")}
              aria-label="Ativar sons de notificação"
            >
              <span className="notif-switch-thumb" />
            </button>
          </div>
        </div>

        {/* SEÇÃO 3: MENSAGENS DIRETAS (DMs) */}
        <div className="notif-card">
          <div className="notif-card-info">
            <div className="notif-card-title-row">
              <MessageSquare size={18} className="notif-icon-primary" />
              <strong>Mensagens Diretas (DMs)</strong>
            </div>
            <p className="notif-card-desc">
              Receber alertas e contadores de mensagens não lidas para conversas privadas 1:1 com amigos.
            </p>
          </div>
          <div className="notif-card-action">
            <button
              type="button"
              className={`notif-switch ${settings.dms_enabled ? "active" : ""}`}
              onClick={() => toggle("dms_enabled")}
              aria-label="Ativar notificações para mensagens diretas"
            >
              <span className="notif-switch-thumb" />
            </button>
          </div>
        </div>

        {/* SEÇÃO 4: MENÇÕES */}
        <div className="notif-card">
          <div className="notif-card-info">
            <div className="notif-card-title-row">
              <AtSign size={18} className="notif-icon-primary" />
              <strong>Menções de Usuário (@você, @everyone, @here)</strong>
            </div>
            <p className="notif-card-desc">
              Destacar distintivos numéricos e tocar alerta sonoro quando seu apelido for mencionado em canais de comunidades.
            </p>
          </div>
          <div className="notif-card-action">
            <button
              type="button"
              className={`notif-switch ${settings.mentions_enabled ? "active" : ""}`}
              onClick={() => toggle("mentions_enabled")}
              aria-label="Ativar notificações para menções"
            >
              <span className="notif-switch-thumb" />
            </button>
          </div>
        </div>

        {/* SEÇÃO 5: CHAMADAS */}
        <div className="notif-card">
          <div className="notif-card-info">
            <div className="notif-card-title-row">
              <PhoneCall size={18} className="notif-icon-primary" />
              <strong>Chamadas Privadas</strong>
            </div>
            <p className="notif-card-desc">
              Tocar sinal de chamada recebida e exibir painel flutuante de atendimento quando um amigo ligar para você.
            </p>
          </div>
          <div className="notif-card-action">
            <button
              type="button"
              className={`notif-switch ${settings.calls_enabled ? "active" : ""}`}
              onClick={() => toggle("calls_enabled")}
              aria-label="Ativar notificações para chamadas recebidas"
            >
              <span className="notif-switch-thumb" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
