import type { OpenUserProfile } from "../profile/UserProfilePopover";
import React, { useEffect, useRef, useState } from "react";
import {
  Send,
  Hash,
  Reply,
  Smile,
  X,
  MoreHorizontal,
  Plus,
  Download,
  FileText,
} from "lucide-react";
import type { Channel, Message, MessageAttachment, Profile } from "../../types";
import { Avatar, ErrorNotice, useTask } from "../../components/ui";
import { supabase, messageOf } from "../../lib/supabase";
import { isStaff } from "../../lib/permissions";
import * as chat from "../../services/chat";
import { continuesMessageGroup } from "./presentation";
import {
  groupReactions,
  isDifferentDay,
  formatDateSeparator,
} from "./chat-helpers";
import { EmojiPicker } from "./EmojiPicker";
import { ImageLightboxModal } from "./ImageLightboxModal";
import { MessageContextMenu } from "./MessageContextMenu";
import {
  uploadAttachment,
  formatFileSize,
  isImageMime,
} from "../../services/attachments";
import "./modern-chat.css";

export function Chat({
  channel,
  profile,
  communityTag,
  onUserProfile,
  lastReadAt,
  onMarkAsRead,
  canSendMessages = true,
}: {
  channel: Channel;
  profile: Profile;
  communityTag?: string | null;
  onUserProfile?: OpenUserProfile;
  lastReadAt?: string | null;
  onMarkAsRead?: (channelId: string, latestMessageId?: string) => void;
  canSendMessages?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [more, setMore] = useState(false);

  const [newCount, setNewCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<
    Map<string, { name: string; time: number }>
  >(new Map());
  const [connection, setConnection] = useState(
    supabase ? "Conectando…" : "Somente neste computador",
  );

  // Attachments state
  const [pendingAttachments, setPendingAttachments] = useState<
    MessageAttachment[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals & Popovers state
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<{
    messageId: string;
    x: number;
    y: number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    message: Message;
    x: number;
    y: number;
  } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);

  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditText, setInlineEditText] = useState("");

  const task = useTask();
  const scroll = useRef<HTMLDivElement>(null);
  const near = useRef(true);
  const typingAt = useRef(0);
  const typingSend = useRef<(stop?: boolean) => void>(() => {});
  const realtimeChannel = useRef<ReturnType<
    NonNullable<typeof supabase>["channel"]
  > | null>(null);

  const cutoffRef = useRef<string | null>(lastReadAt || null);

  useEffect(() => {
    cutoffRef.current = lastReadAt || null;
  }, [channel.id]);

  useEffect(() => {
    if (messages.length > 0) {
      const latest = messages[messages.length - 1];
      onMarkAsRead?.(channel.id, latest.id);
    }
  }, [messages, channel.id, onMarkAsRead]);

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
        if (near.current)
          timer = setTimeout(() => {
            scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
          }, 30);
        else setNewCount((n) => n + 1);
      } catch (e) {
        if (active) {
          task.setError(messageOf(e));
        }
      }
    };

    void reload();

    // Clean up stale typing indicators (older than 6 seconds)
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, val] of next.entries()) {
          if (now - val.time > 6000) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

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
          if (payload.eventType === "DELETE") {
            setMessages((m) => m.filter((x) => x.id !== payload.old.id));
          } else {
            void reload();
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
        if (payload.id !== profile.id) {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            if (payload.stop) {
              next.delete(payload.id);
            } else {
              next.set(payload.id, {
                name: String(payload.name).slice(0, 40),
                time: Date.now(),
              });
            }
            return next;
          });
        }
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

    realtimeChannel.current = realtime || null;

    typingSend.current = (stop = false) => {
      if (stop) {
        void realtime?.send({
          type: "broadcast",
          event: "typing",
          payload: { id: profile.id, stop: true },
        });
        return;
      }
      if (Date.now() - typingAt.current > 1500) {
        typingAt.current = Date.now();
        void realtime?.send({
          type: "broadcast",
          event: "typing",
          payload: { id: profile.id, name: profile.display_name, stop: false },
        });
      }
    };

    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(interval);
      if (realtime) void supabase?.removeChannel(realtime);
    };
  }, [channel.id, profile.id, profile.username, profile.display_name, channel.name]);

  const refresh = async () => {
    const rows = await chat.history(channel.id);
    setMessages(rows);
    setMore(rows.length === 40);
    setTimeout(
      () => scroll.current?.scrollTo({ top: scroll.current.scrollHeight }),
      20,
    );
  };

  const handleJumpToReply = (replyId: string) => {
    const targetEl = document.querySelector(`[data-message-id="${replyId}"]`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(replyId);
      setTimeout(() => {
        setHighlightedMessageId((curr) => (curr === replyId ? null : curr));
      }, 1600);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    for (const file of files) {
      try {
        const uploaded = await uploadAttachment(file, profile.id);
        setPendingAttachments((prev) => [...prev, uploaded]);
      } catch (err) {
        task.setError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  // Clipboard paste handler (Ctrl + V with image)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const uploaded = await uploadAttachment(file, profile.id);
            setPendingAttachments((prev) => [...prev, uploaded]);
          } catch (err) {
            task.setError(err instanceof Error ? err.message : String(err));
          }
        }
      }
    }
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const uploaded = await uploadAttachment(file, profile.id);
        setPendingAttachments((prev) => [...prev, uploaded]);
      } catch (err) {
        task.setError(err instanceof Error ? err.message : String(err));
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Format typing label
  const typingNames = Array.from(typingUsers.values()).map((v) => v.name);
  let typingLabel = "";
  if (typingNames.length === 1) {
    typingLabel = `${typingNames[0]} está digitando…`;
  } else if (typingNames.length === 2) {
    typingLabel = `${typingNames[0]} e ${typingNames[1]} estão digitando…`;
  } else if (typingNames.length > 2) {
    typingLabel = `${typingNames[0]}, ${typingNames[1]} e mais ${typingNames.length - 2} pessoas estão digitando…`;
  }

  // Render content with highlighted @mentions
  const renderContent = (content: string) => {
    if (!content) return null;
    const parts = content.split(/(@[a-zA-Z0-9_-]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const isSelf =
          part.toLowerCase() === `@${profile.username.toLowerCase()}`;
        return (
          <span key={i} className={`mention-tag ${isSelf ? "is-self" : ""}`}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div
      className="chat-view"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="chat-drag-overlay">
          <FileText size={48} />
          <span>Solte para enviar o arquivo</span>
        </div>
      )}

      {/* Channel Header */}
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

      {/* Messages Scroll Area */}
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

        {messages.map((m, index) => {
          const prevMsg = messages[index - 1];
          const grouped = continuesMessageGroup(prevMsg, m);
          const showDateSeparator = isDifferentDay(
            m.created_at,
            prevMsg?.created_at,
          );

          const original = m.reply_to
            ? messages.find((x) => x.id === m.reply_to)
            : undefined;

          const groupedRx = groupReactions(m.message_reactions, profile.id);
          const isHighlighted = highlightedMessageId === m.id;

          const isFirstUnread = Boolean(
            cutoffRef.current &&
              m.created_at > cutoffRef.current &&
              (!prevMsg || prevMsg.created_at <= cutoffRef.current),
          );

          const isMentioned = Boolean(
            profile?.username &&
              m.content &&
              (m.content.toLowerCase().includes(`@${profile.username.toLowerCase()}`) ||
                m.content.includes("@everyone") ||
                m.content.includes("@here")),
          );

          return (
            <React.Fragment key={m.id}>
              {/* Date Separator */}
              {showDateSeparator && (
                <div className="chat-date-separator">
                  <div className="chat-date-line" />
                  <span className="chat-date-badge">
                    {formatDateSeparator(m.created_at)}
                  </span>
                  <div className="chat-date-line" />
                </div>
              )}

              {/* New Messages Separator */}
              {isFirstUnread && (
                <div
                  className="new-messages-separator"
                  role="separator"
                  aria-label="Novas mensagens"
                >
                  <div className="new-messages-line" />
                  <span className="new-messages-badge">NOVAS MENSAGENS</span>
                  <div className="new-messages-line" />
                </div>
              )}

              <article
                className={
                  "message" +
                  (grouped ? " message-grouped" : " message-group-start") +
                  (isHighlighted ? " message-highlight-flash" : "") +
                  (isMentioned ? " message-mentioned" : "")
                }
                data-message-id={m.id}
                aria-label={m.profiles?.display_name || "Membro"}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    message: m,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
              >
                {/* Discrete Hover Action Bar (😊 ↩ ⋯) */}
                <div className="msg-hover-actions">
                  <button
                    type="button"
                    className="msg-hover-btn"
                    title="Adicionar reação"
                    aria-label="Adicionar reação"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setActiveEmojiPicker({
                        messageId: m.id,
                        x: Math.max(10, rect.right - 320),
                        y: rect.top - 370,
                      });
                    }}
                  >
                    <Smile size={16} />
                  </button>

                  <button
                    type="button"
                    className="msg-hover-btn"
                    title="Responder"
                    aria-label="Responder"
                    onClick={() => {
                      setReply(m);
                      setEditing(null);
                    }}
                  >
                    <Reply size={16} />
                  </button>

                  <button
                    type="button"
                    className="msg-hover-btn"
                    title="Mais opções"
                    aria-label="Mais opções"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setContextMenu({
                        message: m,
                        x: Math.max(10, rect.right - 190),
                        y: rect.bottom + 4,
                      });
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>

                {/* Reply Reference Preview */}
                {m.reply_to && (
                  <button
                    type="button"
                    className="reply-reference-badge"
                    onClick={() => handleJumpToReply(m.reply_to!)}
                    title="Ir para mensagem respondida"
                  >
                    <span aria-hidden="true">↳</span>
                    <span className="reply-author">
                      {original?.profiles?.display_name || "Membro"}
                    </span>
                    {original?.deleted_at ? (
                      <span className="reply-deleted">
                        Mensagem original excluída.
                      </span>
                    ) : (
                      <span className="reply-snippet">
                        {original?.content ||
                          (original?.attachments?.length
                            ? "[Anexo]"
                            : "Mensagem anterior")}
                      </span>
                    )}
                  </button>
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
                      m.webhook_name
                        ? "Webhook " + m.webhook_name
                        : "Ver perfil de " +
                          (m.profiles?.display_name || "Membro")
                    }
                    onClick={(e) => {
                      if (m.webhook_name) return;
                      onUserProfile?.(m.author_id, e.currentTarget, m.profiles);
                    }}
                    style={m.webhook_name ? { cursor: "default" } : undefined}
                  >
                    <Avatar
                      userId={m.author_id}
                      name={
                        m.webhook_name || m.profiles?.display_name || "Membro"
                      }
                      url={m.webhook_avatar_url || m.profiles?.avatar_url}
                      size={40}
                    />
                  </button>
                )}

                <div className="message-body">
                  {!grouped && (
                    <div className="message-meta">
                      <b>
                        {m.webhook_name ? (
                          <span className="webhook-author-name">
                            {m.webhook_name}
                            <span className="bot-tag">BOT</span>
                          </span>
                        ) : (
                          <>
                            {communityTag && (
                              <span
                                className="community-author-tag"
                                title={`Tag do servidor: ${communityTag}`}
                              >
                                [{communityTag}]
                              </span>
                            )}
                            <button
                              type="button"
                              className="user-profile-name-trigger"
                              data-profile-trigger={m.author_id}
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
                          </>
                        )}
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
                  )}

                  {/* Inline Message Edit Form */}
                  {inlineEditingId === m.id ? (
                    <form
                      className="inline-edit-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void task.run(async () => {
                          await chat.edit(m.id, inlineEditText);
                          setInlineEditingId(null);
                          await refresh();
                        });
                      }}
                    >
                      <input
                        autoFocus
                        className="inline-edit-input"
                        value={inlineEditText}
                        onChange={(e) => setInlineEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setInlineEditingId(null);
                        }}
                      />
                      <div className="inline-edit-actions">
                        <span>escape para cancelar • enter para salvar</span>
                        <button
                          type="button"
                          className="cancel-btn"
                          onClick={() => setInlineEditingId(null)}
                        >
                          Cancelar
                        </button>
                        <button type="submit" className="save-btn">
                          Salvar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {m.deleted_at ? (
                        <p style={{ fontStyle: "italic", color: "#64748b" }}>
                          Mensagem excluída
                        </p>
                      ) : (
                        m.content && (
                          <p>
                            {renderContent(m.content)}
                            {m.edited_at && (
                              <small className="message-edited">
                                {" "}
                                (editado)
                              </small>
                            )}
                          </p>
                        )
                      )}
                    </>
                  )}

                  {/* Message Attachments Grid */}
                  {!m.deleted_at &&
                    m.attachments &&
                    m.attachments.length > 0 && (
                      <div className="message-attachments-grid">
                        {m.attachments.map((att) => {
                          if (isImageMime(att.content_type)) {
                            return (
                              <div
                                key={att.id}
                                className="msg-image-attachment-wrap"
                                onClick={() =>
                                  setLightboxImage({
                                    url: att.url,
                                    name: att.name,
                                  })
                                }
                                title="Clique para expandir imagem"
                              >
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  loading="lazy"
                                />
                              </div>
                            );
                          }
                          return (
                            <a
                              key={att.id}
                              href={att.url}
                              download={att.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="msg-file-attachment-card"
                            >
                              <div className="msg-file-icon">
                                <FileText size={20} />
                              </div>
                              <div className="msg-file-info">
                                <span
                                  className="msg-file-name"
                                  title={att.name}
                                >
                                  {att.name}
                                </span>
                                <span className="msg-file-size">
                                  {formatFileSize(att.size)}
                                </span>
                              </div>
                              <Download size={16} className="msg-file-action" />
                            </a>
                          );
                        })}
                      </div>
                    )}

                  {/* Multi-Emoji Reactions List */}
                  {!m.deleted_at && groupedRx.length > 0 && (
                    <div className="msg-reactions-list">
                      {groupedRx.map((gr) => (
                        <button
                          key={gr.emoji}
                          type="button"
                          className={`msg-reaction-pill ${gr.reactedByMe ? "reacted" : ""}`}
                          title={`${gr.count} ${gr.count === 1 ? "pessoa reagiu" : "pessoas reagiram"}`}
                          onClick={() =>
                            void task.run(async () => {
                              await chat.reactTo(m, profile.id, gr.emoji);
                              await refresh();
                            })
                          }
                        >
                          <span>{gr.emoji}</span>
                          <span>{gr.count}</span>
                        </button>
                      ))}

                      <button
                        type="button"
                        className="msg-reaction-pill add-pill"
                        title="Adicionar reação"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setActiveEmojiPicker({
                            messageId: m.id,
                            x: Math.max(10, rect.left),
                            y: rect.top - 370,
                          });
                        }}
                      >
                        <Smile size={13} />
                        <span>+</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            </React.Fragment>
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

      {/* Composer Area */}
      <div className="composer-wrap">
        {/* Hidden File Picker Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />

        {/* Pending Attachments Preview in Composer */}
        {pendingAttachments.length > 0 && (
          <div className="composer-pending-attachments">
            {pendingAttachments.map((att) => (
              <div key={att.id} className="pending-attach-thumb">
                {isImageMime(att.content_type) ? (
                  <img src={att.url} alt={att.name} />
                ) : (
                  <div className="pending-attach-file">
                    <FileText size={20} />
                    <span>{att.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  className="pending-attach-remove"
                  title="Remover anexo"
                  onClick={() =>
                    setPendingAttachments((prev) =>
                      prev.filter((x) => x.id !== att.id),
                    )
                  }
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {(reply || editing) && (
          <div className="reply-banner">
            {editing
              ? "Editando mensagem"
              : "Respondendo a " + reply?.profiles?.display_name}
            <button
              type="button"
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
              if (editing) {
                await chat.edit(editing.id, text);
              } else {
                await chat.send(
                  channel.id,
                  profile.id,
                  text,
                  reply?.id || null,
                  pendingAttachments,
                );
                typingSend.current(true);
              }
              setText("");
              setReply(null);
              setEditing(null);
              setPendingAttachments([]);
              await refresh();
            });
          }}
        >
          {/* Attach Button (+) */}
          <button
            type="button"
            className="composer-attach-btn"
            title="Adicionar arquivo ou imagem"
            aria-label="Adicionar arquivo ou imagem"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canSendMessages}
          >
            <Plus size={18} />
          </button>

          <input
            aria-label="Mensagem"
            maxLength={4000}
            value={text}
            disabled={!canSendMessages}
            onChange={(e) => {
              setText(e.target.value);
              typingSend.current(false);
            }}
            onPaste={handlePaste}
            placeholder={
              !canSendMessages
                ? "Você não tem permissão para enviar mensagens neste canal."
                : "Conversar em #" + channel.name
            }
          />

          <button
            className="primary"
            disabled={
              !canSendMessages ||
              task.busy ||
              (!text.trim() && pendingAttachments.length === 0)
            }
            title="Enviar mensagem"
          >
            <Send size={18} />
          </button>
        </form>

        <div className="composer-hint">
          {typingLabel ? (
            <span className="modern-typing-indicator">
              <span className="typing-dots">
                <i className="typing-dot" />
                <i className="typing-dot" />
                <i className="typing-dot" />
              </span>
              {typingLabel}
            </span>
          ) : (
            <span />
          )}
          {text.length >= 3600 && <span>{text.length}/4000</span>}
        </div>
      </div>

      {/* Emoji Picker Popover */}
      {activeEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => {
            const targetMsg = messages.find(
              (m) => m.id === activeEmojiPicker.messageId,
            );
            if (targetMsg) {
              void task.run(async () => {
                await chat.reactTo(targetMsg, profile.id, emoji);
                await refresh();
              });
            }
            setActiveEmojiPicker(null);
          }}
          onClose={() => setActiveEmojiPicker(null)}
          position="top"
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          content={contextMenu.message.content}
          messageId={contextMenu.message.id}
          isAuthor={contextMenu.message.author_id === profile.id}
          canDelete={
            contextMenu.message.author_id === profile.id ||
            isStaff(profile.role)
          }
          onAddReaction={() => {
            setActiveEmojiPicker({
              messageId: contextMenu.message.id,
              x: contextMenu.x,
              y: contextMenu.y - 360,
            });
          }}
          onReply={() => {
            setReply(contextMenu.message);
            setEditing(null);
          }}
          onEdit={() => {
            setInlineEditingId(contextMenu.message.id);
            setInlineEditText(contextMenu.message.content);
          }}
          onDelete={() => {
            if (confirm("Excluir esta mensagem?")) {
              void task.run(async () => {
                await chat.remove(contextMenu.message.id);
                await refresh();
              });
            }
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <ImageLightboxModal
          url={lightboxImage.url}
          name={lightboxImage.name}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}
