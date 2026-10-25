import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  MoreHorizontal,
  FileText,
  Slash,
  X,
  ShieldAlert,
} from "lucide-react";
import { Avatar } from "../../components/ui";
import type { Community } from "../../services/communities";
import {
  loadCommunityBans,
  revokeCommunityBan,
  type CommunityBan,
} from "../../services/community-bans";
import { recordAuditLogEntry } from "../../services/community-audit";

export function CommunityBansView({
  community,
  canModerate,
  actorProfile,
}: {
  community: Community;
  canModerate: boolean;
  actorProfile?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
  };
}) {
  const [bans, setBans] = useState<CommunityBan[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [viewingReasonBan, setViewingReasonBan] = useState<CommunityBan | null>(
    null,
  );
  const [revokingBan, setRevokingBan] = useState<CommunityBan | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // Load bans
  const reloadBans = async () => {
    setLoading(true);
    try {
      const data = await loadCommunityBans(community.id);
      setBans(data);
    } catch (err) {
      console.error("[CommunityBansView] Failed to load bans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reloadBans();
  }, [community.id]);

  // Close context menu on outside click or ESC
  useEffect(() => {
    if (!activeMenuUserId) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuUserId(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenuUserId(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeMenuUserId]);

  const filteredBans = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bans;
    return bans.filter(
      (b) =>
        b.display_name.toLowerCase().includes(q) ||
        b.username.toLowerCase().includes(q),
    );
  }, [bans, search]);

  const handleConfirmRevoke = async (b: CommunityBan) => {
    try {
      await revokeCommunityBan(community.id, b.user_id);
      await recordAuditLogEntry(
        community.id,
        actorProfile || {
          id: "moderator",
          display_name: "Moderador",
          username: "moderador",
        },
        {
          action_type: "member_unban",
          target_type: "member",
          target_id: b.user_id,
          target_name: b.display_name,
          metadata: {
            target_username: b.username,
            reason: b.reason || undefined,
          },
        },
      );
      await reloadBans();
    } catch (err) {
      console.error("[CommunityBansView] Failed to revoke ban:", err);
    } finally {
      setRevokingBan(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  return (
    <section className="community-bans-section" aria-labelledby="bans-view-title">
      {/* Header */}
      <div className="bans-main-header">
        <div>
          <h2 id="bans-view-title" className="server-settings-title">
            Banimentos
          </h2>
          <p className="server-settings-description">
            Gerencie usuários banidos desta comunidade e visualize os registros de moderação.
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="bans-search-wrapper">
        <Search size={16} />
        <input
          type="text"
          placeholder="Buscar usuários banidos por nome ou @username"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            className="bans-search-clear"
            onClick={() => setSearch("")}
            title="Limpar busca"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Bans Table Header */}
      <div className="bans-table-header">
        <div className="bans-th th-user">USUÁRIO — {filteredBans.length}</div>
        <div className="bans-th th-reason">MOTIVO</div>
        <div className="bans-th th-date">BANIDO EM</div>
        <div className="bans-th th-actions">AÇÕES</div>
      </div>

      {/* Bans Table Body */}
      <div className="bans-table-body">
        {filteredBans.map((ban) => {
          const isMenuOpen = activeMenuUserId === ban.user_id;

          return (
            <div className="bans-row" key={ban.user_id}>
              {/* User info */}
              <div className="bans-col col-user">
                <Avatar
                  userId={ban.user_id}
                  name={ban.display_name}
                  url={ban.avatar_url ?? null}
                  size={36}
                />
                <div className="bans-user-name-wrap">
                  <span className="bans-display-name">{ban.display_name}</span>
                  <span className="bans-username">@{ban.username}</span>
                </div>
              </div>

              {/* Reason */}
              <div className="bans-col col-reason">
                <span className="bans-reason-text" title={ban.reason || "Sem motivo"}>
                  {ban.reason ? ban.reason : "Nenhum motivo especificado."}
                </span>
              </div>

              {/* Banned At Date */}
              <div className="bans-col col-date">
                <span className="bans-date-text">{formatDate(ban.created_at)}</span>
              </div>

              {/* Actions Menu */}
              <div className="bans-col col-actions">
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="bans-menu-btn"
                    title="Mais opções"
                    onClick={() =>
                      setActiveMenuUserId((cur) =>
                        cur === ban.user_id ? null : ban.user_id,
                      )
                    }
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {isMenuOpen && (
                    <div ref={menuRef} className="bans-context-menu">
                      <button
                        type="button"
                        className="bans-context-item"
                        onClick={() => {
                          setActiveMenuUserId(null);
                          setViewingReasonBan(ban);
                        }}
                      >
                        <FileText size={14} />
                        <span>Ver motivo</span>
                      </button>

                      {canModerate && (
                        <button
                          type="button"
                          className="bans-context-item danger"
                          onClick={() => {
                            setActiveMenuUserId(null);
                            setRevokingBan(ban);
                          }}
                        >
                          <Slash size={14} />
                          <span>Revogar banimento</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && filteredBans.length === 0 ? (
          <div className="bans-empty-state">
            <p className="bans-empty-title">Carregando banimentos...</p>
          </div>
        ) : filteredBans.length === 0 ? (
          <div className="bans-empty-state">
            <ShieldAlert size={32} color="#80848e" />
            <p className="bans-empty-title">Nenhum usuário banido.</p>
            <span className="bans-empty-sub">
              {search
                ? `Nenhum banimento corresponde a "${search}".`
                : "Os participantes banidos desta comunidade serão exibidos aqui."}
            </span>
          </div>
        ) : null}
      </div>

      {/* MODAL: VER MOTIVO */}
      {viewingReasonBan && (
        <div
          className="server-modal-backdrop"
          onClick={() => setViewingReasonBan(null)}
        >
          <div
            className="server-modal-container"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-reason-title"
          >
            <div className="server-modal-header">
              <div>
                <h3 id="view-reason-title" className="server-modal-title">
                  Motivo do banimento
                </h3>
                <p className="server-modal-subtitle">
                  Registro de moderação para <strong>{viewingReasonBan.display_name}</strong>.
                </p>
              </div>
              <button
                type="button"
                className="server-modal-close-btn"
                onClick={() => setViewingReasonBan(null)}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bans-reason-modal-content">
              <div className="bans-reason-meta">
                <span>
                  Banido em: <strong>{formatDate(viewingReasonBan.created_at)}</strong>
                </span>
                {viewingReasonBan.banned_by_name && (
                  <span>
                    Responsável: <strong>{viewingReasonBan.banned_by_name}</strong>
                  </span>
                )}
              </div>

              <div className="bans-reason-box">
                <p>
                  {viewingReasonBan.reason ||
                    "Nenhum motivo específico informado no momento do banimento."}
                </p>
              </div>
            </div>

            <div className="server-modal-footer">
              <button
                type="button"
                className="server-btn server-btn-secondary"
                onClick={() => setViewingReasonBan(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REVOGAR BANIMENTO */}
      {revokingBan && (
        <div className="server-modal-backdrop" onClick={() => setRevokingBan(null)}>
          <div
            className="server-modal-container"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-ban-title"
          >
            <div className="server-modal-header">
              <div>
                <h3 id="revoke-ban-title" className="server-modal-title">
                  Revogar banimento de {revokingBan.display_name}?
                </h3>
                <p className="server-modal-subtitle">
                  O usuário poderá entrar novamente na comunidade caso possua um convite de acesso válido.
                </p>
              </div>
              <button
                type="button"
                className="server-modal-close-btn"
                onClick={() => setRevokingBan(null)}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="server-modal-footer">
              <button
                type="button"
                className="server-btn server-btn-secondary"
                onClick={() => setRevokingBan(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="server-btn server-btn-primary"
                onClick={() => handleConfirmRevoke(revokingBan)}
              >
                Revogar banimento
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
