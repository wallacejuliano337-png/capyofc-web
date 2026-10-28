import { ProfileEditor } from "./ProfileEditor";
import { profileAppearance, saveProfile } from "../../services/profile";
import { X, Search, Pencil } from "lucide-react";
import { VoiceSettings } from "./VoiceSettings";
import { NotificationSettings } from "./NotificationSettings";
import "./settings.css";
import { useEffect, useRef, useState } from "react";
import type { Profile, UpdateInfoPayload } from "../../types";
import { db, supabase } from "../../lib/supabase";
import { Avatar, ErrorNotice, Submit, useTask } from "../../components/ui";
export function Settings({
  profile,
  onSave,
  onClose,
  onAvatar,
  onLogout,
  initialSection = "voice",
  presence,
}: {
  initialSection?: "profile" | "voice";
  presence: string;
  onLogout: () => void;
  profile: Profile;
  onSave: (p: Profile) => void;
  onClose: () => void;
  onAvatar: () => void;
}) {
  const [name, setName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [status, setStatus] = useState(profile.status);
  const [password, setPassword] = useState("");
  const task = useTask();
  const [section, setSection] = useState<string>(initialSection);
  const [search, setSearch] = useState("");
  const [appVersion, setAppVersion] = useState("0.1.0");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfoPayload>({
    state: "idle",
    currentVersion: "0.1.0",
  });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    if (window.arena?.getVersion) {
      window.arena
        .getVersion()
        .then((v) => {
          if (v) {
            setAppVersion(v);
            setUpdateInfo((prev) => ({ ...prev, currentVersion: v }));
          }
        })
        .catch(() => {});
    }

    if (window.arena?.getUpdateStatus) {
      window.arena
        .getUpdateStatus()
        .then((s) => {
          if (s) setUpdateInfo(s);
        })
        .catch(() => {});
    }

    if (window.arena?.onUpdateStatus) {
      return window.arena.onUpdateStatus((status) => {
        setUpdateInfo(status);
        setIsCheckingUpdate(false);
      });
    }
  }, []);

  const handleCheckUpdate = async () => {
    if (!window.arena?.checkForUpdates) return;
    setIsCheckingUpdate(true);
    try {
      const res = await window.arena.checkForUpdates();
      setUpdateInfo(res);
    } catch {
      // Handled
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const [showRestartModal, setShowRestartModal] = useState(false);

  const handleRestartAndInstall = async () => {
    if (window.arena?.installUpdate) {
      await window.arena.installUpdate();
    }
  };
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const groups = [
    {
      title: "CONTA",
      items: [
        { label: "Minha conta", id: "account" },
        { label: "Perfil", id: "profile" },
        { label: "Dados e privacidade" },
        { label: "Privacidade e segurança" },
        { label: "Notificações", id: "notifications" },
      ],
    },
    {
      title: "VOZ E VÍDEO",
      items: [
        { label: "Voz e vídeo", id: "voice" },
        { label: "Voz", id: "voice", nested: true },
        { label: "Transmissão", id: "stream", nested: true },
        { label: "Sons", id: "sounds", nested: true },
        { label: "Avançado", nested: true },
      ],
    },
    {
      title: "APLICATIVO",
      items: [
        { label: "Aparência" },
        { label: "Acessibilidade" },
        { label: "Atalhos" },
        { label: "Idioma" },
      ],
    },
    {
      title: "OUTROS",
      items: [
        { label: "Sobre", id: "about" },
        { label: "Sair", id: "logout" },
      ],
    },
  ];
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        normalize(item.label).includes(normalize(search.trim())),
      ),
    }))
    .filter((group) => group.items.length);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const shell = document.querySelector<HTMLElement>(".app-layout");
    const wasInert = shell?.inert;
    if (shell) shell.inert = true;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (shell) shell.inert = !!wasInert;
      previous?.focus();
    };
  }, []);
  return (
    <div className="settings-backdrop">
      <div
        ref={root}
        className="settings-screen"
        role="dialog"
        aria-modal="true"
        aria-label="Configurações"
        onKeyDown={(e) => {
          if (document.querySelector(".modal-overlay")) return;
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
          if (e.key === "Tab") {
            const elements = Array.from(
              root.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]",
              ) || [],
            );
            const first = elements[0],
              last = elements.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <aside className="settings-nav">
          <button
            className="settings-profile-shortcut"
            onClick={() => setSection("profile")}
          >
            <Avatar
              userId={profile.id}
              name={profile.display_name}
              url={profile.avatar_url}
              size={36}
            />
            <span>
              <b>{profile.display_name}</b>
              <small>
                Editar perfil <Pencil size={11} />
              </small>
            </span>
          </button>
          <label className="settings-search">
            <Search size={15} />
            <input
              aria-label="Buscar configurações"
              placeholder="Buscar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <nav
            className="settings-nav-options"
            aria-label="Seções de configurações"
          >
            {filteredGroups.map((group) => (
              <div className="settings-nav-group" key={group.title}>
                <h3>{group.title}</h3>
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    disabled={!item.id}
                    className={
                      ("nested" in item && item.nested
                        ? "settings-suboption "
                        : "") + (item.id === "logout" ? "settings-logout" : "")
                    }
                    aria-current={
                      item.id === section && item.label !== "Voz e vídeo"
                        ? "page"
                        : undefined
                    }
                    onClick={() => {
                      if (item.id === "logout") {
                        onClose();
                        onLogout();
                      } else if (item.id) {
                        setSection(item.id);
                      }
                    }}
                  >
                    <span>{item.label}</span>
                    {!item.id && <small>Em breve</small>}
                  </button>
                ))}
              </div>
            ))}
            {!filteredGroups.length && (
              <p className="settings-search-empty">Nenhuma opção encontrada.</p>
            )}
          </nav>
        </aside>
        <section className="settings-content">
          <div className="settings-content-inner">
            {section === "notifications" && (
              <NotificationSettings userId={profile.id} />
            )}
            {section === "voice" && <VoiceSettings />}
            {(section === "stream" || section === "sounds") && (
              <>
                <h2>{section === "stream" ? "Transmissão" : "Sons"}</h2>
                <p className="muted">
                  {section === "stream"
                    ? "Os controles atuais de compartilhamento continuam disponíveis na sala de voz."
                    : "Preferências de sons do aplicativo."}
                </p>
                <div className="settings-upcoming">
                  {(section === "stream"
                    ? [
                        "Qualidade e resolução",
                        "FPS",
                        "Seleção da fonte",
                        "Comportamento de transmissão",
                      ]
                    : [
                        "Volume de notificações",
                        "Sons de entrada e saída",
                        "Sons do aplicativo",
                      ]
                  ).map((label) => (
                    <div key={label}>
                      <span>{label}</span>
                      <small>Em breve</small>
                    </div>
                  ))}
                </div>
              </>
            )}
            {section === "account" && (
              <>
                <h2>Minha conta</h2>
                <div className="settings-account">
                  <Avatar
                    userId={profile.id}
                    name={profile.display_name}
                    url={profile.avatar_url}
                    size={64}
                  />
                  <div>
                    <h3>{profile.display_name}</h3>
                    <p className="muted">@{profile.username}</p>
                  </div>
                </div>
                <button
                  className="primary"
                  onClick={() => setSection("profile")}
                >
                  Editar perfil
                </button>
                <dl className="settings-account-details">
                  <div>
                    <dt>Nome de exibição</dt>
                    <dd>{profile.display_name}</dd>
                  </div>
                  <div>
                    <dt>Nome de usuário</dt>
                    <dd>@{profile.username}</dd>
                  </div>
                </dl>
                <p className="settings-hint">
                  Seu perfil é utilizado nas comunidades e nas salas de voz.
                </p>
              </>
            )}
            {section === "about" && (
              <div className="settings-about-section">
                <h2>Sobre</h2>
                <div className="settings-about-header">
                  <div className="settings-about-branding">
                    <h3>LYC Arena</h3>
                    <span className="settings-version-badge">v{appVersion}</span>
                  </div>
                  <p className="muted">O ponto de encontro da comunidade LYC.</p>
                  <p>Converse, reúna seu time e compartilhe suas partidas.</p>
                </div>

                <div className="settings-updater-card">
                  <div className="settings-updater-header">
                    <h4>Atualizações</h4>
                    <span
                      className={`settings-updater-status ${updateInfo.state}`}
                    >
                      {updateInfo.state === "checking" || isCheckingUpdate
                        ? "Verificando atualizações..."
                        : updateInfo.state === "available"
                          ? `Atualização disponível (${updateInfo.availableVersion})`
                          : updateInfo.state === "downloading"
                            ? `Baixando atualização (${updateInfo.progressPercent ?? 0}%)...`
                            : updateInfo.state === "downloaded"
                              ? `Atualização pronta para instalar (${updateInfo.availableVersion})`
                              : updateInfo.state === "error"
                                ? "Não foi possível verificar no momento"
                                : "Você está utilizando a versão mais recente"}
                    </span>
                  </div>

                  <div className="settings-updater-actions">
                    {updateInfo.state === "downloaded" ? (
                      <button
                        type="button"
                        className="primary settings-restart-btn"
                        onClick={() => setShowRestartModal(true)}
                      >
                        Reiniciar e atualizar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="secondary"
                        disabled={
                          isCheckingUpdate ||
                          updateInfo.state === "checking" ||
                          updateInfo.state === "downloading"
                        }
                        onClick={() => void handleCheckUpdate()}
                      >
                        {isCheckingUpdate || updateInfo.state === "checking"
                          ? "Verificando..."
                          : "Verificar atualizações"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {section === "profile" && (
              <>
                <ProfileEditor
                  profile={profile}
                  appearance={profileAppearance(profile)}
                  presence={presence}
                  onSave={async (draft) => {
                    const result = await saveProfile(profile, draft);
                    onSave(result.profile);
                    setName(result.profile.display_name);
                    return result;
                  }}
                />
                <details className="profile-existing-settings">
                  <summary>Dados do perfil atual</summary>
                  <ErrorNotice text={task.error} />
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void task.run(async () => {
                        const changes = {
                          display_name: name.trim(),
                          username: username.trim(),
                          ...(!supabase ? { status } : {}),
                        };
                        if (supabase) {
                          const { error } = await db()
                            .from("profiles")
                            .update(changes)
                            .eq("id", profile.id);
                          if (error) throw error;
                          if (password) {
                            const { error } = await db().auth.updateUser({
                              password,
                            });
                            if (error) throw error;
                          }
                        }
                        onSave({ ...profile, ...changes });
                        onClose();
                      });
                    }}
                  >
                    <label>
                      Nome
                      <input
                        required
                        maxLength={40}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <label>
                      Username
                      <input
                        required
                        pattern="[a-z0-9_]{3,30}"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </label>
                    {supabase && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={onAvatar}
                      >
                        Alterar foto de perfil
                      </button>
                    )}
                    {!supabase && (
                      <label>
                        Status
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                        >
                          <option value="online">Disponível</option>
                          <option value="busy">Não perturbe</option>
                          <option value="away">Ausente</option>
                        </select>
                      </label>
                    )}
                    {supabase && (
                      <label>
                        Nova senha (opcional)
                        <input
                          type="password"
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </label>
                    )}
                    <p className="muted">
                      Cargo: {profile.role}. Atribuição de cargos é restrita à
                      administração.
                    </p>
                    <Submit busy={task.busy}>Salvar perfil</Submit>
                  </form>
                </details>
              </>
            )}
          </div>
        </section>
        <button
          className="settings-close"
          aria-label="Fechar configurações"
          title="Fechar (Esc)"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>

      {showRestartModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>Reiniciar e atualizar</h3>
            <p>
              O LYC Arena será reiniciado para concluir a instalação da nova versão.
              Certifique-se de que não está em uma chamada ou transmissão ativa antes de prosseguir.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setShowRestartModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary settings-restart-btn"
                onClick={() => {
                  setShowRestartModal(false);
                  void handleRestartAndInstall();
                }}
              >
                Confirmar e reiniciar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
