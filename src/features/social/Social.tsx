import { createPortal } from "react-dom";
import {
  Users,
  Inbox,
  Sparkles,
  ShoppingBag,
  Flag,
  MessageCircle,
  UserMinus,
  Ban,
  Check,
  X,
  Search,
} from "lucide-react";
import type { OpenUserProfile } from "../profile/UserProfilePopover";
import "./social-layout.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, ErrorNotice, Submit, useTask } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import type { useSocial } from "../../hooks/useSocial";
import {
  dmHistory,
  findPeople,
  friendRequestStatus,
  type PublicPerson,
  presenceLabels,
  socialAction,
  visiblePresence,
  type Conversation,
  type DirectMessage,
} from "../../services/social";
import type { Profile } from "../../types";
type SocialState = ReturnType<typeof useSocial>;
const socialNavigation = [
  { name: "Amigos", icon: Users },
  { name: "Solicitações de mensagens", icon: Inbox },
  { name: "LYC+ ✦", icon: Sparkles },
  { name: "Loja", icon: ShoppingBag },
  { name: "Missões", icon: Flag },
];
export function Social({
  profile,
  social,
  navigationHost,
  onUserProfile,
}: {
  profile: Profile;
  social: SocialState;
  navigationHost?: HTMLElement | null;
  onUserProfile?: OpenUserProfile;
}) {
  const [view, setView] = useState("Amigos"),
    [tab, setTab] = useState("Disponível"),
    [query, setQuery] = useState(""),
    [lookup, setLookup] = useState(""),
    [results, setResults] = useState<PublicPerson[]>([]),
    [selected, setSelected] = useState<string | null>(null);
  const task = useTask(),
    data = social.data;
  const status = (id: string) =>
    visiblePresence(
      data?.presence.find((p) => p.user_id === id),
      social.now,
    );
  const run = (action: string, user_id: string) =>
    task.run(async () => {
      await socialAction(action, { user_id });
      await social.refresh();
    });
  const open = (user_id: string) =>
    task.run(async () => {
      const id = await socialAction<string>("open_dm", { user_id });
      await social.refresh();
      setSelected(id);
    });
  const requestStatus = (id: string) =>
    friendRequestStatus(
      data?.friends || [],
      profile.id,
      id,
      data?.blocks.includes(id),
    );
  const people = (
    tab === "Bloqueados"
      ? data?.blocks || []
      : (data?.friends || [])
          .filter((f) =>
            tab === "Pendente" ? f.state === "pending" : f.state === "accepted",
          )
          .map((f) => (f.user_low === profile.id ? f.user_high : f.user_low))
  )
    .filter((id) => tab !== "Disponível" || status(id) !== "offline")
    .filter((id) => {
      const p = data?.profiles[id];
      return (
        p &&
        (p.display_name + " " + p.username)
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase())
      );
    });
  const conversation = data?.conversations.find((c) => c.id === selected);
  const pendingCount =
    data?.friends.filter((f) => f.state === "pending").length || 0;
  const person = (p: PublicPerson) => (
    <>
      <button
        type="button"
        className="social-avatar-trigger"
        data-profile-trigger={p.id}
        aria-label={"Ver perfil de " + p.display_name}
        onClick={(e) =>
          onUserProfile?.(p.id, e.currentTarget, data?.profiles[p.id])
        }
      >
        <Avatar userId={p.id} name={p.display_name} url={p.avatar_url} />
        <i className={"presence-dot presence-" + status(p.id)} />
      </button>
      <div className="social-person-identity">
        <button
          type="button"
          data-profile-trigger={p.id}
          className="social-name-trigger"
          onClick={(e) =>
            onUserProfile?.(p.id, e.currentTarget, data?.profiles[p.id])
          }
        >
          {p.display_name}
        </button>
        <small>
          @{p.username} ·{" "}
          <span data-presence-for={p.id}>{presenceLabels[status(p.id)]}</span>
        </small>
      </div>
    </>
  );
  const action = (
    label: string,
    icon: React.ReactNode,
    handler: () => void,
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={task.busy}
      onClick={handler}
    >
      {icon}
    </button>
  );
  const navigation = (
    <div className="social-navigation">
      <div className="social-navigation-title">Amigos e DMs</div>
      <nav aria-label="Navegação de Amigos e DMs">
        {socialNavigation.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={view === name && !selected ? "active" : ""}
            onClick={() => {
              setView(name);
              setSelected(null);
            }}
          >
            <Icon size={18} />
            <span>{name}</span>
            {name === "Loja" && (
              <small className="social-new-badge">NOVO</small>
            )}
          </button>
        ))}
      </nav>
      <h3>Mensagens diretas</h3>
      <div className="social-conversations">
        {data?.conversations.map((c) => (
          <button
            key={c.id}
            className={"dm-conversation" + (selected === c.id ? " active" : "")}
            aria-label={
              "Conversa com " +
              (data.profiles[c.peer_id]?.display_name || "Usuário") +
              ", " +
              c.unread_count +
              " não lidas"
            }
            onClick={() => setSelected(c.id)}
          >
            <Avatar
              userId={c.peer_id}
              name={data.profiles[c.peer_id]?.display_name || "Usuário"}
              url={data.profiles[c.peer_id]?.avatar_url}
              size={28}
            />
            <span>{data.profiles[c.peer_id]?.display_name || "Usuário"}</span>
            {Number(c.unread_count) > 0 && (
              <b className="badge">{c.unread_count}</b>
            )}
          </button>
        ))}
        {!data?.conversations.length && <p>Nenhuma conversa ainda.</p>}
      </div>
    </div>
  );
  return (
    <section
      className={
        "social-page social-workspace" +
        (!navigationHost ? " social-with-navigation" : "")
      }
    >
      {navigationHost ? createPortal(navigation, navigationHost) : navigation}
      <div className="social-main">
        <ErrorNotice
          text={task.error || social.error || social.presenceError}
        />
        {conversation && data?.profiles[conversation.peer_id] ? (
          <div className="dm-panel">
            <DirectChat
              key={conversation.id}
              profile={profile}
              peer={data.profiles[conversation.peer_id]}
              conversation={conversation}
              social={social}
            />
          </div>
        ) : view !== "Amigos" ? (
          <div className="social-future">
            <h1>
              {view}
              {view === "Loja" && (
                <small className="social-new-badge">NOVO</small>
              )}
            </h1>
            <span className="social-coming">Em breve</span>
            <p>
              {view === "Solicitações de mensagens"
                ? "Solicitações de mensagens ainda dependem de implementação no backend. Suas DMs atuais continuam disponíveis na lista ao lado."
                : view === "LYC+ ✦"
                  ? "A futura área premium do LYC Arena. Assinaturas e pagamentos ainda não estão disponíveis."
                  : view === "Loja"
                    ? "A loja do LYC Arena está em preparação. Compras ainda não estão disponíveis."
                    : "Desafios, recompensas e progressão estarão disponíveis em uma próxima etapa."}
            </p>
          </div>
        ) : (
          <>
            <header className="friends-header">
              <h1>
                <Users size={19} />
                Amigos
              </h1>
              <div role="tablist" aria-label="Lista de amigos">
                {["Disponível", "Todos", "Pendente", "Adicionar amigo"].map(
                  (t) => (
                    <button
                      role="tab"
                      aria-selected={tab === t}
                      key={t}
                      className={
                        (tab === t ? "active " : "") +
                        (t === "Adicionar amigo" ? "add-friend-tab" : "")
                      }
                      onClick={() => {
                        setTab(t);
                        setQuery("");
                      }}
                    >
                      {t}
                      {t === "Pendente" && pendingCount > 0 && (
                        <small>{pendingCount}</small>
                      )}
                    </button>
                  ),
                )}
              </div>
            </header>
            <div className="friends-body">
              <div className="friends-tools">
                {tab !== "Adicionar amigo" && (
                  <label className="friends-search">
                    <Search size={16} />
                    <input
                      aria-label="Buscar amigos"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar por nome ou username"
                    />
                  </label>
                )}
                <button
                  className="blocked-access"
                  onClick={() => {
                    setTab(tab === "Bloqueados" ? "Todos" : "Bloqueados");
                    setQuery("");
                  }}
                >
                  {tab === "Bloqueados"
                    ? "Voltar para amigos"
                    : "Gerenciar bloqueados"}
                </button>
              </div>
              {tab === "Adicionar amigo" ? (
                <>
                  <h2>Adicionar amigo</h2>
                  <p className="muted">
                    Encontre pessoas pelo nome ou username.
                  </p>
                  <form
                    className="friend-add-search"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void task.run(async () =>
                        setResults(await findPeople(lookup, profile.id)),
                      );
                    }}
                  >
                    <input
                      required
                      aria-label="Buscar pessoa"
                      value={lookup}
                      onChange={(e) => setLookup(e.target.value)}
                      placeholder="Nome ou username"
                    />
                    <Submit busy={task.busy}>Buscar</Submit>
                  </form>
                  {results.map((p) => (
                    <div className="social-person" key={p.id}>
                      {person(p)}
                      <div className="social-row-actions">
                        <button
                          disabled={task.busy || !!requestStatus(p.id)}
                          onClick={() => void run("request_friend", p.id)}
                        >
                          {requestStatus(p.id) || "Adicionar"}
                        </button>
                        {action(
                          "DM com " + p.display_name,
                          <MessageCircle size={17} />,
                          () => void open(p.id),
                        )}
                        {action(
                          "Bloquear " + p.display_name,
                          <Ban size={17} />,
                          () => void run("block", p.id),
                        )}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <h2 className="friends-count">
                    {tab} — {people.length}
                  </h2>
                  {!people.length && (
                    <p className="social-empty">
                      {query
                        ? "Nenhum resultado para esta busca."
                        : tab === "Disponível"
                          ? "Nenhum amigo disponível no momento."
                          : tab === "Pendente"
                            ? "Nenhuma solicitação pendente."
                            : "Nenhum usuário nesta lista."}
                    </p>
                  )}
                  {people.map((id) => {
                    const p = data!.profiles[id];
                    const incoming =
                      data?.friends.find(
                        (f) =>
                          f.state === "pending" &&
                          (f.user_low === id || f.user_high === id),
                      )?.requester_id !== profile.id;
                    return (
                      <div className="social-person" key={id}>
                        {person(p)}
                        {tab === "Pendente" && (
                          <small className="request-direction">
                            {incoming ? "Recebida" : "Enviada"}
                          </small>
                        )}
                        <div className="social-row-actions">
                          {tab === "Bloqueados" ? (
                            action(
                              "Desbloquear " + p.display_name,
                              <Check size={17} />,
                              () => void run("unblock", id),
                            )
                          ) : (
                            <>
                              {tab === "Pendente" ? (
                                incoming ? (
                                  <>
                                    {action(
                                      "Aceitar " + p.display_name,
                                      <Check size={17} />,
                                      () => void run("accept_friend", id),
                                    )}
                                    {action(
                                      "Recusar " + p.display_name,
                                      <X size={17} />,
                                      () => void run("decline_friend", id),
                                    )}
                                  </>
                                ) : (
                                  action(
                                    "Cancelar solicitação para " +
                                      p.display_name,
                                    <X size={17} />,
                                    () => void run("cancel_friend", id),
                                  )
                                )
                              ) : (
                                <>
                                  {action(
                                    "DM com " + p.display_name,
                                    <MessageCircle size={17} />,
                                    () => void open(id),
                                  )}
                                  {action(
                                    "Remover amizade com " + p.display_name,
                                    <UserMinus size={17} />,
                                    () => void run("remove_friend", id),
                                  )}
                                </>
                              )}
                              {action(
                                "Bloquear " + p.display_name,
                                <Ban size={17} />,
                                () => void run("block", id),
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
function DirectChat({
  profile,
  peer,
  conversation,
  social,
}: {
  profile: Profile;
  peer: Profile;
  conversation: Conversation;
  social: SocialState;
}) {
  const [pages, setPages] = useState(1),
    [content, setContent] = useState(""),
    [reply, setReply] = useState<DirectMessage | null>(null),
    [editing, setEditing] = useState<DirectMessage | null>(null),
    [editText, setEditText] = useState("");
  const task = useTask();
  const history = useAsync(
    useCallback(
      () => dmHistory(conversation.id, pages),
      [conversation.id, pages],
    ),
  );
  const refreshRef = useRef(history.reload);
  refreshRef.current = history.reload;
  useEffect(() => {
    void refreshRef.current();
  }, [social.revision]);
  const ack = useRef(0),
    inflight = useRef(false);
  const rows = history.data || [];
  const through = rows.at(-1)?.seq || 0;
  const markRead = useCallback(async () => {
    if (
      inflight.current ||
      through <= Math.max(ack.current, Number(conversation.last_read_seq))
    )
      return;
    inflight.current = true;
    try {
      await socialAction("read_dm", {
        conversation_id: conversation.id,
        through_seq: through,
      });
      ack.current = through;
    } finally {
      inflight.current = false;
    }
  }, [conversation.id, conversation.last_read_seq, through]);
  useEffect(() => {
    const read = () => {
      if (document.visibilityState === "visible" && document.hasFocus())
        void markRead().catch(() => {});
    };
    read();
    window.addEventListener("focus", read);
    document.addEventListener("visibilitychange", read);
    return () => {
      window.removeEventListener("focus", read);
      document.removeEventListener("visibilitychange", read);
    };
  }, [markRead]);
  const perform = async (
    action: string,
    payload: Record<string, unknown>,
    afterWrite?: () => void,
  ) => {
    await socialAction(action, {
      conversation_id: conversation.id,
      ...payload,
    });
    afterWrite?.();
    await history.reload();
    await social.refresh();
  };
  return (
    <>
      <header className="page-heading">
        <div>
          <h2>DM · {peer.display_name}</h2>
          <small>
            {
              presenceLabels[
                visiblePresence(
                  social.data?.presence.find((p) => p.user_id === peer.id),
                  social.now,
                )
              ]
            }
          </small>
        </div>
        <button
          onClick={() =>
            void task.run(async () => {
              await markRead();
              await social.refresh();
            })
          }
        >
          Marcar como lida
        </button>
        <button
          disabled={task.busy}
          onClick={() =>
            void task.run(async () => {
              await socialAction(
                social.data?.blocks.includes(peer.id) ? "unblock" : "block",
                { user_id: peer.id },
              );
              await social.refresh();
            })
          }
        >
          {social.data?.blocks.includes(peer.id) ? "Desbloquear" : "Bloquear"}{" "}
          {peer.display_name}
        </button>
      </header>
      <ErrorNotice text={task.error || history.error} />
      <div className="dm-history">
        {rows.length === pages * 40 && (
          <button onClick={() => setPages((p) => p + 1)}>
            Carregar mensagens anteriores
          </button>
        )}
        {rows.map((m) => (
          <article
            className="message dm-message"
            key={m.id}
            data-message-id={m.id}
          >
            <Avatar
              userId={m.author_id}
              url={
                m.author_id === profile.id
                  ? profile.avatar_url
                  : peer.avatar_url
              }
              name={
                m.author_id === profile.id
                  ? profile.display_name
                  : peer.display_name
              }
              size={30}
            />
            <div>
              <header>
                <b>
                  {m.author_id === profile.id
                    ? profile.display_name
                    : peer.display_name}
                </b>{" "}
                <time dateTime={m.created_at}>
                  {new Date(m.created_at).toLocaleString()}
                </time>
                {m.edited_at && !m.deleted_at && <small> · editada</small>}
              </header>
              {m.reply && (
                <blockquote>
                  {m.reply.deleted_at ? "Mensagem excluída" : m.reply.content}
                </blockquote>
              )}
              <p className="dm-content">
                {m.deleted_at ? "Mensagem excluída" : m.content}
              </p>
              {!m.deleted_at && (
                <div>
                  <button onClick={() => setReply(m)}>Responder</button>
                  {m.author_id === profile.id && (
                    <>
                      <button
                        onClick={() => {
                          setEditing(m);
                          setEditText(m.content);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        disabled={task.busy}
                        onClick={() =>
                          void task.run(async () => {
                            if (!confirm("Excluir sua mensagem privada?"))
                              return;
                            await perform("delete_dm", { message_id: m.id });
                          })
                        }
                      >
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              await perform("edit_dm", {
                message_id: editing.id,
                content: editText,
              });
              setEditing(null);
            });
          }}
        >
          <label>
            Editar mensagem privada
            <textarea
              required
              maxLength={4000}
              aria-label="Editar mensagem privada"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
          </label>
          <Submit busy={task.busy}>Salvar mensagem privada</Submit>
          <button type="button" onClick={() => setEditing(null)}>
            Cancelar edição
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              await perform(
                "send_dm",
                {
                  content,
                  reply_to: reply?.id || null,
                },
                () => {
                  // Clear only the draft that was sent, before history refreshes.
                  // Text typed during the request belongs to the next message.
                  setContent((current) => (current === content ? "" : current));
                  setReply((current) =>
                    current?.id === reply?.id ? null : current,
                  );
                },
              );
            });
          }}
        >
          {reply && (
            <div>
              Respondendo a: {reply.content}
              <button type="button" onClick={() => setReply(null)}>
                Cancelar resposta
              </button>
            </div>
          )}
          <label>
            Mensagem privada
            <textarea
              required
              maxLength={4000}
              aria-label="Mensagem privada"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
          <Submit busy={task.busy}>Enviar DM</Submit>
        </form>
      )}
    </>
  );
}
