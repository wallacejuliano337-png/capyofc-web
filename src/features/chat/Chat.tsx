import type { OpenUserProfile } from "../profile/UserProfilePopover";
import { useEffect, useRef, useState } from "react";
import { Send, Hash, Reply, Pencil, Trash2, Smile, X } from "lucide-react";
import type { Channel, Message, Profile } from "../../types";
import { Avatar, Empty, ErrorNotice, useTask } from "../../components/ui";
import { supabase, messageOf } from "../../lib/supabase";
import { isStaff } from "../../lib/permissions";
import * as chat from "../../services/chat";
import { continuesMessageGroup } from "./presentation";
export function Chat({
  channel,
  profile,
  onUserProfile,
}: {
  channel: Channel;
  profile: Profile;
  onUserProfile?: OpenUserProfile;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [typing, setTyping] = useState<string[]>([]);
  const [connection, setConnection] = useState(
    supabase ? "Conectando…" : "Somente neste computador",
  );
  const task = useTask();
  const scroll = useRef<HTMLDivElement>(null);
  const near = useRef(true);
  const typingAt = useRef(0);
  const typingSend = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let initial = true;
    const reload = async () => {
      try {
        const rows = await chat.history(channel.id);
        if (!active) return;
        setMessages((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          rows.forEach((m) => map.set(m.id, m));
          return [...map.values()].sort((a, b) =>
            a.created_at.localeCompare(b.created_at),
          );
        });
        if (initial) {
          setMore(rows.length === 40);
          initial = false;
        }
        setLoading(false);
        if (near.current)
          timer = setTimeout(() => {
            scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
          }, 30);
        else setNewCount((n) => n + 1);
      } catch (e) {
        if (active) {
          task.setError(messageOf(e));
          setLoading(false);
        }
      }
    };
    void reload();
    const interval = setInterval(() => {
      setTyping([]);
    }, 4000);
    const realtime = supabase
      ?.channel("room:" + channel.id, { config: { private: true } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: "channel_id=eq." + channel.id,
        },
        (payload) => {
          if (payload.eventType === "DELETE")
            setMessages((m) => m.filter((x) => x.id !== payload.old.id));
          else {
            void reload();
            if (
              payload.eventType === "INSERT" &&
              payload.new.author_id !== profile.id &&
              String(payload.new.content).includes("@" + profile.username)
            )
              void window.arena?.notify(
                "Menção no LYC Arena",
                "Você foi mencionado em #" + channel.name,
              );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) =>
          setMessages((m) => m.filter((x) => x.id !== payload.old.id)),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => void reload(),
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.id !== profile.id)
          setTyping([String(payload.name).slice(0, 40)]);
      })
      .subscribe((status) => {
        setConnection(
          status === "SUBSCRIBED"
            ? "Conectado"
            : status === "CHANNEL_ERROR"
              ? "Sem conexão — tentando reconectar"
              : status,
        );
        if (status === "SUBSCRIBED") void reload();
      });
    typingSend.current = () => {
      if (Date.now() - typingAt.current > 1500) {
        typingAt.current = Date.now();
        void realtime?.send({
          type: "broadcast",
          event: "typing",
          payload: { id: profile.id, name: profile.display_name },
        });
      }
    };
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(interval);
      if (realtime) void supabase?.removeChannel(realtime);
    };
    // Channel views are remounted on navigation.
  }, [channel.id, profile.id, profile.username, channel.name]);
  const refresh = async () => {
    const rows = await chat.history(channel.id);
    setMessages(rows);
    setMore(rows.length === 40);
    setTimeout(
      () => scroll.current?.scrollTo({ top: scroll.current.scrollHeight }),
      20,
    );
  };
  return (
    <div className="chat-view">
      <div className="channel-heading">
        <Hash size={25} />
        <div>
          <h2>{channel.name}</h2>
          {channel.description && (
            <p title={channel.description}>{channel.description}</p>
          )}
        </div>
        <span
          className={
            "connection chat-connection" +
            (connection === "Conectado" ? " is-connected" : "")
          }
          role="status"
          aria-label={connection}
          title={connection}
        >
          <span className="chat-visually-hidden">{connection}</span>
          <i />
        </span>
      </div>
      <ErrorNotice text={task.error} />
      <div
        className="message-scroll"
        ref={scroll}
        onScroll={() => {
          const el = scroll.current!;
          near.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          if (near.current) setNewCount(0);
        }}
      >
        {more && (
          <button
            className="load-more"
            disabled={task.busy}
            onClick={() =>
              void task.run(async () => {
                const el = scroll.current;
                const height = el?.scrollHeight || 0;
                const older = await chat.history(
                  channel.id,
                  messages[0]?.created_at,
                );
                setMessages((m) => [...older, ...m]);
                setMore(older.length === 40);
                setTimeout(() => {
                  if (el) el.scrollTop = el.scrollHeight - height;
                }, 0);
              })
            }
          >
            Carregar mensagens anteriores
          </button>
        )}
        {messages.length === 0 && (
          <Empty
            title={
              loading ? "Carregando conversa…" : "Sua comunidade começa aqui"
            }
          >
            Este é o início de #{channel.name}. Envie a primeira mensagem.
          </Empty>
        )}
        {messages.map((m, index) => {
          const grouped = continuesMessageGroup(messages[index - 1], m);
          const original = m.reply_to
            ? messages.find((x) => x.id === m.reply_to)
            : undefined;
          return (
            <article
              className={
                "message" +
                (grouped ? " message-grouped" : " message-group-start")
              }
              key={m.id}
              aria-label={m.profiles?.display_name || "Membro"}
            >
              {m.reply_to && (
                <blockquote className="message-reply-preview">
                  <span aria-hidden="true">↳</span>
                  <b>{original?.profiles?.display_name || "Membro"}</b>
                  <span title={original?.content}>
                    {original?.content || "Mensagem anterior"}
                  </span>
                </blockquote>
              )}
              {grouped ? (
                <time
                  className="message-gutter-time"
                  dateTime={m.created_at}
                  title={new Date(m.created_at).toLocaleString("pt-BR")}
                >
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              ) : (
                <button
                  type="button"
                  className="user-profile-avatar-trigger"
                  data-profile-trigger={m.author_id}
                  aria-label={
                    "Ver perfil de " + (m.profiles?.display_name || "Membro")
                  }
                  onClick={(e) =>
                    onUserProfile?.(m.author_id, e.currentTarget, m.profiles)
                  }
                >
                  <Avatar
                    userId={m.author_id}
                    name={m.profiles?.display_name || "Membro"}
                    url={m.profiles?.avatar_url}
                    size={40}
                  />
                </button>
              )}
              <div className="message-body">
                <div
                  className={
                    grouped
                      ? "message-meta chat-visually-hidden"
                      : "message-meta"
                  }
                >
                  <b>
                    <button
                      type="button"
                      className="user-profile-name-trigger"
                      data-profile-trigger={m.author_id}
                      tabIndex={grouped ? -1 : 0}
                      onClick={(e) =>
                        onUserProfile?.(
                          m.author_id,
                          e.currentTarget,
                          m.profiles,
                        )
                      }
                    >
                      {m.profiles?.display_name || "Membro"}
                    </button>
                  </b>
                  <time
                    dateTime={m.created_at}
                    title={new Date(m.created_at).toLocaleString("pt-BR")}
                  >
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p>
                  {m.content}
                  {m.edited_at && (
                    <small className="message-edited"> (editado)</small>
                  )}
                </p>
                {Boolean(m.message_reactions?.length) && (
                  <button
                    className="reaction"
                    onClick={() =>
                      void task.run(async () => {
                        await chat.reactTo(m, profile.id);
                        await refresh();
                      })
                    }
                  >
                    🔥 {m.message_reactions?.length}
                  </button>
                )}
              </div>
              <div className="message-actions">
                <button
                  title="Responder"
                  onClick={() => {
                    setReply(m);
                    setEditing(null);
                  }}
                >
                  <Reply size={15} />
                </button>
                <button
                  title="Reagir"
                  onClick={() =>
                    void task.run(async () => {
                      await chat.reactTo(m, profile.id);
                      await refresh();
                    })
                  }
                >
                  <Smile size={15} />
                </button>
                {m.author_id === profile.id && (
                  <button
                    title="Editar"
                    onClick={() => {
                      setEditing(m);
                      setText(m.content);
                      setReply(null);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                )}
                {(m.author_id === profile.id || isStaff(profile.role)) && (
                  <button
                    title="Excluir"
                    onClick={() =>
                      void task.run(async () => {
                        await chat.remove(m.id);
                        await refresh();
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {newCount > 0 && (
        <button
          className="new-messages"
          onClick={() =>
            scroll.current?.scrollTo({
              top: scroll.current.scrollHeight,
              behavior: "smooth",
            })
          }
        >
          Novas mensagens ↓
        </button>
      )}
      <div className="composer-wrap">
        {(reply || editing) && (
          <div className="reply-banner">
            {editing
              ? "Editando mensagem"
              : "Respondendo a " + reply?.profiles?.display_name}
            <button
              onClick={() => {
                setReply(null);
                setEditing(null);
                setText("");
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              if (editing) await chat.edit(editing.id, text);
              else
                await chat.send(
                  channel.id,
                  profile.id,
                  text,
                  reply?.id || null,
                );
              setText("");
              setReply(null);
              setEditing(null);
              await refresh();
            });
          }}
        >
          <input
            aria-label="Mensagem"
            maxLength={4000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              typingSend.current();
            }}
            placeholder={"Conversar em #" + channel.name}
          />
          <button
            className="primary"
            disabled={task.busy || !text.trim()}
            title="Enviar mensagem"
          >
            <Send size={18} />
          </button>
        </form>
        <div className="composer-hint">
          {typing.length ? typing.join(", ") + " está digitando…" : ""}
          {text.length >= 3600 && <span>{text.length}/4000</span>}
        </div>
      </div>
    </div>
  );
}
