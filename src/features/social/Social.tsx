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
  ArrowLeft,
  Radio,
  Award,
  Flame,
  MoreVertical,
  Phone,
  PhoneMissed,
  Video,
  Smile,
  Reply,
  MoreHorizontal,
  Plus,
  Download,
  FileText,
} from "lucide-react";
import type { OpenUserProfile } from "../profile/UserProfilePopover";
import "./social-layout.css";
import "../chat/modern-chat.css";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, ErrorNotice, Modal, Submit, useTask } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import type { useSocial } from "../../hooks/useSocial";
import type { DMCallState } from "../../hooks/useDMCall";
import { ActiveCallStage } from "../voice/ActiveCallStage";
import {
  getConversationCalls,
  formatCallDuration,
  type DMCall,
} from "../../services/dm-calls";
import {
  dmHistory,
  findPeople,
  findPersonByUsername,
  friendRequestStatus,
  type PublicPerson,
  presenceLabels,
  socialAction,
  visiblePresence,
  type Conversation,
  type DirectMessage,
} from "../../services/social";
import { supabase } from "../../lib/supabase";
import { EmojiPicker } from "../chat/EmojiPicker";
import { ImageLightboxModal } from "../chat/ImageLightboxModal";
import { MessageContextMenu } from "../chat/MessageContextMenu";
import {
  uploadAttachment,
  formatFileSize,
  isImageMime,
} from "../../services/attachments";
import {
  groupReactions,
  isDifferentDay,
  formatDateSeparator,
} from "../chat/chat-helpers";
import type { MessageAttachment, Profile } from "../../types";
import { LycPlusPage } from "./LycPlusPage";

type SocialState = ReturnType<typeof useSocial>;

const socialNavigation = [
  { name: "Amigos", icon: Users },
  { name: "Solicitações de mensagens", icon: Inbox },
  { name: "LYC+ ✦", icon: Sparkles },
  { name: "Loja", icon: ShoppingBag, badge: "NOVO" },
  { name: "Missões", icon: Flag },
] as const;

export function Social({
  profile,
  social,
  navigationHost,
  onUserProfile,
  dmCall,
  selectedConversationId,
  onSelectConversation,
  isVoiceActive,
  onLeaveVoice,
}: {
  profile: Profile;
  social: SocialState;
  navigationHost?: HTMLElement | null;
  onUserProfile?: OpenUserProfile;
  dmCall?: DMCallState;
  selectedConversationId?: string | null;
  onSelectConversation?: (id: string | null) => void;
  isVoiceActive?: boolean;
  onLeaveVoice?: () => void;
}) {
  const [view, setView] = useState<(typeof socialNavigation)[number]["name"]>("Amigos");
  const [tab, setTab] = useState<
    "Disponível" | "Todos" | "Pendente" | "Adicionar amigo" | "Bloqueados"
  >("Disponível");
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState("");
  const [searchFeedback, setSearchFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "remove" | "block";
    targetId: string;
    targetName: string;
  } | null>(null);
  const task = useTask();
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selected =
    selectedConversationId !== undefined
      ? selectedConversationId
      : internalSelected;
  const setSelected = useCallback(
    (id: string | null) => {
      task.setError("");
      setInternalSelected(id);
      onSelectConversation?.(id);
    },
    [onSelectConversation, task],
  );

  const data = social.data;

  // Close friend dropdown menu on click outside or escape
  useEffect(() => {
    if (!activeMenuId) return;
    const handleDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".friend-menu-container")) {
        setActiveMenuId(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenuId(null);
    };
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [activeMenuId]);

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

  // Grouped friends calculations
  const friendsAccepted = (data?.friends || []).filter(
    (f) => f.state === "accepted",
  );
  const pendingRequests = (data?.friends || []).filter(
    (f) => f.state === "pending",
  );
  const incomingPending = pendingRequests.filter(
    (f) => f.requester_id !== profile.id,
  );
  const outgoingPending = pendingRequests.filter(
    (f) => f.requester_id === profile.id,
  );

  const allFriendIds = friendsAccepted.map((f) =>
    f.user_low === profile.id ? f.user_high : f.user_low,
  );
  const onlineFriendIds = allFriendIds.filter(
    (id) => status(id) !== "offline",
  );
  const blockedIds = data?.blocks || [];

  const filterIds = (ids: string[]) =>
    ids.filter((id) => {
      const p = data?.profiles[id];
      if (!p) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLocaleLowerCase();
      return (
        p.display_name.toLocaleLowerCase().includes(q) ||
        p.username.toLocaleLowerCase().includes(q)
      );
    });

  const availableFiltered = filterIds(onlineFriendIds);
  const allFiltered = filterIds(allFriendIds);
  const blockedFiltered = filterIds(blockedIds);
  const incomingFiltered = filterIds(
    incomingPending.map((f) =>
      f.user_low === profile.id ? f.user_high : f.user_low,
    ),
  );
  const outgoingFiltered = filterIds(
    outgoingPending.map((f) =>
      f.user_low === profile.id ? f.user_high : f.user_low,
    ),
  );

  const conversation = data?.conversations.find((c) => c.id === selected);
  const pendingCount = incomingPending.length;

  const person = (p: PublicPerson) => {
    const friendStatus = status(p.id);
    const label =
      presenceLabels[friendStatus] ||
      (friendStatus !== "offline" ? "Online" : "Offline");
    return (
      <>
        <button
          type="button"
          className="social-avatar-trigger"
          data-profile-trigger={p.id}
          aria-label={"Ver perfil de " + p.display_name}
          onClick={(e) => {
            e.stopPropagation();
            onUserProfile?.(p.id, e.currentTarget, data?.profiles[p.id]);
          }}
        >
          <Avatar userId={p.id} name={p.display_name} url={p.avatar_url} size={36} />
          <i className={"presence-dot presence-" + friendStatus} />
        </button>
        <div className="social-person-identity">
          <button
            type="button"
            data-profile-trigger={p.id}
            className="social-name-trigger"
            onClick={(e) => {
              e.stopPropagation();
              onUserProfile?.(p.id, e.currentTarget, data?.profiles[p.id]);
            }}
          >
            {p.display_name}
          </button>
          <small>
            @{p.username} ·{" "}
            <span data-presence-for={p.id}>{label}</span>
          </small>
        </div>
      </>
    );
  };

  const navigation = (
    <div className="social-navigation">
      <div className="social-navigation-title">Amigos e DMs</div>
      <nav aria-label="Navegação de Amigos e DMs">
        {socialNavigation.map(({ name, icon: Icon, ...item }) => (
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
            {"badge" in item && item.badge && (
              <small className="social-new-badge">{item.badge}</small>
            )}
          </button>
        ))}
      </nav>

      <div className="social-dm-section">
        <div className="social-dm-header">
          <span>Mensagens diretas</span>
        </div>
        <div className="social-dm-list">
          {(data?.conversations || []).map((conv) => {
            const peer = data?.profiles[conv.peer_id];
            if (!peer) return null;
            return (
              <button
                key={conv.id}
                type="button"
                className={
                  "social-dm-item" + (selected === conv.id ? " active" : "")
                }
                onClick={() => setSelected(conv.id)}
              >
                <span className="dm-avatar-wrapper">
                  <Avatar
                    userId={peer.id}
                    name={peer.display_name}
                    url={peer.avatar_url}
                    size={28}
                  />
                  <i className={"presence-dot presence-" + status(peer.id)} />
                </span>
                <div className="dm-info">
                  <span className="dm-name">{peer.display_name}</span>
                  <small className="dm-username">@{peer.username}</small>
                </div>
                {conv.unread_count > 0 && (
                  <span
                    className="dm-unread-badge"
                    aria-label={conv.unread_count + " mensagens não lidas"}
                  >
                    {conv.unread_count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
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
              dmCall={dmCall}
              onBack={() => setSelected(null)}
              onUserProfile={onUserProfile}
              isVoiceActive={isVoiceActive}
              onLeaveVoice={onLeaveVoice}
            />
          </div>
        ) : view === "Solicitações de mensagens" ? (
          <div className="message-requests-view">
            <header className="social-content-header">
              <div className="social-header-title">
                <Inbox size={20} />
                <h1>Solicitações de mensagens</h1>
              </div>
            </header>
            <div className="message-requests-body">
              <div className="message-requests-filter">
                <button type="button" className="active">Você pode conhecer</button>
                <button type="button">Spam</button>
              </div>
              <div className="social-empty-state">
                <div className="empty-icon-circle">
                  <Inbox size={34} />
                </div>
                <h3>Nenhuma solicitação de mensagem no momento</h3>
                <p>
                  Mensagens diretas de pessoas fora da sua lista de amigos aparecerão aqui
                  para sua aprovação assim que o serviço for conectado ao servidor.
                </p>
                <span className="social-status-tag">
                  Backend em preparação para a próxima etapa
                </span>
              </div>
            </div>
          </div>
        ) : view === "LYC+ ✦" ? (
          <LycPlusPage />
        ) : view === "Loja" ? (
          <div className="shop-view">
            <header className="social-content-header">
              <div className="social-header-title">
                <ShoppingBag size={20} />
                <h1>Loja LYC</h1>
                <small className="social-new-badge">NOVO</small>
              </div>
            </header>
            <div className="shop-body">
              <div className="shop-hero">
                <h2>Colecionáveis & Cosméticos</h2>
                <p>
                  Personalize sua presença com itens temáticos exclusivos inspirados na história e nos campeonatos da LYC.
                </p>
              </div>
              <div className="shop-grid">
                <div className="shop-card">
                  <div className="shop-card-badge">MOLDURA</div>
                  <div className="shop-card-preview frame-darkness">
                    <div className="preview-avatar-circle" />
                  </div>
                  <h4>Moldura Darkness Flame</h4>
                  <p>Efeito de chamas em tons de grafite e violeta para envolver seu avatar.</p>
                  <span className="shop-item-price">Coleção 2026</span>
                </div>
                <div className="shop-card">
                  <div className="shop-card-badge">MOLDURA</div>
                  <div className="shop-card-preview frame-neon">
                    <div className="preview-avatar-circle" />
                  </div>
                  <h4>Moldura Arena Cyber</h4>
                  <p>Borda geométrica de alta precisão com pulso luminoso sutil.</p>
                  <span className="shop-item-price">Coleção 2026</span>
                </div>
                <div className="shop-card">
                  <div className="shop-card-badge">TEMA</div>
                  <div className="shop-card-preview theme-lyc">
                    <div className="preview-theme-gradient" />
                  </div>
                  <h4>Tema Vermelho Arena</h4>
                  <p>Gradiente dinâmico vermelho e grafite para o banner do mini perfil.</p>
                  <span className="shop-item-price">Coleção 2026</span>
                </div>
              </div>
              <div className="social-notice-box">
                <ShoppingBag size={18} />
                <div>
                  <b>Loja em preparação</b>
                  <p>
                    A vitrine de cosméticos do LYC Arena está em desenvolvimento. A compra e resgate de itens serão liberados nas próximas etapas sem cobranças antecipadas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : view === "Missões" ? (
          <div className="missions-view">
            <header className="social-content-header">
              <div className="social-header-title">
                <Flag size={20} />
                <h1>Missões & Temporadas</h1>
              </div>
            </header>
            <div className="missions-body">
              <div className="missions-hero">
                <h2>Desafios de Squad & Recompensas</h2>
                <p>
                  Complete objetivos na comunidade com sua equipe, acumule pontos de temporada e suba de patente na Arena.
                </p>
              </div>
              <div className="missions-list">
                <div className="mission-item">
                  <div className="mission-icon">
                    <Radio size={20} />
                  </div>
                  <div className="mission-info">
                    <h4>Reunião de Squad</h4>
                    <p>Passe 30 minutos em uma sala de voz da comunidade com 2 ou mais pessoas.</p>
                    <div className="mission-progress-bar">
                      <div className="mission-progress-fill" style={{ width: "65%" }} />
                    </div>
                    <small className="mission-progress-label">20 / 30 minutos concluídos</small>
                  </div>
                  <span className="mission-reward">+150 XP</span>
                </div>
                <div className="mission-item">
                  <div className="mission-icon">
                    <Flame size={20} />
                  </div>
                  <div className="mission-info">
                    <h4>Torcida Oficial — Darkness League</h4>
                    <p>Assista a uma transmissão ao vivo de rodada oficial com seu canal aberto.</p>
                    <div className="mission-progress-bar">
                      <div className="mission-progress-fill" style={{ width: "0%" }} />
                    </div>
                    <small className="mission-progress-label">0 / 1 partida assistida</small>
                  </div>
                  <span className="mission-reward">+300 XP</span>
                </div>
                <div className="mission-item">
                  <div className="mission-icon">
                    <Award size={20} />
                  </div>
                  <div className="mission-info">
                    <h4>Conexão de Amizade</h4>
                    <p>Conecte-se com um novo amigo na Arena e envie sua primeira mensagem.</p>
                    <div className="mission-progress-bar">
                      <div className="mission-progress-fill" style={{ width: "100%" }} />
                    </div>
                    <small className="mission-progress-label">Objetivo concluído</small>
                  </div>
                  <span className="mission-reward-completed">Concluído ✓</span>
                </div>
              </div>
              <div className="social-notice-box">
                <Flag size={18} />
                <div>
                  <b>Sistema de Temporadas</b>
                  <p>
                    A sincronização automática de missões e recompensas da Darkness League será conectada nas próximas atualizações competitivas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* View === "Amigos" (Main Page) */
          <>
            <header className="friends-header">
              <div className="friends-header-title">
                <Users size={19} />
                <span>Amigos</span>
              </div>
              <div className="friends-header-divider" />
              <div role="tablist" aria-label="Lista de amigos" className="friends-tabs">
                {(["Disponível", "Todos", "Pendente", "Adicionar amigo"] as const).map(
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
                        void social.refresh();
                      }}
                    >
                      {t}
                      {t === "Pendente" && pendingCount > 0 && (
                        <small className="friends-badge">{pendingCount}</small>
                      )}
                    </button>
                  ),
                )}
              </div>
              <button
                type="button"
                className={"blocked-toggle" + (tab === "Bloqueados" ? " active" : "")}
                onClick={() => {
                  setTab(tab === "Bloqueados" ? "Todos" : "Bloqueados");
                  setQuery("");
                }}
              >
                {tab === "Bloqueados" ? "Voltar para amigos" : "Bloqueados"}
              </button>
            </header>
            <div className="friends-body">
              {tab !== "Adicionar amigo" && (
                <div className="friends-search-wrap">
                  <label className="friends-search">
                    <Search size={15} />
                    <input
                      aria-label="Buscar amigos"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar amigos por nome ou username"
                    />
                    {query && (
                      <button
                        type="button"
                        className="friends-search-clear"
                        onClick={() => setQuery("")}
                        title="Limpar busca"
                        aria-label="Limpar busca"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                </div>
              )}

              {tab === "Adicionar amigo" ? (
                <div className="add-friend-section">
                  <div className="add-friend-header">
                    <h2>ADICIONAR AMIGO</h2>
                    <p className="muted">
                      Você pode adicionar amigos usando o nome de usuário da LYC Arena.
                    </p>
                  </div>
                  <form
                    className="friend-add-search"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setSearchFeedback(null);
                      const trimmed = lookup.trim();
                      const clean = trimmed.replace(/^@/, "").trim().toLowerCase();

                      if (!clean) {
                        setSearchFeedback({
                          type: "error",
                          message: "Digite um nome de usuário.",
                        });
                        return;
                      }

                      if (
                        clean === profile.username.toLowerCase() ||
                        trimmed.toLowerCase() === profile.display_name.toLowerCase()
                      ) {
                        setSearchFeedback({
                          type: "error",
                          message: "Você não pode adicionar a si mesmo.",
                        });
                        return;
                      }

                      await task.run(async () => {
                        let target: PublicPerson | null = await findPersonByUsername(
                          clean,
                          profile.id,
                        ).catch(() => null);

                        if (!target) {
                          const people = await findPeople(clean, profile.id).catch(
                            () => [],
                          );
                          target =
                            people.find(
                              (p) =>
                                p.username.toLowerCase() === clean ||
                                p.display_name.toLowerCase() === clean ||
                                p.display_name.toLowerCase() === trimmed.toLowerCase(),
                            ) || null;
                        }

                        if (!target) {
                          setSearchFeedback({
                            type: "error",
                            message: "Usuário não encontrado.",
                          });
                          return;
                        }

                        if (data?.blocks.includes(target.id)) {
                          setSearchFeedback({
                            type: "error",
                            message:
                              "Interação indisponível com usuário bloqueado.",
                          });
                          return;
                        }

                        const reqStatus = friendRequestStatus(
                          data?.friends || [],
                          profile.id,
                          target.id,
                          data?.blocks.includes(target.id),
                        );

                        if (reqStatus === "Já são amigos") {
                          setSearchFeedback({
                            type: "error",
                            message: "Vocês já são amigos.",
                          });
                          return;
                        }

                        if (reqStatus === "Solicitação enviada") {
                          setSearchFeedback({
                            type: "error",
                            message: "Já existe uma solicitação pendente.",
                          });
                          return;
                        }

                        if (reqStatus === "Solicitação recebida") {
                          try {
                            await socialAction("accept_friend", {
                              user_id: target.id,
                            });
                            await social.refresh();
                            setSearchFeedback({
                              type: "success",
                              message: `Solicitação de amizade de ${target.display_name} aceita!`,
                            });
                            setLookup("");
                          } catch {
                            setSearchFeedback({
                              type: "error",
                              message: "Não foi possível aceitar a solicitação.",
                            });
                          }
                          return;
                        }

                        try {
                          await socialAction("request_friend", {
                            user_id: target.id,
                          });
                          await social.refresh();
                          setSearchFeedback({
                            type: "success",
                            message: "Solicitação de amizade enviada.",
                          });
                          setLookup("");
                        } catch (err: unknown) {
                          const msg =
                            err instanceof Error
                              ? err.message
                              : typeof err === "object" &&
                                  err &&
                                  "message" in err
                                ? String((err as { message: unknown }).message)
                                : "";
                          if (
                            msg.includes("já existe") ||
                            msg.includes("duplicad") ||
                            msg.includes("pending") ||
                            msg.includes("42501")
                          ) {
                            setSearchFeedback({
                              type: "error",
                              message: "Já existe uma solicitação pendente.",
                            });
                          } else if (
                            msg.includes("amigos") ||
                            msg.includes("accepted")
                          ) {
                            setSearchFeedback({
                              type: "error",
                              message: "Vocês já são amigos.",
                            });
                          } else if (
                            msg.includes("bloque") ||
                            msg.includes("blocked")
                          ) {
                            setSearchFeedback({
                              type: "error",
                              message:
                                "Interação indisponível com usuário bloqueado.",
                            });
                          } else if (
                            msg.includes("inválido") ||
                            msg.includes("mesmo")
                          ) {
                            setSearchFeedback({
                              type: "error",
                              message: "Você não pode adicionar a si mesmo.",
                            });
                          } else {
                            setSearchFeedback({
                              type: "error",
                              message:
                                "Não foi possível enviar a solicitação. Verifique o nome de usuário.",
                            });
                          }
                        }
                      });
                    }}
                  >
                    <div className="friend-add-input-wrap">
                      <input
                        required
                        aria-label="Digite um nome de usuário"
                        value={lookup}
                        onChange={(e) => {
                          setLookup(e.target.value);
                          if (searchFeedback) setSearchFeedback(null);
                        }}
                        placeholder="Digite um nome de usuário"
                      />
                    </div>
                    <button
                      type="submit"
                      className="add-friend-btn"
                      disabled={task.busy || !lookup.trim()}
                    >
                      {task.busy ? "Enviando..." : "Enviar solicitação de amizade"}
                    </button>
                  </form>

                  {searchFeedback && (
                    <div
                      className={`add-friend-feedback ${searchFeedback.type}`}
                    >
                      {searchFeedback.message}
                    </div>
                  )}

                  <div className="add-friend-empty">
                    <div className="add-friend-not-found">
                      <Users
                        size={40}
                        style={{
                          margin: "0 auto 12px",
                          opacity: 0.6,
                          display: "block",
                        }}
                      />
                      <strong>A Arena é melhor com amigos!</strong>
                      <p>
                        Adicione amigos para conversar por DM, ver quando estão jogando e montar seus squads.
                      </p>
                    </div>
                  </div>
                </div>
              ) : tab === "Pendente" ? (
                <div className="pending-requests-view">
                  {incomingFiltered.length > 0 && (
                    <div className="pending-section">
                      <h2 className="friends-count">
                        SOLICITAÇÕES RECEBIDAS — {incomingFiltered.length}
                      </h2>
                      {incomingFiltered.map((id) => {
                        const p = data?.profiles[id];
                        if (!p) return null;
                        return (
                          <div className="social-person" key={"in-" + id}>
                            {person(p)}
                            <small className="request-direction">
                              Solicitação recebida
                            </small>
                            <div className="social-row-actions">
                              <button
                                type="button"
                                className="action-accept"
                                title={"Aceitar solicitação de " + p.display_name}
                                aria-label={
                                  "Aceitar solicitação de " + p.display_name
                                }
                                disabled={task.busy}
                                onClick={() => void run("accept_friend", id)}
                              >
                                <Check size={16} />
                              </button>
                              <button
                                type="button"
                                className="action-decline"
                                title={"Recusar solicitação de " + p.display_name}
                                aria-label={
                                  "Recusar solicitação de " + p.display_name
                                }
                                disabled={task.busy}
                                onClick={() => void run("decline_friend", id)}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {outgoingFiltered.length > 0 && (
                    <div className="pending-section">
                      <h2 className="friends-count">
                        SOLICITAÇÕES ENVIADAS — {outgoingFiltered.length}
                      </h2>
                      {outgoingFiltered.map((id) => {
                        const p = data?.profiles[id];
                        if (!p) return null;
                        return (
                          <div className="social-person" key={"out-" + id}>
                            {person(p)}
                            <small className="request-direction">
                              Aguardando resposta
                            </small>
                            <div className="social-row-actions">
                              <button
                                type="button"
                                className="action-cancel"
                                title={
                                  "Cancelar solicitação para " + p.display_name
                                }
                                aria-label={
                                  "Cancelar solicitação para " + p.display_name
                                }
                                disabled={task.busy}
                                onClick={() => void run("cancel_friend", id)}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {incomingFiltered.length === 0 &&
                    outgoingFiltered.length === 0 && (
                      <p className="social-empty">
                        {query
                          ? "Nenhuma solicitação encontrada para esta busca."
                          : "Nenhuma solicitação de amizade pendente."}
                      </p>
                    )}
                </div>
              ) : tab === "Bloqueados" ? (
                <>
                  <h2 className="friends-count">
                    BLOQUEADOS — {blockedFiltered.length}
                  </h2>
                  {!blockedFiltered.length && (
                    <p className="social-empty">
                      {query
                        ? "Nenhum usuário bloqueado encontrado para esta busca."
                        : "Nenhum usuário bloqueado."}
                    </p>
                  )}
                  {blockedFiltered.map((id) => {
                    const p = data?.profiles[id];
                    if (!p) return null;
                    return (
                      <div className="social-person" key={id}>
                        {person(p)}
                        <small className="request-direction">
                          Usuário bloqueado
                        </small>
                        <div className="social-row-actions">
                          <button
                            type="button"
                            className="unblock-btn"
                            title={"Desbloquear " + p.display_name}
                            aria-label={"Desbloquear " + p.display_name}
                            disabled={task.busy}
                            onClick={() => void run("unblock", id)}
                          >
                            Desbloquear
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                /* tab === "Disponível" || tab === "Todos" */
                <>
                  <h2 className="friends-count">
                    {tab === "Disponível"
                      ? `DISPONÍVEL — ${availableFiltered.length}`
                      : `TODOS OS AMIGOS — ${allFiltered.length}`}
                  </h2>
                  {!(tab === "Disponível"
                    ? availableFiltered.length
                    : allFiltered.length) && (
                    <p className="social-empty">
                      {query
                        ? "Nenhum amigo encontrado para esta busca."
                        : tab === "Disponível"
                          ? "Nenhum amigo online no momento."
                          : "Sua lista de amigos está vazia. Adicione pessoas na aba Adicionar amigo."}
                    </p>
                  )}
                  {(tab === "Disponível"
                    ? availableFiltered
                    : allFiltered
                  ).map((id) => {
                    const p = data?.profiles[id];
                    if (!p) return null;
                    return (
                      <div
                        className="social-person friend-item-clickable"
                        key={id}
                        onClick={() => void open(id)}
                      >
                        {person(p)}
                        <div
                          className="social-row-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="action-dm"
                            title={"Conversar com " + p.display_name}
                            aria-label={"Conversar com " + p.display_name}
                            disabled={task.busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              void open(id);
                            }}
                          >
                            <MessageCircle size={16} />
                          </button>
                          <div className="friend-menu-container">
                            <button
                              type="button"
                              className={
                                "action-more" +
                                (activeMenuId === id ? " active" : "")
                              }
                              title="Mais opções"
                              aria-label={"Mais opções para " + p.display_name}
                              aria-expanded={activeMenuId === id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId((curr) =>
                                  curr === id ? null : id,
                                );
                              }}
                            >
                              <MoreVertical size={16} />
                            </button>
                            {activeMenuId === id && (
                              <div
                                className="friend-menu-dropdown"
                                role="menu"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="friend-menu-item"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setConfirmAction({
                                      type: "remove",
                                      targetId: id,
                                      targetName: p.display_name,
                                    });
                                  }}
                                >
                                  <UserMinus size={15} />
                                  <span>Remover amigo</span>
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="friend-menu-item danger"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setConfirmAction({
                                      type: "block",
                                      targetId: id,
                                      targetName: p.display_name,
                                    });
                                  }}
                                >
                                  <Ban size={15} />
                                  <span>Bloquear</span>
                                </button>
                              </div>
                            )}
                          </div>
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

      {confirmAction && (
        <Modal
          title={
            confirmAction.type === "remove"
              ? `Remover ${confirmAction.targetName} dos seus amigos?`
              : `Bloquear ${confirmAction.targetName}?`
          }
          onClose={() => setConfirmAction(null)}
          className="social-confirm-modal"
        >
          <div className="modal-confirm-body">
            {confirmAction.type === "remove" ? (
              <p>
                Tem certeza de que deseja remover{" "}
                <strong>{confirmAction.targetName}</strong> dos seus amigos?
              </p>
            ) : (
              <>
                <p>
                  Tem certeza de que deseja bloquear{" "}
                  <strong>{confirmAction.targetName}</strong>?
                </p>
                <p className="modal-confirm-hint">
                  Este usuário deixará de ser seu amigo e não poderá enviar solicitações
                  ou mensagens para você enquanto estiver bloqueado. O histórico de
                  mensagens anteriores será mantido.
                </p>
              </>
            )}
          </div>
          <div className="modal-confirm-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={task.busy}
              onClick={() => setConfirmAction(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={task.busy}
              onClick={async () => {
                const { type, targetId } = confirmAction;
                setConfirmAction(null);
                await run(type === "remove" ? "remove_friend" : "block", targetId);
              }}
            >
              {task.busy
                ? "Aguarde..."
                : confirmAction.type === "remove"
                  ? "Remover amigo"
                  : "Bloquear"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function DirectChat({
  profile,
  peer,
  conversation,
  social,
  dmCall,
  onBack,
  onUserProfile,
  isVoiceActive,
  onLeaveVoice,
}: {
  profile: Profile;
  peer: Profile;
  conversation: Conversation;
  social: SocialState;
  dmCall?: DMCallState;
  onBack: () => void;
  onUserProfile?: OpenUserProfile;
  isVoiceActive?: boolean;
  onLeaveVoice?: () => void;
}) {
  const [pages, setPages] = useState(1);
  const [content, setContent] = useState("");
  const [reply, setReply] = useState<DirectMessage | null>(null);
  const [editing, setEditing] = useState<DirectMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [callConflict, setCallConflict] = useState<(() => void) | null>(null);
  const task = useTask();

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
    message: DirectMessage;
    x: number;
    y: number;
  } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);

  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditText, setInlineEditText] = useState("");

  // Typing state for peer
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingAt = useRef(0);
  const typingSend = useRef<(stop?: boolean) => void>(() => {});
  const initialCutoffSeq = useRef(conversation.last_read_seq);

  const history = useAsync(
    useCallback(
      () => dmHistory(conversation.id, pages),
      [conversation.id, pages],
    ),
  );

  const [callLogs, setCallLogs] = useState<DMCall[]>([]);
  const loadCallLogs = useCallback(async () => {
    try {
      const list = await getConversationCalls(conversation.id);
      setCallLogs(
        list.filter((c) => ["ended", "missed", "declined"].includes(c.status)),
      );
    } catch {
      // Ignored
    }
  }, [conversation.id]);

  useEffect(() => {
    void loadCallLogs();
  }, [loadCallLogs, social.revision, dmCall?.callStatus]);

  const refreshRef = useRef(history.reload);
  refreshRef.current = history.reload;

  useEffect(() => {
    void refreshRef.current();
  }, [social.revision]);

  // Realtime typing broadcast subscription
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`dm-chat:${conversation.id}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.id === peer.id) {
          if (payload.stop) {
            setIsPeerTyping(false);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          } else {
            setIsPeerTyping(true);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => {
              setIsPeerTyping(false);
            }, 5500);
          }
        }
      })
      .subscribe();

    typingSend.current = (stop = false) => {
      try {
        if (stop) {
          channel
            .send({
              type: "broadcast",
              event: "typing",
              payload: { id: profile.id, stop: true },
            })
            .catch(() => {});
          return;
        }
        if (Date.now() - typingAt.current > 1500) {
          typingAt.current = Date.now();
          channel
            .send({
              type: "broadcast",
              event: "typing",
              payload: { id: profile.id, stop: false },
            })
            .catch(() => {});
        }
      } catch {
        // Silently ignore broadcast failure
      }
    };

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      void supabase?.removeChannel(channel);
    };
  }, [conversation.id, peer.id, profile.id]);

  const ack = useRef(0);
  const inflight = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const rows = history.data || [];
  const through = rows.at(-1)?.seq || 0;

  type TimelineItem =
    | { kind: "message"; item: DirectMessage }
    | { kind: "call"; item: DMCall };

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const msgs: TimelineItem[] = rows.map((m) => ({ kind: "message", item: m }));
    const calls: TimelineItem[] = callLogs.map((c) => ({
      kind: "call",
      item: c,
    }));
    return [...msgs, ...calls].sort(
      (a, b) =>
        new Date(a.item.created_at).getTime() -
        new Date(b.item.created_at).getTime(),
    );
  }, [rows, callLogs]);

  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  };

  useEffect(() => {
    if (nearBottom.current) {
      scrollToBottom();
    }
  }, [rows.length]);

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

  const refreshSocialRef = useRef(social.refresh);
  refreshSocialRef.current = social.refresh;

  useEffect(() => {
    if (
      through > 0 &&
      through > Number(conversation.last_read_seq) &&
      through > ack.current
    ) {
      void markRead()
        .then(() => refreshSocialRef.current())
        .catch(() => {});
    }
  }, [conversation.id, conversation.last_read_seq, through, markRead]);

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        void markRead().catch(() => {});
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
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
    setTimeout(() => scrollToBottom(true), 50);
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

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      await socialAction("react_dm", {
        conversation_id: conversation.id,
        message_id: messageId,
        emoji,
      });
      await history.reload();
    } catch (err) {
      task.setError(err instanceof Error ? err.message : String(err));
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

  const peerPresence = visiblePresence(
    social.data?.presence.find((p) => p.user_id === peer.id),
    social.now,
  );

  return (
    <>
      <header className="dm-header">
        <div className="dm-header-left">
          <button
            type="button"
            className="dm-back-btn"
            onClick={onBack}
            title="Voltar para Amigos"
            aria-label="Voltar para Amigos"
          >
            <ArrowLeft size={16} />
            <span>Amigos</span>
          </button>
          <div className="dm-header-divider" />
          <button
            type="button"
            className="dm-peer-info-btn"
            data-profile-trigger={peer.id}
            onClick={(e) => onUserProfile?.(peer.id, e.currentTarget, peer)}
            title={"Ver perfil de " + peer.display_name}
            aria-label={"Ver perfil de " + peer.display_name}
          >
            <Avatar
              userId={peer.id}
              name={peer.display_name}
              url={peer.avatar_url}
              size={28}
            />
            <i className={"presence-dot presence-" + peerPresence} />
            <div className="dm-peer-names">
              <span className="dm-peer-name">{peer.display_name}</span>
              <span className="dm-peer-username">@{peer.username}</span>
            </div>
          </button>
          <small className="dm-peer-status">{presenceLabels[peerPresence]}</small>
        </div>
        <div className="dm-header-actions">
          <div className="dm-call-triggers">
            <button
              type="button"
              className="dm-call-btn voice-call-btn"
              title="Iniciar chamada de voz"
              aria-label="Iniciar chamada de voz"
              disabled={
                social.data?.blocks.includes(peer.id) ||
                (Boolean(dmCall?.call) &&
                  dmCall?.call?.conversation_id !== conversation.id &&
                  ["calling", "connecting", "connected", "ringing"].includes(
                    dmCall?.callStatus || "idle",
                  ))
              }
              onClick={(e) => {
                e.stopPropagation();
                console.log("[DM_CALL_CLICK] Phone button clicked!", {
                  conversationId: conversation.id,
                  peerId: peer.id,
                  peerName: peer.display_name,
                  localUserId: profile.id,
                  isVoiceActive: Boolean(isVoiceActive),
                  currentCallStatus: dmCall?.callStatus,
                });
                if (isVoiceActive) {
                  setCallConflict(() => () => {
                    onLeaveVoice?.();
                    void dmCall?.startCall(conversation.id, peer, "voice");
                  });
                } else {
                  void dmCall?.startCall(conversation.id, peer, "voice");
                }
              }}
            >
              <Phone size={18} />
            </button>
            <button
              type="button"
              className="dm-call-btn video-call-btn"
              title="Iniciar chamada de vídeo"
              aria-label="Iniciar chamada de vídeo"
              disabled={
                social.data?.blocks.includes(peer.id) ||
                (Boolean(dmCall?.call) &&
                  dmCall?.call?.conversation_id !== conversation.id &&
                  ["calling", "connecting", "connected", "ringing"].includes(
                    dmCall?.callStatus || "idle",
                  ))
              }
              onClick={(e) => {
                e.stopPropagation();
                console.log("[DM_CALL_CLICK] Camera button clicked!", {
                  conversationId: conversation.id,
                  peerId: peer.id,
                  peerName: peer.display_name,
                  localUserId: profile.id,
                  isVoiceActive: Boolean(isVoiceActive),
                  currentCallStatus: dmCall?.callStatus,
                });
                if (isVoiceActive) {
                  setCallConflict(() => () => {
                    onLeaveVoice?.();
                    void dmCall?.startCall(conversation.id, peer, "video");
                  });
                } else {
                  void dmCall?.startCall(conversation.id, peer, "video");
                }
              }}
            >
              <Video size={18} />
            </button>
          </div>
          <button
            type="button"
            className="secondary"
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
            type="button"
            className="secondary"
            disabled={task.busy}
            onClick={() => {
              const isBlocked = social.data?.blocks.includes(peer.id);
              if (isBlocked) {
                void task.run(async () => {
                  await socialAction("unblock", { user_id: peer.id });
                  await social.refresh();
                });
              } else {
                setConfirmBlock(true);
              }
            }}
          >
            {social.data?.blocks.includes(peer.id) ? "Desbloquear" : "Bloquear"}{" "}
            {peer.display_name}
          </button>
        </div>
      </header>

      {dmCall?.call &&
        dmCall.call.conversation_id === conversation.id &&
        ["calling", "connecting", "connected", "ringing", "failed"].includes(
          dmCall.callStatus,
        ) && (
          <ActiveCallStage
            room={dmCall.room}
            call={dmCall.call}
            peer={peer}
            callStatus={dmCall.callStatus}
            duration={dmCall.duration}
            isMicEnabled={dmCall.isMicEnabled}
            isCameraEnabled={dmCall.isCameraEnabled}
            isScreenSharing={dmCall.isScreenSharing}
            isDeafened={dmCall.isDeafened}
            onToggleMic={dmCall.toggleMicrophone}
            onToggleCamera={dmCall.toggleCamera}
            onToggleScreenShare={dmCall.toggleScreenShare}
            onStartScreenShare={dmCall.startScreenShare}
            onToggleDeafened={dmCall.toggleDeafened}
            onEndCall={dmCall.endCall}
            onUserProfile={onUserProfile}
            localProfile={profile}
          />
        )}

      <ErrorNotice text={task.error || history.error || dmCall?.error || ""} />

      <div
        className="dm-history"
        ref={scrollRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ position: "relative" }}
        onScroll={() => {
          const el = scrollRef.current;
          if (el) {
            nearBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          }
        }}
      >
        {/* Drag & Drop Visual Overlay */}
        {isDragging && (
          <div className="chat-drag-overlay">
            <FileText size={48} />
            <span>Solte para enviar o arquivo</span>
          </div>
        )}

        {rows.length === pages * 40 && (
          <button
            type="button"
            className="secondary"
            style={{ alignSelf: "center", margin: "8px 0" }}
            onClick={() => setPages((p) => p + 1)}
          >
            Carregar mensagens anteriores
          </button>
        )}

        {timelineItems.map((entry, index) => {
          if (entry.kind === "call") {
            const callItem = entry.item;
            const isEnded = callItem.status === "ended";
            const isMissed = callItem.status === "missed";
            const isDeclined = callItem.status === "declined";
            const isCaller = callItem.caller_id === profile.id;

            let title = "Chamada encerrada";
            let meta = formatCallDuration(callItem.duration_seconds || 0);
            if (isMissed) {
              title = isCaller ? "Chamada não atendida" : "Chamada perdida";
              meta = "Sem resposta";
            } else if (isDeclined) {
              title = "Chamada recusada";
              meta = isCaller
                ? "Recusada pelo destinatário"
                : "Chamada recusada";
            } else if (isEnded) {
              title =
                callItem.call_type === "video"
                  ? "Chamada de vídeo encerrada"
                  : "Chamada de voz encerrada";
              meta =
                callItem.duration_seconds > 0
                  ? `Duração: ${formatCallDuration(callItem.duration_seconds)}`
                  : "Chamada rápida";
            }

            return (
              <div
                key={"call-" + callItem.id}
                className="call-system-event-card"
              >
                <div className={`call-event-icon ${callItem.status}`}>
                  {isEnded ? <Phone size={18} /> : <PhoneMissed size={18} />}
                </div>
                <div className="call-event-info">
                  <span className="call-event-title">{title}</span>
                  <span className="call-event-meta">
                    {new Date(callItem.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    • {meta}
                  </span>
                </div>
                <button
                  type="button"
                  className="call-event-return-btn"
                  disabled={dmCall?.callStatus !== "idle"}
                  onClick={() => {
                    void dmCall?.startCall(
                      conversation.id,
                      peer,
                      callItem.call_type,
                    );
                  }}
                >
                  Ligar de volta
                </button>
              </div>
            );
          }

          const m = entry.item;
          const isOwn = m.author_id === profile.id;
          const authorProfile = isOwn ? profile : peer;
          const prevEntry = timelineItems[index - 1];
          const prevMsg =
            prevEntry?.kind === "message" ? prevEntry.item : undefined;
          const showDateSeparator = isDifferentDay(
            m.created_at,
            prevMsg?.created_at,
          );
          const grouped =
            !showDateSeparator &&
            prevMsg &&
            prevMsg.author_id === m.author_id &&
            new Date(m.created_at).getTime() -
              new Date(prevMsg.created_at).getTime() <
              300000;

          const isHighlighted = highlightedMessageId === m.id;
          const groupedRx = groupReactions(m.reactions || [], profile.id);

          const isFirstUnread = Boolean(
            conversation.unread_count > 0 &&
              initialCutoffSeq.current !== undefined &&
              m.seq > initialCutoffSeq.current &&
              (!prevMsg || prevMsg.seq <= initialCutoffSeq.current),
          );

          return (
            <Fragment key={m.id}>
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
                  "message dm-message" +
                  (grouped ? " message-grouped" : " message-group-start") +
                  (isHighlighted ? " message-highlight-flash" : "")
                }
                data-message-id={m.id}
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
                {!m.deleted_at && (
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
                          y: Math.max(10, rect.top - 370),
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
                          y: Math.min(window.innerHeight - 260, rect.bottom + 4),
                        });
                      }}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                )}

                {/* Reply Reference Preview */}
                {m.reply && (
                  <button
                    type="button"
                    className="reply-reference-badge"
                    onClick={() => handleJumpToReply(m.reply!.id)}
                    title="Ir para mensagem respondida"
                  >
                    <span aria-hidden="true">↳</span>
                    <span className="reply-author">
                      {m.reply.author_id === profile.id
                        ? profile.display_name
                        : peer.display_name}
                    </span>
                    {m.reply.deleted_at ? (
                      <span className="reply-deleted">
                        Mensagem original excluída.
                      </span>
                    ) : (
                      <span className="reply-snippet">
                        {m.reply.content ||
                          (m.attachments?.length ? "[Anexo]" : "Mensagem anterior")}
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
                    className="dm-msg-avatar-trigger"
                    data-profile-trigger={m.author_id}
                    aria-label={"Ver perfil de " + authorProfile.display_name}
                    onClick={(e) =>
                      onUserProfile?.(
                        m.author_id,
                        e.currentTarget,
                        authorProfile,
                      )
                    }
                  >
                    <Avatar
                      userId={m.author_id}
                      url={authorProfile.avatar_url}
                      name={authorProfile.display_name}
                      size={34}
                    />
                  </button>
                )}

                <div className="dm-msg-body">
                  {!grouped && (
                    <header className="dm-msg-header">
                      <button
                        type="button"
                        className="dm-msg-name-trigger"
                        data-profile-trigger={m.author_id}
                        onClick={(e) =>
                          onUserProfile?.(
                            m.author_id,
                            e.currentTarget,
                            authorProfile,
                          )
                        }
                      >
                        {authorProfile.display_name}
                      </button>
                      <time dateTime={m.created_at}>
                        {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                      {m.edited_at && !m.deleted_at && (
                        <small className="message-edited"> · editada</small>
                      )}
                    </header>
                  )}

                  {/* Inline Message Edit Form */}
                  {inlineEditingId === m.id ? (
                    <form
                      className="inline-edit-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void task.run(async () => {
                          await perform("edit_dm", {
                            message_id: m.id,
                            content: inlineEditText,
                          });
                          setInlineEditingId(null);
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
                          <p className="dm-content">
                            {m.content}
                            {m.edited_at && grouped && (
                              <small className="message-edited"> (editado)</small>
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
                            void handleToggleReaction(m.id, gr.emoji)
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
                            y: Math.max(10, rect.top - 370),
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
            </Fragment>
          );
        })}
      </div>

      {/* Typing indicator */}
      {isPeerTyping && (
        <div className="chat-typing-indicator" style={{ padding: "4px 20px" }}>
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
          <span className="typing-label">
            {peer.display_name} está digitando…
          </span>
        </div>
      )}

      {/* Composer Area */}
      <div className="dm-composer-wrap">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />

        {social.data?.blocks.includes(peer.id) ? (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              color: "#949ba4",
              fontSize: "13px",
              background: "rgba(0, 0, 0, 0.2)",
              borderRadius: "8px",
            }}
          >
            Você bloqueou este usuário. Desbloqueie para poder enviar mensagens.
          </div>
        ) : editing ? (
          <form
            className="dm-composer-form"
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
            <label style={{ display: "none" }}>Editar mensagem privada</label>
            <textarea
              required
              maxLength={4000}
              aria-label="Editar mensagem privada"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
            <div className="dm-composer-footer">
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <Submit busy={task.busy}>Salvar edição</Submit>
            </div>
          </form>
        ) : (
          <form
            className="dm-composer-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!content.trim() && pendingAttachments.length === 0) return;
              void task.run(async () => {
                await perform(
                  "send_dm",
                  {
                    content: content.trim(),
                    reply_to: reply?.id || null,
                    attachments: pendingAttachments,
                  },
                  () => {
                    setContent("");
                    setReply(null);
                    setPendingAttachments([]);
                    typingSend.current(true);
                  },
                );
              });
            }}
          >
            {/* Pending Attachments Preview */}
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

            {reply && (
              <div className="reply-banner" style={{ marginBottom: 4 }}>
                <span>
                  Respondendo a:{" "}
                  {reply.author_id === profile.id
                    ? profile.display_name
                    : peer.display_name}{" "}
                  — {reply.content || (reply.attachments?.length ? "[Anexo]" : "Mensagem")}
                </span>
                <button type="button" onClick={() => setReply(null)}>
                  <X size={14} />
                </button>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="composer-action-btn"
                title="Adicionar anexo"
                aria-label="Adicionar anexo"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: 0,
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9cb0ce",
                  cursor: "pointer",
                  flexShrink: 0,
                  marginBottom: 4,
                }}
              >
                <Plus size={18} />
              </button>

              <textarea
                required={pendingAttachments.length === 0}
                maxLength={4000}
                rows={2}
                aria-label="Mensagem privada"
                placeholder={"Conversar com @" + peer.username}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  typingSend.current();
                }}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (content.trim() || pendingAttachments.length > 0) {
                      e.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
                style={{ flex: 1 }}
              />

              <div className="dm-composer-footer" style={{ marginBottom: 4 }}>
                <Submit
                  busy={task.busy}
                  disabled={
                    !content.trim() && pendingAttachments.length === 0
                  }
                >
                  Enviar
                </Submit>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <ImageLightboxModal
          url={lightboxImage.url}
          name={lightboxImage.name}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* Message Context Menu */}
      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          content={contextMenu.message.content}
          messageId={contextMenu.message.id}
          isAuthor={contextMenu.message.author_id === profile.id}
          canDelete={contextMenu.message.author_id === profile.id}
          onAddReaction={() => {
            setActiveEmojiPicker({
              messageId: contextMenu.message.id,
              x: Math.min(contextMenu.x, window.innerWidth - 320),
              y: Math.max(10, contextMenu.y - 320),
            });
            setContextMenu(null);
          }}
          onReply={() => {
            setReply(contextMenu.message);
            setContextMenu(null);
          }}
          onEdit={
            contextMenu.message.author_id === profile.id
              ? () => {
                  setInlineEditingId(contextMenu.message.id);
                  setInlineEditText(contextMenu.message.content);
                  setContextMenu(null);
                }
              : undefined
          }
          onDelete={
            contextMenu.message.author_id === profile.id
              ? () => {
                  const msgId = contextMenu.message.id;
                  setContextMenu(null);
                  void task.run(async () => {
                    if (!confirm("Excluir sua mensagem privada?")) return;
                    await perform("delete_dm", { message_id: msgId });
                  });
                }
              : undefined
          }
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Active Emoji Picker Popover */}
      {activeEmojiPicker && (
        <div
          style={{
            position: "fixed",
            left: activeEmojiPicker.x,
            top: activeEmojiPicker.y,
            zIndex: 9999,
          }}
        >
          <EmojiPicker
            onSelect={(emoji) => {
              void handleToggleReaction(activeEmojiPicker.messageId, emoji);
              setActiveEmojiPicker(null);
            }}
            onClose={() => setActiveEmojiPicker(null)}
          />
        </div>
      )}

      {/* Confirm Block Modal */}
      {confirmBlock && (
        <Modal
          title={`Bloquear ${peer.display_name}?`}
          onClose={() => setConfirmBlock(false)}
          className="social-confirm-modal"
        >
          <div className="modal-confirm-body">
            <p>
              Tem certeza de que deseja bloquear <strong>{peer.display_name}</strong>?
            </p>
            <p className="modal-confirm-hint">
              Este usuário deixará de ser seu amigo e não poderá enviar solicitações
              ou mensagens para você enquanto estiver bloqueado. O histórico de
              mensagens anteriores será mantido.
            </p>
          </div>
          <div className="modal-confirm-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={task.busy}
              onClick={() => setConfirmBlock(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={task.busy}
              onClick={async () => {
                setConfirmBlock(false);
                await task.run(async () => {
                  await socialAction("block", { user_id: peer.id });
                  await social.refresh();
                });
              }}
            >
              {task.busy ? "Aguarde..." : "Bloquear"}
            </button>
          </div>
        </Modal>
      )}

      {/* Call Conflict Modal (Requirement 10) */}
      {callConflict && (
        <Modal
          title="Você já está conectado a uma chamada."
          onClose={() => setCallConflict(null)}
          className="social-confirm-modal"
        >
          <div className="modal-confirm-body">
            <p>Entrar nesta chamada fará você sair da chamada atual.</p>
          </div>
          <div className="modal-confirm-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCallConflict(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                const action = callConflict;
                setCallConflict(null);
                action();
              }}
            >
              Entrar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
