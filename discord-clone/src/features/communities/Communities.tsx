import type { OpenUserProfile } from "../profile/UserProfilePopover";
import { presenceLabels } from "../../services/social";
import { useState, useRef, useEffect, type ReactNode } from "react";
import {
  ChevronDown,
  Plus,
  FolderPlus,
  Settings as SettingsIcon,
  Shield,
  LogOut,
  UserPlus,
  Bell,
} from "lucide-react";
import {
  Avatar,
  ErrorNotice,
  Modal,
  Submit,
  useTask,
} from "../../components/ui";
import {
  communityAction,
  communityAdminPermissions,
  inviteCode,
  type Community,
  type Category,
  type Member,
  type CommunityRole,
} from "../../services/communities";
import {
  getDisplayRoleColor,
  getHighestRole,
} from "../../services/community-roles";
import type { Channel } from "../../types";

export { CreateChannelModal } from "./CreateChannelModal";
export { CreateCategoryModal } from "./CreateCategoryModal";
export { EditChannelModal } from "./EditChannelModal";
export { EditCategoryModal } from "./EditCategoryModal";
export { CommunitySettings } from "./CommunitySettings";

export function CommunityControls({
  children: _children,
  compact,
  communities: _communities,
  current,
  onSelect,
  onChanged,
  categories: _categories,
  channels: _channels,
  members: _members,
  roles: _roles,
  permissions,
  userId,
  open,
  onOpenChange: setOpen,
  onCreateChannel,
  onCreateCategory,
}: {
  children?: ReactNode;
  compact?: boolean;
  communities: Community[];
  current: Community | null;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void>;
  categories: Category[];
  channels: Channel[];
  members: Member[];
  roles: CommunityRole[];
  permissions: string[];
  userId: string;
  open: "directory" | "settings" | null;
  onOpenChange: (value: "directory" | "settings" | null) => void;
  onCreateChannel?: () => void;
  onCreateCategory?: () => void;
}) {
  const task = useTask();
  const [name, setName] = useState(""),
    [image, setImage] = useState(""),
    [code, setCode] = useState("");
  const canAdmin =
    communityAdminPermissions.some((p) => permissions.includes(p)) ||
    current?.owner_id === userId;
  const manage =
    permissions.includes("manage_channels") || current?.owner_id === userId;
  const run = (action: string, payload: Record<string, unknown>) =>
    communityAction(action, { community_id: current?.id, ...payload });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const bannerUrl =
    current?.banner_url ||
    (() => {
      try {
        return current?.id
          ? localStorage.getItem(`lyc_community_banner_${current.id}`) || null
          : null;
      } catch {
        return null;
      }
    })();

  return (
    <>
      {!compact && (
        <button
          ref={triggerRef}
          type="button"
          className={`community-menu-trigger ${menuOpen ? "active" : ""} ${bannerUrl ? "has-banner" : ""}`}
          style={
            bannerUrl
              ? {
                  backgroundImage: `linear-gradient(rgba(17, 18, 20, 0.4), rgba(17, 18, 20, 0.85)), url(${bannerUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
        >
          <b>{current?.name || "Comunidade LYC"}</b>
          <ChevronDown
            size={18}
            className={`trigger-chevron ${menuOpen ? "open" : ""}`}
          />
        </button>
      )}

      {menuOpen && !compact && (
        <div
          ref={menuRef}
          className="floating-menu server-dropdown-menu"
          style={{
            position: "fixed",
            top: "52px",
            left: "76px",
            zIndex: 1000,
          }}
        >
          {canAdmin && (
            <>
              <button
                type="button"
                className="floating-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  setOpen("settings");
                }}
              >
                <span>Convidar para comunidade</span>
                <UserPlus size={16} />
              </button>
              <button
                type="button"
                className="floating-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  setOpen("settings");
                }}
              >
                <span>Configurações</span>
                <SettingsIcon size={16} />
              </button>
              <div className="floating-menu-divider" />
            </>
          )}

          {manage && (
            <>
              <button
                type="button"
                className="floating-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  onCreateChannel?.();
                }}
              >
                <span>Criar canal</span>
                <Plus size={16} />
              </button>
              <button
                type="button"
                className="floating-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  onCreateCategory?.();
                }}
              >
                <span>Criar categoria</span>
                <FolderPlus size={16} />
              </button>
              <div className="floating-menu-divider" />
            </>
          )}

          <button
            type="button"
            className="floating-menu-item"
            onClick={() => {
              setMenuOpen(false);
            }}
          >
            <span>Notificações</span>
            <Bell size={16} />
          </button>

          <button
            type="button"
            className="floating-menu-item"
            onClick={() => {
              setMenuOpen(false);
              setOpen("directory");
            }}
          >
            <span>Permissões</span>
            <Shield size={16} />
          </button>

          {current && current.owner_id !== userId && (
            <>
              <div className="floating-menu-divider" />
              <button
                type="button"
                className="floating-menu-item danger"
                disabled={task.busy}
                onClick={() => {
                  setMenuOpen(false);
                  void task.run(async () => {
                    if (
                      !confirm(
                        "Sair desta comunidade? Você precisará de um convite para voltar.",
                      )
                    )
                      return;
                    await run("leave", {});
                    await onChanged();
                  });
                }}
              >
                <span>Sair da comunidade</span>
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      )}
      {open === "directory" && (
        <Modal
          title="Comunidades e permissões"
          onClose={() => setOpen(null)}
        >
          <ErrorNotice text={task.error} />
          <div className="panel">
            <h2>Criar ou entrar</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void task.run(async () => {
                  const id = await communityAction<string>("create", {
                    name,
                    image_url: image,
                  });
                  await onChanged();
                  onSelect(id);
                  setName("");
                  setImage("");
                  setOpen(null);
                });
              }}
            >
              <label>
                Nome da nova comunidade
                <input
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Imagem da nova comunidade (URL HTTPS)
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                />
              </label>
              <Submit busy={task.busy}>Criar comunidade</Submit>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void task.run(async () => {
                  const id = await communityAction<string>("join", {
                    code: inviteCode(code),
                  });
                  await onChanged();
                  onSelect(id);
                  setCode("");
                  setOpen(null);
                });
              }}
            >
              <label>
                Código ou link de convite
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <Submit busy={task.busy}>Entrar por convite</Submit>
            </form>
          </div>
          {current && current.owner_id !== userId && (
            <button
              className="danger"
              disabled={task.busy}
              onClick={() =>
                void task.run(async () => {
                  if (
                    !confirm(
                      "Sair desta comunidade? Você precisará de um convite para voltar.",
                    )
                  )
                    return;
                  await run("leave", {});
                  await onChanged();
                  setOpen(null);
                })
              }
            >
              Sair da comunidade
            </button>
          )}
        </Modal>
      )}
    </>
  );
}
export function CommunityMembers({
  members,
  roles = [],
  presence,
  onUserProfile,
}: {
  onUserProfile?: OpenUserProfile;
  members: Member[];
  roles?: CommunityRole[];
  presence: Record<string, string>;
}) {
  const groups = ["OWNER", "ADMIN", "MODERADOR", "ONLINE", "OFFLINE"];
  const groupOf = (m: Member) => {
    const role = m.community_roles.base_role?.toUpperCase();
    if (role === "OWNER") return "OWNER";
    if (role === "ADMIN") return "ADMIN";
    if (role === "MODERATOR") return "MODERADOR";
    return presence[m.user_id] && presence[m.user_id] !== "offline"
      ? "ONLINE"
      : "OFFLINE";
  };
  return (
    <aside className="members-sidebar" aria-label="Membros da comunidade">
      <h3>
        MEMBROS <span>{members.length}</span>
      </h3>
      {groups.map((group) => {
        const rows = members.filter((m) => groupOf(m) === group);
        return (
          rows.length > 0 && (
            <section className="member-group" key={group}>
              <h4>
                {group} <span>— {rows.length}</span>
              </h4>
              {rows.map((m) => {
                const status = presence[m.user_id] || "offline";
                const roleColor = getDisplayRoleColor(m, roles);
                const highest = getHighestRole(m, roles);
                return (
                  <div
                    className={
                      "member" + (status === "offline" ? " offline" : "")
                    }
                    key={m.user_id}
                  >
                    <button
                      type="button"
                      className="member-avatar user-profile-member-trigger"
                      data-profile-trigger={m.user_id}
                      aria-label={"Ver perfil de " + m.profiles.display_name}
                      onClick={(e) =>
                        onUserProfile?.(m.user_id, e.currentTarget, m.profiles)
                      }
                    >
                      <Avatar
                        userId={m.user_id}
                        name={m.profiles.display_name}
                        url={m.profiles.avatar_url}
                        size={32}
                      />
                      <i className={"presence-dot presence-" + status} />
                    </button>
                    <div className="member-identity">
                      <button
                        type="button"
                        className="user-profile-member-trigger"
                        data-profile-trigger={m.user_id}
                        onClick={(e) =>
                          onUserProfile?.(
                            m.user_id,
                            e.currentTarget,
                            m.profiles,
                          )
                        }
                      >
                        <b
                          title={m.profiles.display_name}
                          style={{ color: roleColor }}
                        >
                          {m.profiles.display_name}
                        </b>
                      </button>
                      <small>
                        {highest?.name || m.community_roles.name} ·{" "}
                        {presenceLabels[status]}
                      </small>
                    </div>
                  </div>
                );
              })}
            </section>
          )
        );
      })}
    </aside>
  );
}
