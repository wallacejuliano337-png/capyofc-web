import type { OpenUserProfile } from "../profile/UserProfilePopover";
import { presenceLabels } from "../../services/social";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
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
  RoleManager,
  InviteManager,
  OrderButtons,
} from "./CommunityAdministration";
import type { Channel } from "../../types";
export function CommunityControls({
  children,
  compact,
  communities,
  current,
  onSelect,
  onChanged,
  categories,
  channels,
  members,
  roles,
  permissions,
  userId,
  open,
  onOpenChange: setOpen,
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
}) {
  const task = useTask();
  const [name, setName] = useState(""),
    [image, setImage] = useState(""),
    [code, setCode] = useState("");
  const [editCommunity, setEditCommunity] = useState(false);
  const [category, setCategory] = useState({ id: "", name: "", position: 0 });
  const [channel, setChannel] = useState({
    id: "",
    name: "",
    category_id: "",
    kind: "text",
    description: "",
    position: 0,
  });
  const canAdmin = communityAdminPermissions.some((p) =>
    permissions.includes(p),
  );
  const manage = permissions.includes("manage_channels");
  const run = (action: string, payload: Record<string, unknown>) =>
    communityAction(action, { community_id: current?.id, ...payload });
  return (
    <>
      {!compact && (
        <button
          className="community-menu-trigger"
          popoverTarget="community-menu"
        >
          <b>{current?.name || "LYC Arena"}</b>
          <ChevronDown size={18} />
        </button>
      )}
      <div
        id="community-menu"
        popover="auto"
        className="shell-popover community-popover"
      >
        <div className="community-title">
          <Avatar
            name={current?.name || "Comunidades"}
            url={current?.image_url}
            size={28}
          />
          <select
            aria-label="Comunidade"
            value={current?.id || ""}
            onChange={(e) => onSelect(e.target.value)}
          >
            {!current && <option value="">Nenhuma comunidade</option>}
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="admin-link"
          onClick={() => {
            document.getElementById("community-menu")?.hidePopover();
            setOpen("directory");
          }}
        >
          Comunidades e permissões
        </button>
        {current && canAdmin && (
          <button
            className="admin-link"
            onClick={() => {
              document.getElementById("community-menu")?.hidePopover();
              setOpen("settings");
            }}
          >
            Configurações da comunidade
          </button>
        )}
        {children}
      </div>
      {open && (
        <Modal
          title={
            open === "settings"
              ? "Configurações da comunidade"
              : "Comunidades e permissões"
          }
          onClose={() => setOpen(null)}
        >
          <ErrorNotice text={task.error} />
          {open === "directory" && (
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
          )}
          {open === "settings" && !canAdmin && (
            <p>Você não possui permissão administrativa.</p>
          )}
          {current && (open === "directory" || canAdmin) && (
            <>
              <h2>{current.name}</h2>
              <p>
                Seu cargo:{" "}
                {members.find((m) => m.user_id === userId)?.community_roles
                  ?.name || "Membro"}
              </p>
              <p className="muted">
                Permissões:{" "}
                {permissions.length
                  ? permissions.join(", ")
                  : "Somente leitura"}
              </p>
              {open === "settings" &&
                permissions.includes("manage_community") && (
                  <>
                    <button onClick={() => setEditCommunity(!editCommunity)}>
                      Editar comunidade
                    </button>
                    {editCommunity && (
                      <CommunityEditor
                        community={current}
                        save={async (payload) => {
                          await run("edit_community", payload);
                          await onChanged();
                        }}
                      />
                    )}
                  </>
                )}
              {open === "directory" && current.owner_id !== userId && (
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
              {open === "settings" &&
                permissions.includes("create_invites") && (
                  <InviteManager community={current} onChanged={onChanged} />
                )}
              {open === "settings" && manage && (
                <>
                  <form
                    className="panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void task.run(async () => {
                        await run(
                          category.id ? "edit_category" : "create_category",
                          category,
                        );
                        setCategory({ id: "", name: "", position: 0 });
                        await onChanged();
                      });
                    }}
                  >
                    <h3>
                      {category.id ? "Editar categoria" : "Nova categoria"}
                    </h3>
                    <label>
                      Nome da categoria
                      <input
                        required
                        maxLength={60}
                        value={category.name}
                        onChange={(e) =>
                          setCategory({ ...category, name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Ordem da categoria
                      <input
                        type="number"
                        value={category.position}
                        onChange={(e) =>
                          setCategory({
                            ...category,
                            position: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <Submit busy={task.busy}>Salvar categoria</Submit>
                  </form>
                  {categories.map((c) => (
                    <div className="ticket-row" key={c.id}>
                      <b>{c.name}</b>
                      <span>Ordem {c.position}</span>
                      <OrderButtons
                        items={categories}
                        id={c.id}
                        name={c.name}
                        busy={task.busy}
                        move={(ids) =>
                          task.run(async () => {
                            await run("reorder_categories", { ids });
                            await onChanged();
                          })
                        }
                      />
                      <button onClick={() => setCategory(c)}>
                        Editar categoria {c.name}
                      </button>
                      <button
                        disabled={task.busy}
                        onClick={() =>
                          void task.run(async () => {
                            if (!confirm("Excluir esta categoria vazia?"))
                              return;
                            await run("delete_category", { id: c.id });
                            await onChanged();
                          })
                        }
                      >
                        Excluir categoria {c.name}
                      </button>
                    </div>
                  ))}
                  <form
                    className="panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void task.run(async () => {
                        await run(
                          channel.id ? "edit_channel" : "create_channel",
                          {
                            ...channel,
                            category_id:
                              channel.category_id || categories[0]?.id,
                          },
                        );
                        setChannel({
                          id: "",
                          name: "",
                          category_id: "",
                          kind: "text",
                          description: "",
                          position: 0,
                        });
                        await onChanged();
                      });
                    }}
                  >
                    <h3>{channel.id ? "Editar canal" : "Novo canal"}</h3>
                    <label>
                      Nome do canal
                      <input
                        required
                        maxLength={60}
                        value={channel.name}
                        onChange={(e) =>
                          setChannel({ ...channel, name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Categoria do canal
                      <select
                        required
                        value={channel.category_id || categories[0]?.id || ""}
                        onChange={(e) =>
                          setChannel({
                            ...channel,
                            category_id: e.target.value,
                          })
                        }
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Tipo do canal
                      <select
                        disabled={!!channel.id}
                        value={channel.kind}
                        onChange={(e) =>
                          setChannel({ ...channel, kind: e.target.value })
                        }
                      >
                        <option value="text">Texto</option>
                        <option value="voice">Voz</option>
                      </select>
                    </label>
                    <label>
                      Descrição
                      <input
                        value={channel.description}
                        onChange={(e) =>
                          setChannel({
                            ...channel,
                            description: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Ordem do canal
                      <input
                        type="number"
                        value={channel.position}
                        onChange={(e) =>
                          setChannel({
                            ...channel,
                            position: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <Submit busy={task.busy}>
                      {channel.id ? "Salvar canal" : "Criar canal"}
                    </Submit>
                  </form>
                  {channels.map((c) => (
                    <div className="ticket-row" key={c.id}>
                      <b>{c.name}</b>
                      <span>
                        {c.kind} · {c.position}
                      </span>
                      <OrderButtons
                        items={channels.filter(
                          (other) => other.category_id === c.category_id,
                        )}
                        id={c.id}
                        name={c.name}
                        busy={task.busy}
                        move={(ids) =>
                          task.run(async () => {
                            await run("reorder_channels", {
                              ids,
                              category_id: c.category_id,
                            });
                            await onChanged();
                          })
                        }
                      />
                      <button
                        onClick={() =>
                          setChannel({
                            id: c.id,
                            name: c.name,
                            category_id: c.category_id || "",
                            kind: c.kind,
                            description: c.description,
                            position: c.position || 0,
                          })
                        }
                      >
                        Editar canal {c.name}
                      </button>
                      <button
                        disabled={task.busy}
                        onClick={() =>
                          void task.run(async () => {
                            if (
                              !confirm(
                                "Excluir este canal da lista? O histórico será preservado.",
                              )
                            )
                              return;
                            await run("delete_channel", { id: c.id });
                            await onChanged();
                          })
                        }
                      >
                        Excluir canal {c.name}
                      </button>
                    </div>
                  ))}
                </>
              )}
              {open === "settings" && permissions.includes("manage_roles") && (
                <RoleManager
                  community={current}
                  roles={roles}
                  members={members}
                  permissions={permissions}
                  userId={userId}
                  onChanged={onChanged}
                />
              )}
              {open === "directory" && (
                <p>Consulte os membros e cargos na lista da comunidade.</p>
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
function CommunityEditor({
  community,
  save,
}: {
  community: Community;
  save: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(community.name),
    [image, setImage] = useState(community.image_url || "");
  const task = useTask();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void task.run(() => save({ name, image_url: image }));
      }}
    >
      <ErrorNotice text={task.error} />
      <label>
        Nome da comunidade
        <input
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Imagem da comunidade (URL HTTPS)
        <input
          type="url"
          value={image}
          onChange={(e) => setImage(e.target.value)}
        />
      </label>
      <Submit busy={task.busy}>Salvar comunidade</Submit>
    </form>
  );
}
export function CommunityMembers({
  members,
  presence,
  onUserProfile,
}: {
  onUserProfile?: OpenUserProfile;
  members: Member[];
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
                        <b title={m.profiles.display_name}>
                          {m.profiles.display_name}
                        </b>
                      </button>
                      <small>
                        {m.community_roles.name} · {presenceLabels[status]}
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
