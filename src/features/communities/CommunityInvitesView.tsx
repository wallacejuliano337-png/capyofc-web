import { useState, useCallback, useEffect, useRef } from "react";
import {
  Plus,
  Copy,
  Check,
  MoreHorizontal,
  X,
  Clock,
  Users,
  Slash,
} from "lucide-react";
import { Avatar, ErrorNotice, useTask } from "../../components/ui";
import { db } from "../../lib/supabase";
import {
  communityAction,
  type Community,
  type Member,
} from "../../services/communities";
import { recordAuditLogEntry } from "../../services/community-audit";

export interface Invite {
  code: string;
  community_id: string;
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  revoked_at: string | null;
  created_at: string;
}

const EXPIRATION_OPTIONS = [
  { label: "30 minutos", seconds: 30 * 60 },
  { label: "1 hora", seconds: 60 * 60 },
  { label: "6 horas", seconds: 6 * 3600 },
  { label: "12 horas", seconds: 12 * 3600 },
  { label: "1 dia", seconds: 24 * 3600 },
  { label: "7 dias", seconds: 7 * 86400 },
  { label: "Nunca", seconds: null },
];

const MAX_USES_OPTIONS = [
  { label: "Sem limite", uses: null },
  { label: "1 uso", uses: 1 },
  { label: "5 usos", uses: 5 },
  { label: "10 usos", uses: 10 },
  { label: "25 usos", uses: 25 },
  { label: "50 usos", uses: 50 },
  { label: "100 usos", uses: 100 },
];

export function CommunityInvitesView({
  community,
  members,
  permissions,
  userId,
  onChanged,
}: {
  community: Community;
  members: Member[];
  permissions: string[];
  userId: string;
  onChanged: () => Promise<void>;
}) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeMenuCode, setActiveMenuCode] = useState<string | null>(null);

  // Modal creation state
  const [selectedExpirationSeconds, setSelectedExpirationSeconds] = useState<
    number | null
  >(7 * 86400); // Default 7 days
  const [selectedMaxUses, setSelectedMaxUses] = useState<number | null>(null); // Default unlimited
  const [newlyCreatedInvite, setNewlyCreatedInvite] = useState<Invite | null>(
    null,
  );

  const task = useTask();
  const menuRef = useRef<HTMLDivElement>(null);

  const canCreate =
    community.owner_id === userId || permissions.includes("create_invites");

  // Load invites
  const fetchInvites = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await db()
        .from("community_invites")
        .select(
          "code,community_id,created_by,expires_at,max_uses,uses,revoked_at,created_at",
        )
        .eq("community_id", community.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvites(data as Invite[]);
    } catch (err) {
      console.error("Erro ao carregar convites:", err);
    } finally {
      setLoading(false);
    }
  }, [community.id]);

  useEffect(() => {
    void fetchInvites();
  }, [fetchInvites]);

  // Close context menu on outside click or ESC
  useEffect(() => {
    if (!activeMenuCode) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuCode(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenuCode(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeMenuCode]);

  // Copy code to clipboard
  const handleCopyInvite = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Fallback
    }
  };

  // Revoke invite
  const handleRevokeInvite = async (code: string) => {
    if (!confirm("Revogar este convite? Ele deixará de funcionar imediatamente.")) {
      return;
    }
    await task.run(async () => {
      await communityAction("revoke_invite", {
        community_id: community.id,
        code,
      });

      const actorMember = members.find((m) => m.user_id === userId);
      recordAuditLogEntry(
        community.id,
        {
          id: userId,
          display_name: actorMember?.profiles.display_name || "Administrador",
          username: actorMember?.profiles.username || "admin",
          avatar_url: actorMember?.profiles.avatar_url,
        },
        {
          action_type: "invite_revoke",
          target_type: "invite",
          target_name: `convite (${code})`,
          metadata: { code },
        },
      );

      await fetchInvites();
      await onChanged();
      setActiveMenuCode(null);
    });
  };

  // Create invite
  const handleCreateInvite = async () => {
    await task.run(async () => {
      const expiresAt =
        selectedExpirationSeconds !== null
          ? new Date(Date.now() + selectedExpirationSeconds * 1000).toISOString()
          : null;

      const res = await communityAction<Invite>("invite", {
        community_id: community.id,
        expires_at: expiresAt,
        max_uses: selectedMaxUses,
      });

      const actorMember = members.find((m) => m.user_id === userId);
      recordAuditLogEntry(
        community.id,
        {
          id: userId,
          display_name: actorMember?.profiles.display_name || "Administrador",
          username: actorMember?.profiles.username || "admin",
          avatar_url: actorMember?.profiles.avatar_url,
        },
        {
          action_type: "invite_create",
          target_type: "invite",
          target_name: `convite (${res.code})`,
          metadata: {
            code: res.code,
            max_uses: selectedMaxUses,
            expires_at: expiresAt,
          },
        },
      );

      await fetchInvites();
      await onChanged();
      setNewlyCreatedInvite(res);
    });
  };

  // Format expiration
  const formatExpiration = (inv: Invite) => {
    if (inv.revoked_at) return "Revogado";
    if (inv.max_uses !== null && inv.uses >= inv.max_uses) return "Esgotado";
    if (!inv.expires_at) return "Nunca";

    const expTime = new Date(inv.expires_at).getTime();
    const now = Date.now();
    if (expTime <= now) return "Expirado";

    const diffMinutes = Math.round((expTime - now) / 60000);
    if (diffMinutes < 60) return `Em ${diffMinutes} min`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `Em ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
    const diffDays = Math.round(diffHours / 24);
    return `Em ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
  };

  const getInviteStatus = (
    inv: Invite,
  ): "active" | "revoked" | "expired" | "exhausted" => {
    if (inv.revoked_at) return "revoked";
    if (inv.max_uses !== null && inv.uses >= inv.max_uses) return "exhausted";
    if (inv.expires_at && new Date(inv.expires_at).getTime() <= Date.now()) {
      return "expired";
    }
    return "active";
  };

  return (
    <section className="community-invites-section" aria-labelledby="invites-view-title">
      <ErrorNotice text={task.error} />

      {/* Main Header */}
      <div className="invites-main-header">
        <div>
          <h2 id="invites-view-title" className="server-settings-title">
            Convites
          </h2>
          <p className="server-settings-description">
            Gerencie os códigos e links de convite criados para esta comunidade.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="server-btn server-btn-primary invites-create-btn"
            onClick={() => {
              setNewlyCreatedInvite(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} />
            <span>Criar convite</span>
          </button>
        )}
      </div>

      {/* Invites Table */}
      <div className="invites-table-header">
        <div className="invites-th th-code">CÓDIGO</div>
        <div className="invites-th th-creator">CRIADO POR</div>
        <div className="invites-th th-uses">USOS</div>
        <div className="invites-th th-expires">EXPIRAÇÃO</div>
        <div className="invites-th th-actions">AÇÕES</div>
      </div>

      <div className="invites-table-body">
        {invites.map((inv) => {
          const creator = members.find((m) => m.user_id === inv.created_by);
          const status = getInviteStatus(inv);
          const isCopied = copiedCode === inv.code;
          const isMenuOpen = activeMenuCode === inv.code;

          return (
            <div className={`invites-row ${status}`} key={inv.code}>
              {/* Code */}
              <div className="invites-col col-code">
                <span className="invite-code-pill" title="Código do convite">
                  {inv.code}
                </span>
                <button
                  type="button"
                  className="invite-copy-inline-btn"
                  onClick={() => void handleCopyInvite(inv.code)}
                  title="Copiar código"
                >
                  {isCopied ? <Check size={14} color="#23a55a" /> : <Copy size={14} />}
                </button>
              </div>

              {/* Creator */}
              <div className="invites-col col-creator">
                {creator ? (
                  <div className="invite-creator-info">
                    <Avatar
                      userId={creator.user_id}
                      name={creator.profiles.display_name}
                      url={creator.profiles.avatar_url}
                      size={24}
                    />
                    <span className="invite-creator-name">
                      {creator.profiles.display_name}
                    </span>
                  </div>
                ) : (
                  <span className="invite-creator-unknown">Membro da equipe</span>
                )}
              </div>

              {/* Uses */}
              <div className="invites-col col-uses">
                <span className="invite-uses-text">
                  <strong>{inv.uses}</strong> / {inv.max_uses ?? "∞"}
                </span>
              </div>

              {/* Expiration & Status */}
              <div className="invites-col col-expires">
                <div className="invite-status-wrap">
                  <span className={`invite-status-badge ${status}`}>
                    {status === "active" && "Ativo"}
                    {status === "exhausted" && "Esgotado"}
                    {status === "expired" && "Expirado"}
                    {status === "revoked" && "Revogado"}
                  </span>
                  <span className="invite-expires-text">{formatExpiration(inv)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="invites-col col-actions">
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="invite-menu-btn"
                    title="Mais opções"
                    onClick={() =>
                      setActiveMenuCode((cur) => (cur === inv.code ? null : inv.code))
                    }
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {isMenuOpen && (
                    <div ref={menuRef} className="invite-context-menu">
                      <button
                        type="button"
                        className="invite-context-item"
                        onClick={() => {
                          setActiveMenuCode(null);
                          void handleCopyInvite(inv.code);
                        }}
                      >
                        <Copy size={14} />
                        <span>Copiar convite</span>
                      </button>

                      {status === "active" && (
                        <button
                          type="button"
                          className="invite-context-item danger"
                          onClick={() => void handleRevokeInvite(inv.code)}
                          disabled={task.busy}
                        >
                          <Slash size={14} />
                          <span>Revogar convite</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!loading && invites.length === 0 && (
          <div className="invites-empty-state">
            <p>Nenhum convite criado para esta comunidade.</p>
            {canCreate && (
              <span className="invites-empty-sub">
                Clique em &quot;Criar convite&quot; para convidar amigos e squads.
              </span>
            )}
          </div>
        )}
      </div>

      {/* MODAL: CRIAR CONVITE */}
      {isModalOpen && (
        <div className="server-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div
            className="server-modal-container invite-create-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-invite-title"
          >
            <div className="server-modal-header">
              <div>
                <h3 id="create-invite-title" className="server-modal-title">
                  {newlyCreatedInvite ? "Convite gerado" : "Criar link de convite"}
                </h3>
                <p className="server-modal-subtitle">
                  {newlyCreatedInvite
                    ? "Envie este código para os participantes entrarem na comunidade."
                    : "Configure as opções de expiração e limite de usos para o convite."}
                </p>
              </div>
              <button
                type="button"
                className="server-modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {newlyCreatedInvite ? (
              <div className="invite-generated-body">
                <div className="server-settings-field">
                  <label className="server-settings-label">Código do convite</label>
                  <div className="invite-generated-input-row">
                    <input
                      type="text"
                      className="server-settings-input"
                      readOnly
                      value={newlyCreatedInvite.code}
                    />
                    <button
                      type="button"
                      className="server-btn server-btn-primary"
                      onClick={() => void handleCopyInvite(newlyCreatedInvite.code)}
                    >
                      {copiedCode === newlyCreatedInvite.code ? (
                        <>
                          <Check size={15} style={{ marginRight: "4px" }} />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy size={15} style={{ marginRight: "4px" }} />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="invite-generated-details">
                  <span>
                    <Clock size={13} style={{ marginRight: "4px" }} />
                    {formatExpiration(newlyCreatedInvite)}
                  </span>
                  <span>
                    <Users size={13} style={{ marginRight: "4px" }} />
                    {newlyCreatedInvite.max_uses
                      ? `Até ${newlyCreatedInvite.max_uses} usos`
                      : "Usos ilimitados"}
                  </span>
                </div>

                <div className="server-modal-footer">
                  <button
                    type="button"
                    className="server-btn server-btn-secondary"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              <div className="invite-create-form">
                {/* Expira em */}
                <div className="server-settings-field">
                  <label className="server-settings-label">Expira em</label>
                  <select
                    className="server-settings-select"
                    value={
                      selectedExpirationSeconds === null
                        ? "null"
                        : String(selectedExpirationSeconds)
                    }
                    onChange={(e) =>
                      setSelectedExpirationSeconds(
                        e.target.value === "null" ? null : Number(e.target.value),
                      )
                    }
                  >
                    {EXPIRATION_OPTIONS.map((opt) => (
                      <option
                        key={opt.label}
                        value={opt.seconds === null ? "null" : String(opt.seconds)}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Número máximo de usos */}
                <div className="server-settings-field">
                  <label className="server-settings-label">
                    Número máximo de usos
                  </label>
                  <select
                    className="server-settings-select"
                    value={
                      selectedMaxUses === null ? "null" : String(selectedMaxUses)
                    }
                    onChange={(e) =>
                      setSelectedMaxUses(
                        e.target.value === "null" ? null : Number(e.target.value),
                      )
                    }
                  >
                    {MAX_USES_OPTIONS.map((opt) => (
                      <option
                        key={opt.label}
                        value={opt.uses === null ? "null" : String(opt.uses)}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="server-modal-footer">
                  <button
                    type="button"
                    className="server-btn server-btn-secondary"
                    onClick={() => setIsModalOpen(false)}
                    disabled={task.busy}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="server-btn server-btn-primary"
                    onClick={() => void handleCreateInvite()}
                    disabled={task.busy}
                  >
                    {task.busy ? "Gerando..." : "Gerar convite"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
