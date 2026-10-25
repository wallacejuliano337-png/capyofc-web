import { useState, useMemo, useEffect } from "react";
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Users,
} from "lucide-react";
import { Avatar } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import type { Community } from "../../services/communities";
import {
  loadCommunityAuditLogs,
  formatAuditActionVerb,
  formatAuditDate,
  type AuditLogEntry,
  type AuditLogActionType,
} from "../../services/community-audit";

interface CommunityAuditLogViewProps {
  community: Community;
  isOwner: boolean;
  permissions: string[];
}

type EventFilterCategory =
  | "all"
  | "members"
  | "roles"
  | "channels"
  | "categories"
  | "invites"
  | "system"
  | "expressions"
  | "integrations";

export function CommunityAuditLogView({
  community,
  isOwner,
  permissions,
}: CommunityAuditLogViewProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [eventCategory, setEventCategory] =
    useState<EventFilterCategory>("all");
  const [selectedActorId, setSelectedActorId] = useState<string>("all");
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    let active = true;
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const list = await loadCommunityAuditLogs(community.id, {
          isOwner,
          permissions,
        });
        if (active) setLogs(list);
      } catch (err) {
        console.error("[CommunityAuditLogView] load error:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchLogs();

    if (!supabase) {
      return () => {
        active = false;
      };
    }

    const channel = supabase
      .channel(`community-audit:${community.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_audit_logs",
          filter: `community_id=eq.${community.id}`,
        },
        () => {
          void fetchLogs();
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase?.removeChannel(channel);
    };
  }, [community.id, isOwner, permissions]);

  // Extract distinct actors from logs for the filter dropdown
  const distinctActors = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const log of logs) {
      if (!map.has(log.actor_user_id)) {
        map.set(log.actor_user_id, {
          id: log.actor_user_id,
          name: log.actor_name,
        });
      }
    }
    return Array.from(map.values());
  }, [logs]);

  // Filter logs by search, category and actor
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Actor filter
      if (selectedActorId !== "all" && log.actor_user_id !== selectedActorId) {
        return false;
      }

      // 2. Category filter
      if (eventCategory !== "all") {
        const matchesCategory = checkActionCategory(
          log.action_type,
          eventCategory,
        );
        if (!matchesCategory) return false;
      }

      // 3. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const actorNameMatch = log.actor_name.toLowerCase().includes(q);
        const actorUserMatch = log.actor_username.toLowerCase().includes(q);
        const targetMatch = log.target_name?.toLowerCase().includes(q) || false;
        const verbMatch = formatAuditActionVerb(log.action_type)
          .toLowerCase()
          .includes(q);
        const reasonMatch =
          log.metadata?.reason?.toLowerCase().includes(q) || false;

        return (
          actorNameMatch ||
          actorUserMatch ||
          targetMatch ||
          verbMatch ||
          reasonMatch
        );
      }

      return true;
    });
  }, [logs, search, eventCategory, selectedActorId]);

  const toggleExpand = (logId: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  return (
    <section className="audit-log-container">
      {/* Header */}
      <header className="audit-log-header">
        <h2 className="server-settings-title">Registro de auditoria</h2>
        <p className="server-settings-description">
          Acompanhe as ações administrativas realizadas nesta comunidade.
        </p>
      </header>

      {/* Toolbar / Filters */}
      <div className="audit-log-toolbar">
        {/* Search */}
        <div className="audit-search-wrap">
          <Search size={15} className="audit-search-icon" />
          <input
            type="text"
            className="audit-search-input"
            placeholder="Buscar no registro"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="audit-search-clear"
              onClick={() => setSearch("")}
              title="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter: Events */}
        <div className="audit-select-wrap">
          <Filter size={14} className="audit-select-icon" />
          <select
            className="audit-select"
            value={eventCategory}
            onChange={(e) =>
              setEventCategory(e.target.value as EventFilterCategory)
            }
            aria-label="Filtrar por tipo de evento"
          >
            <option value="all">Todos os eventos</option>
            <option value="members">Membros e Banimentos</option>
            <option value="roles">Cargos</option>
            <option value="channels">Canais</option>
            <option value="categories">Categorias</option>
            <option value="invites">Convites</option>
            <option value="system">Segurança e Servidor</option>
            <option value="expressions">Expressões (Emojis, Figurinhas e Sons)</option>
            <option value="integrations">Integrações e Webhooks</option>
          </select>
        </div>

        {/* Filter: Admins */}
        <div className="audit-select-wrap">
          <Users size={14} className="audit-select-icon" />
          <select
            className="audit-select"
            value={selectedActorId}
            onChange={(e) => setSelectedActorId(e.target.value)}
            aria-label="Filtrar por administrador"
          >
            <option value="all">Todos os administradores</option>
            {distinctActors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content Area */}
      {loading && logs.length === 0 ? (
        <div className="audit-empty-state">
          <div className="audit-empty-icon-box">
            <Clock size={28} color="#949ba4" />
          </div>
          <h3 className="audit-empty-title">Carregando registro de auditoria...</h3>
        </div>
      ) : logs.length === 0 ? (
        // Empty State: No logs in community at all
        <div className="audit-empty-state">
          <div className="audit-empty-icon-box">
            <Clock size={28} color="#949ba4" />
          </div>
          <h3 className="audit-empty-title">
            Nenhuma atividade administrativa registrada ainda.
          </h3>
          <p className="audit-empty-text">
            As ações administrativas realizadas nesta comunidade aparecerão aqui.
          </p>
        </div>
      ) : filteredLogs.length === 0 ? (
        // Empty State: Search/filter returned no results
        <div className="audit-empty-state">
          <div className="audit-empty-icon-box">
            <Search size={26} color="#949ba4" />
          </div>
          <h3 className="audit-empty-title">Nenhum evento encontrado.</h3>
          <p className="audit-empty-text">
            Nenhuma ação corresponde aos filtros ou ao termo de busca pesquisado.
          </p>
          <button
            type="button"
            className="server-btn server-btn-secondary"
            onClick={() => {
              setSearch("");
              setEventCategory("all");
              setSelectedActorId("all");
            }}
            style={{ marginTop: "12px" }}
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        // Timeline List
        <div className="audit-timeline">
          {filteredLogs.map((log) => {
            const hasDetails = Boolean(
              log.metadata?.reason ||
                (log.metadata?.changes && log.metadata.changes.length > 0) ||
                log.metadata?.max_uses !== undefined ||
                log.metadata?.expires_at !== undefined ||
                log.metadata?.field,
            );
            const isExpanded = expandedLogIds.has(log.id);

            return (
              <article
                key={log.id}
                className={`audit-item ${isExpanded ? "expanded" : ""}`}
              >
                <div
                  className="audit-item-main"
                  onClick={() => hasDetails && toggleExpand(log.id)}
                  style={{ cursor: hasDetails ? "pointer" : "default" }}
                  role={hasDetails ? "button" : undefined}
                  tabIndex={hasDetails ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (hasDetails && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      toggleExpand(log.id);
                    }
                  }}
                  aria-expanded={hasDetails ? isExpanded : undefined}
                >
                  {/* Actor Avatar */}
                  <div className="audit-item-avatar-wrap">
                    <Avatar
                      userId={log.actor_user_id}
                      name={log.actor_name}
                      url={log.actor_avatar_url}
                      size={36}
                    />
                  </div>

                  {/* Text details */}
                  <div className="audit-item-body">
                    <div className="audit-item-summary">
                      <span className="audit-actor-name">{log.actor_name}</span>
                      <span className="audit-action-verb">
                        {formatAuditActionVerb(log.action_type)}
                      </span>
                      {log.target_name && (
                        <span className="audit-target-name">
                          {log.target_name}
                        </span>
                      )}
                    </div>

                    <div className="audit-item-meta-row">
                      <span className="audit-timestamp">
                        {formatAuditDate(log.created_at)}
                      </span>

                      {log.metadata?.reason && !isExpanded && (
                        <span className="audit-reason-snippet">
                          • Motivo: {log.metadata.reason}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand Chevron (if extra details available) */}
                  {hasDetails && (
                    <div className="audit-expand-col">
                      <span className="audit-expand-btn">
                        {isExpanded ? (
                          <ChevronDown size={18} />
                        ) : (
                          <ChevronRight size={18} />
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Expandable Details Container */}
                {hasDetails && isExpanded && (
                  <div className="audit-details-panel">
                    {/* Reason */}
                    {Boolean(log.metadata?.reason) && (
                      <div className="audit-detail-row">
                        <span className="audit-detail-label">Motivo:</span>
                        <span className="audit-detail-value">
                          {log.metadata?.reason}
                        </span>
                      </div>
                    )}

                    {/* Invites specific details */}
                    {log.metadata?.max_uses !== undefined && (
                      <div className="audit-detail-row">
                        <span className="audit-detail-label">
                          Limite de usos:
                        </span>
                        <span className="audit-detail-value">
                          {log.metadata?.max_uses
                            ? `${String(log.metadata.max_uses)} usos`
                            : "Ilimitado"}
                        </span>
                      </div>
                    )}

                    {/* Safety specific details */}
                    {Boolean(log.metadata?.field) && (
                      <div className="audit-detail-row">
                        <span className="audit-detail-label">Campo:</span>
                        <span className="audit-detail-value">
                          {String(log.metadata?.field)}
                        </span>
                      </div>
                    )}

                    {/* Detailed Change comparison list */}
                    {Boolean(
                      log.metadata?.changes && log.metadata.changes.length > 0,
                    ) && (
                      <div className="audit-changes-list">
                        <div className="audit-changes-title">
                          Alterações realizadas:
                        </div>
                        {log.metadata?.changes?.map((change, idx) => (
                          <div key={idx} className="audit-change-entry">
                            <span className="audit-change-field">
                              {change.field}:
                            </span>
                            <span className="audit-change-comparison">
                              {change.before !== undefined && (
                                <span className="audit-change-before">
                                  Antes: <strong>{String(change.before)}</strong>
                                </span>
                              )}
                              <span className="audit-change-arrow">→</span>
                              <span className="audit-change-after">
                                Depois: <strong>{String(change.after)}</strong>
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function checkActionCategory(
  action: AuditLogActionType,
  category: EventFilterCategory,
): boolean {
  switch (category) {
    case "members":
      return [
        "member_ban",
        "member_unban",
        "member_role_add",
        "member_role_remove",
        "member_kick",
      ].includes(action);
    case "roles":
      return ["role_create", "role_update", "role_delete"].includes(action);
    case "channels":
      return ["channel_create", "channel_update", "channel_delete"].includes(
        action,
      );
    case "categories":
      return [
        "category_create",
        "category_update",
        "category_delete",
      ].includes(action);
    case "invites":
      return ["invite_create", "invite_revoke"].includes(action);
    case "system":
      return ["community_update", "safety_update"].includes(action);
    case "expressions":
      return [
        "emoji_create",
        "emoji_update",
        "emoji_delete",
        "sticker_create",
        "sticker_update",
        "sticker_delete",
        "sound_create",
        "sound_update",
        "sound_delete",
      ].includes(action);
    case "integrations":
      return [
        "webhook_create",
        "webhook_update",
        "webhook_token_regenerate",
        "webhook_delete",
        "integration_connect",
        "integration_disconnect",
      ].includes(action);
    default:
      return true;
  }
}
