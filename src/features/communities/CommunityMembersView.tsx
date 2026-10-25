import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  MoreHorizontal,
  Shield,
  Crown,
  X,
  User,
  Check,
  Ban,
  UserX,
  Plus,
} from "lucide-react";
import { Avatar, ErrorNotice, useTask } from "../../components/ui";
import {
  communityAction,
  type Community,
  type Member,
  type CommunityRole,
  getDisplayRoleColor,
  getMemberRoles,
  getHighestRole,
  canAssignRoleToMember,
  canRemoveRoleFromMember,
  canManageTargetMember,
} from "../../services/communities";
import { ProfileCard } from "../profile/ProfileCard";
import { profileAppearance } from "../../services/profile";
import { executeCommunityBan } from "../../services/community-bans";
import { recordAuditLogEntry } from "../../services/community-audit";

export type MemberFilterCategory = "all" | "admin" | "mod" | "member";

export function CommunityMembersView({
  community,
  members,
  roles,
  permissions,
  userId,
  presence = {},
  onChanged,
}: {
  community: Community;
  members: Member[];
  roles: CommunityRole[];
  permissions: string[];
  userId: string;
  presence?: Record<string, string>;
  onChanged: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MemberFilterCategory>("all");
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(
    null,
  );
  const [editingRoleMember, setEditingRoleMember] = useState<Member | null>(
    null,
  );
  const [viewingProfileMember, setViewingProfileMember] =
    useState<Member | null>(null);
  const [banningMember, setBanningMember] = useState<Member | null>(null);
  const [banReason, setBanReason] = useState("");
  const [kickingMember, setKickingMember] = useState<Member | null>(null);
  const [kickReason, setKickReason] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);
  const task = useTask();

  // Close context menu on outside click or ESC
  useEffect(() => {
    if (!activeMenuMemberId) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuMemberId(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenuMemberId(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeMenuMemberId]);

  // Actor authority
  const isOwner = community.owner_id === userId;
  const actorMember = useMemo(
    () => members.find((m) => m.user_id === userId),
    [members, userId],
  );
  const actorHighestRole = useMemo(
    () => (actorMember ? getHighestRole(actorMember, roles) : null),
    [actorMember, roles],
  );
  const actorPosition = isOwner ? 100 : (actorHighestRole?.position ?? 0);

  const canModerate =
    isOwner ||
    permissions.includes("moderate_members") ||
    permissions.includes("administrator") ||
    permissions.includes("manage_community");

  // Check if current user can moderate/ban a specific member
  const canModerateMember = (target: Member) => {
    if (!canModerate) return false;
    if (target.user_id === community.owner_id) return false;
    if (target.user_id === userId) return false;
    if (isOwner) return true;
    const targetHighest = getHighestRole(target, roles);
    const targetPos = targetHighest?.position ?? 0;
    return actorPosition > targetPos;
  };

  // Check if current user can edit a specific member's role
  const canEditMemberRole = (target: Member) => {
    if (!actorMember) return false;
    return canManageTargetMember(actorMember, target, community, roles);
  };

  // Helper to categorize a member
  const getMemberCategory = (m: Member): "owner" | "admin" | "mod" | "member" => {
    if (m.user_id === community.owner_id || m.community_roles?.base_role === "OWNER") {
      return "owner";
    }
    const memberRolesList = getMemberRoles(m, roles);
    if (
      memberRolesList.some(
        (r) =>
          r.base_role === "ADMIN" ||
          r.permissions?.includes("administrator") ||
          r.permissions?.includes("manage_community") ||
          r.permissions?.includes("manage_roles") ||
          r.permissions?.includes("manage_channels"),
      )
    ) {
      return "admin";
    }
    if (
      memberRolesList.some(
        (r) =>
          r.base_role === "MODERATOR" ||
          r.permissions?.includes("kick_members") ||
          r.permissions?.includes("ban_members") ||
          r.permissions?.includes("moderate_members"),
      )
    ) {
      return "mod";
    }
    return "member";
  };

  // Counts for filters
  const counts = useMemo(() => {
    let admin = 0;
    let mod = 0;
    let member = 0;
    for (const m of members) {
      const cat = getMemberCategory(m);
      if (cat === "owner" || cat === "admin") admin++;
      else if (cat === "mod") mod++;
      else member++;
    }
    return { all: members.length, admin, mod, member };
  }, [members, community.owner_id]);

  // Sort members:
  // 1. Owner
  // 2. Highest position role
  // 3. Alphabetical by display name
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.user_id === community.owner_id) return -1;
      if (b.user_id === community.owner_id) return 1;
      const posA = getHighestRole(a, roles)?.position ?? 0;
      const posB = getHighestRole(b, roles)?.position ?? 0;
      if (posA !== posB) return posB - posA;
      return a.profiles.display_name.localeCompare(b.profiles.display_name);
    });
  }, [members, roles, community.owner_id]);

  // Filter members by search term and filter category
  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedMembers.filter((m) => {
      if (filter === "admin") {
        const cat = getMemberCategory(m);
        if (cat !== "owner" && cat !== "admin") return false;
      } else if (filter === "mod") {
        if (getMemberCategory(m) !== "mod") return false;
      } else if (filter === "member") {
        if (getMemberCategory(m) !== "member") return false;
      }

      if (!q) return true;
      return (
        m.profiles.display_name.toLowerCase().includes(q) ||
        m.profiles.username.toLowerCase().includes(q)
      );
    });
  }, [sortedMembers, filter, search, community.owner_id]);

  // Handle toggling a role for a member (adicionar ou remover)
  const handleToggleMemberRole = async (targetMember: Member, targetRole: CommunityRole) => {
    if (!actorMember) return;
    const assignedIds = new Set(
      targetMember.role_ids && targetMember.role_ids.length > 0
        ? targetMember.role_ids
        : [targetMember.role_id],
    );
    const isAssigned = assignedIds.has(targetRole.id);

    if (isAssigned) {
      if (!canRemoveRoleFromMember(actorMember, targetMember, targetRole, community, roles)) {
        alert("Você não possui autoridade para remover este cargo.");
        return;
      }
    } else {
      if (!canAssignRoleToMember(actorMember, targetMember, targetRole, community, roles)) {
        alert("Você não possui autoridade para atribuir este cargo.");
        return;
      }
    }

    await task.run(async () => {
      if (isAssigned) {
        await communityAction("remove_member_role", {
          community_id: community.id,
          user_id: targetMember.user_id,
          role_id: targetRole.id,
        });
      } else {
        await communityAction("add_member_role", {
          community_id: community.id,
          user_id: targetMember.user_id,
          role_id: targetRole.id,
        });
      }

      recordAuditLogEntry(
        community.id,
        {
          id: userId,
          display_name: actorMember.profiles.display_name || "Administrador",
          username: actorMember.profiles.username || "admin",
          avatar_url: actorMember.profiles.avatar_url,
        },
        {
          action_type: isAssigned ? "member_role_remove" : "member_role_add",
          target_type: "member",
          target_id: targetMember.user_id,
          target_name: targetMember.profiles.display_name,
          metadata: {
            changes: [
              {
                field: "Cargo",
                before: isAssigned ? targetRole.name : "Nenhum",
                after: isAssigned ? "Nenhum" : targetRole.name,
              },
            ],
          },
        },
      );

      await onChanged();
      setEditingRoleMember((prev) => {
        if (!prev || prev.user_id !== targetMember.user_id) return prev;
        const nextIds = new Set(prev.role_ids || [prev.role_id]);
        if (isAssigned) nextIds.delete(targetRole.id);
        else nextIds.add(targetRole.id);
        return {
          ...prev,
          role_ids: Array.from(nextIds),
        };
      });
    });
  };

  const handleConfirmBan = (target: Member) => {
    if (!canModerateMember(target)) return;
    const trimmedReason = banReason.trim();
    void task.run(async () => {
      await executeCommunityBan(community.id, target.user_id, trimmedReason);

      recordAuditLogEntry(
        community.id,
        {
          id: userId,
          display_name: actorMember?.profiles.display_name || "Moderador",
          username: actorMember?.profiles.username || "moderador",
          avatar_url: actorMember?.profiles.avatar_url,
        },
        {
          action_type: "member_ban",
          target_type: "member",
          target_id: target.user_id,
          target_name: target.profiles.display_name,
          metadata: {
            target_username: target.profiles.username,
            reason: trimmedReason || undefined,
          },
        },
      );

      await onChanged();
      setBanningMember(null);
      setBanReason("");
    });
  };

  const handleConfirmKick = (target: Member) => {
    if (!canModerateMember(target)) return;
    const trimmedReason = kickReason.trim();
    void task.run(async () => {
      await communityAction("kick_member", {
        community_id: community.id,
        user_id: target.user_id,
        reason: trimmedReason,
      });

      recordAuditLogEntry(
        community.id,
        {
          id: userId,
          display_name: actorMember?.profiles.display_name || "Moderador",
          username: actorMember?.profiles.username || "moderador",
          avatar_url: actorMember?.profiles.avatar_url,
        },
        {
          action_type: "member_kick",
          target_type: "member",
          target_id: target.user_id,
          target_name: target.profiles.display_name,
          metadata: {
            target_username: target.profiles.username,
            reason: trimmedReason || undefined,
          },
        },
      );

      await onChanged();
      setKickingMember(null);
      setKickReason("");
    });
  };

  // Format join date
  const formatJoinDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <section className="community-members-section" aria-labelledby="members-view-title">
      <ErrorNotice text={task.error} />

      {/* Header */}
      <div className="members-main-header">
        <div>
          <h2 id="members-view-title" className="server-settings-title">
            Membros
          </h2>
          <p className="server-settings-description">
            Gerencie os membros desta comunidade e seus cargos atribuídos.
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="members-controls-bar">
        {/* Search */}
        <div className="members-search-wrapper">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar membros por nome ou @username"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="members-search-clear"
              onClick={() => setSearch("")}
              title="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Compact Filters */}
        <div className="members-filters-group">
          <button
            type="button"
            className={`members-filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Todos <span className="members-filter-count">{counts.all}</span>
          </button>
          <button
            type="button"
            className={`members-filter-btn ${filter === "admin" ? "active" : ""}`}
            onClick={() => setFilter("admin")}
          >
            Administração{" "}
            <span className="members-filter-count">{counts.admin}</span>
          </button>
          <button
            type="button"
            className={`members-filter-btn ${filter === "mod" ? "active" : ""}`}
            onClick={() => setFilter("mod")}
          >
            Moderadores{" "}
            <span className="members-filter-count">{counts.mod}</span>
          </button>
          <button
            type="button"
            className={`members-filter-btn ${filter === "member" ? "active" : ""}`}
            onClick={() => setFilter("member")}
          >
            Membros <span className="members-filter-count">{counts.member}</span>
          </button>
        </div>
      </div>

      {/* Table Header */}
      <div className="members-table-header">
        <div className="members-th th-member">
          MEMBRO — {filteredMembers.length}
        </div>
        <div className="members-th th-roles">CARGOS</div>
        <div className="members-th th-date">ENTROU EM</div>
        <div className="members-th th-actions">AÇÕES</div>
      </div>

      {/* Members List */}
      <div className="members-table-body">
        {filteredMembers.map((m) => {
          const rawStatus = presence[m.user_id] || "offline";
          const normStatus =
            rawStatus === "idle" ? "away" : rawStatus === "dnd" ? "busy" : rawStatus;
          const roleColor = getDisplayRoleColor(m, roles);
          const isMemberOwner = m.user_id === community.owner_id;
          const canEditThis = canEditMemberRole(m);
          const isMenuOpen = activeMenuMemberId === m.user_id;

          const assignedCustomRoles = getMemberRoles(m, roles).filter(
            (r) => !r.is_default && r.base_role !== "MEMBER" && r.base_role !== "OWNER",
          );

          return (
            <div className="members-row" key={m.user_id}>
              {/* Member Info */}
              <div className="members-col col-member">
                <div
                  className="member-avatar-wrapper clickable"
                  onClick={() => setViewingProfileMember(m)}
                  title="Ver perfil"
                >
                  <Avatar
                    userId={m.user_id}
                    name={m.profiles.display_name}
                    url={m.profiles.avatar_url}
                    size={38}
                  />
                  <i className={`presence-dot presence-${normStatus}`} />
                </div>

                <div className="member-name-block">
                  <div className="member-name-line">
                    <span
                      className="member-display-name clickable"
                      style={{ color: roleColor }}
                      onClick={() => setViewingProfileMember(m)}
                    >
                      {m.profiles.display_name}
                    </span>
                    {isMemberOwner && (
                      <span className="member-owner-badge" title="Proprietário da comunidade">
                        <Crown size={12} />
                        Proprietário
                      </span>
                    )}
                  </div>
                  <span className="member-username">@{m.profiles.username}</span>
                </div>
              </div>

              {/* Roles */}
              <div className="members-col col-roles">
                <div className="member-roles-wrap">
                  {isMemberOwner && (
                    <span
                      className="member-role-badge-pill"
                      style={{
                        borderColor: "#f1c40f",
                        color: "#f1c40f",
                        background: "rgba(241, 196, 15, 0.12)",
                      }}
                    >
                      <Crown size={11} />
                      <span>Proprietário</span>
                    </span>
                  )}

                  {assignedCustomRoles.map((r) => {
                    const pillColor = r.color || "#99aab5";
                    const canRemove =
                      actorMember &&
                      canRemoveRoleFromMember(actorMember, m, r, community, roles);

                    return (
                      <span
                        key={r.id}
                        className="member-role-badge-pill"
                        style={{
                          borderColor: pillColor,
                          color: pillColor,
                          background: `${pillColor}18`,
                        }}
                      >
                        <span
                          className="member-role-dot"
                          style={{ background: pillColor }}
                        />
                        <span>{r.name}</span>
                        {canRemove && (
                          <button
                            type="button"
                            className="member-role-pill-remove"
                            title={`Remover cargo ${r.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleToggleMemberRole(m, r);
                            }}
                          >
                            <X size={11} />
                          </button>
                        )}
                      </span>
                    );
                  })}

                  {assignedCustomRoles.length === 0 && !isMemberOwner && (
                    <span
                      className="member-role-badge-pill"
                      style={{
                        borderColor: "#99aab5",
                        color: "#99aab5",
                        background: "rgba(153, 170, 181, 0.12)",
                      }}
                    >
                      <span
                        className="member-role-dot"
                        style={{ background: "#99aab5" }}
                      />
                      <span>@todos</span>
                    </span>
                  )}

                  {canEditThis && (
                    <button
                      type="button"
                      className="member-add-role-inline-btn"
                      title={`Gerenciar cargos de ${m.profiles.display_name}`}
                      onClick={() => setEditingRoleMember(m)}
                    >
                      <Plus size={11} />
                      <span>Cargo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Joined At Date */}
              <div className="members-col col-date">
                <span className="member-date-text">
                  {formatJoinDate(m.joined_at || m.profiles.created_at)}
                </span>
              </div>

              {/* Actions Context Menu */}
              <div className="members-col col-actions">
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="member-menu-btn"
                    title={`Mais opções para ${m.profiles.display_name}`}
                    onClick={() =>
                      setActiveMenuMemberId((cur) =>
                        cur === m.user_id ? null : m.user_id,
                      )
                    }
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {isMenuOpen && (
                    <div ref={menuRef} className="member-context-menu">
                      <button
                        type="button"
                        className="member-context-item"
                        onClick={() => {
                          setActiveMenuMemberId(null);
                          setViewingProfileMember(m);
                        }}
                      >
                        <User size={14} />
                        <span>Ver perfil</span>
                      </button>

                      {canEditThis && (
                        <button
                          type="button"
                          className="member-context-item"
                          onClick={() => {
                            setActiveMenuMemberId(null);
                            setEditingRoleMember(m);
                          }}
                        >
                          <Shield size={14} />
                          <span>Gerenciar cargos</span>
                        </button>
                      )}

                      {canModerateMember(m) && (
                        <>
                          <div className="floating-menu-divider" />
                          <button
                            type="button"
                            className="member-context-item danger"
                            onClick={() => {
                              setActiveMenuMemberId(null);
                              setKickingMember(m);
                              setKickReason("");
                            }}
                          >
                            <UserX size={14} />
                            <span>Expulsar membro</span>
                          </button>
                          <button
                            type="button"
                            className="member-context-item danger"
                            onClick={() => {
                              setActiveMenuMemberId(null);
                              setBanningMember(m);
                              setBanReason("");
                            }}
                          >
                            <Ban size={14} />
                            <span>Banir membro</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredMembers.length === 0 && (
          <div className="members-empty-state">
            <p>Nenhum membro encontrado.</p>
          </div>
        )}
      </div>

      {/* POPUP / MODAL: Gerenciar Cargos */}
      {editingRoleMember && (
        <div
          className="member-modal-backdrop"
          onClick={() => setEditingRoleMember(null)}
        >
          <div
            className="member-modal-container"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-modal-title"
          >
            <div className="member-modal-header">
              <div>
                <h3 id="role-modal-title" className="member-modal-title">
                  Gerenciar cargos — {editingRoleMember.profiles.display_name}
                </h3>
                <p className="member-modal-subtitle">
                  Selecione o cargo para este membro na comunidade.
                </p>
              </div>
              <button
                type="button"
                className="member-modal-close-btn"
                onClick={() => setEditingRoleMember(null)}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="member-modal-roles-list">
              {roles
                .filter(
                  (r) =>
                    r.base_role !== "OWNER" &&
                    !r.is_default &&
                    r.base_role !== "MEMBER",
                )
                .map((r) => {
                  const rColor = r.color || "#99aab5";
                  const assignedSet = new Set(
                    editingRoleMember.role_ids &&
                    editingRoleMember.role_ids.length > 0
                      ? editingRoleMember.role_ids
                      : [editingRoleMember.role_id],
                  );
                  const isAssigned = assignedSet.has(r.id);
                  const canModify =
                    actorMember &&
                    (isAssigned
                      ? canRemoveRoleFromMember(
                          actorMember,
                          editingRoleMember,
                          r,
                          community,
                          roles,
                        )
                      : canAssignRoleToMember(
                          actorMember,
                          editingRoleMember,
                          r,
                          community,
                          roles,
                        ));

                  return (
                    <div
                      key={r.id}
                      className={`member-modal-role-row ${
                        isAssigned ? "selected" : ""
                      } ${!canModify ? "disabled" : ""}`}
                      onClick={() => {
                        if (canModify) {
                          void handleToggleMemberRole(editingRoleMember, r);
                        }
                      }}
                    >
                      <div className="member-modal-role-info">
                        <span
                          className="role-color-dot"
                          style={{ background: rColor }}
                        />
                        <span className="member-modal-role-name">{r.name}</span>
                        {r.base_role === "ADMIN" && (
                          <span className="role-tag-badge purple">Admin</span>
                        )}
                        {r.base_role === "MODERATOR" && (
                          <span className="role-tag-badge green">Mod</span>
                        )}
                      </div>

                      <div className="member-modal-role-right">
                        {!canModify && (
                          <span className="member-modal-role-lock">
                            Hierarquia insuficiente
                          </span>
                        )}
                        <div
                          className={`member-role-checkbox ${
                            isAssigned ? "checked" : ""
                          }`}
                        >
                          {isAssigned && <Check size={14} />}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {roles.filter(
                (r) =>
                  r.base_role !== "OWNER" &&
                  !r.is_default &&
                  r.base_role !== "MEMBER",
              ).length === 0 && (
                <p
                  style={{
                    color: "#949ba4",
                    padding: "16px",
                    textAlign: "center",
                  }}
                >
                  Nenhum cargo personalizado configurado ainda. Crie cargos na
                  aba Cargos.
                </p>
              )}
            </div>

            <div className="member-modal-footer">
              <button
                type="button"
                className="server-btn server-btn-secondary"
                onClick={() => setEditingRoleMember(null)}
                disabled={task.busy}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Ver Perfil */}
      {viewingProfileMember && (
        <div
          className="member-modal-backdrop"
          onClick={() => setViewingProfileMember(null)}
        >
          <div
            className="member-profile-modal-container"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Perfil de ${viewingProfileMember.profiles.display_name}`}
          >
            <div className="member-profile-card-wrap">
              <ProfileCard
                profile={viewingProfileMember.profiles}
                appearance={profileAppearance(viewingProfileMember.profiles)}
                presence={presence[viewingProfileMember.user_id] || "offline"}
              />
            </div>
            <button
              type="button"
              className="member-profile-close-btn"
              onClick={() => setViewingProfileMember(null)}
              title="Fechar perfil"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL: BANIR MEMBRO */}
      {banningMember && (
        <div
          className="server-modal-backdrop"
          onClick={() => setBanningMember(null)}
        >
          <div
            className="server-modal-container"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ban-member-modal-title"
          >
            <div className="server-modal-header">
              <div>
                <h3 id="ban-member-modal-title" className="server-modal-title">
                  Banir {banningMember.profiles.display_name}
                </h3>
                <p className="server-modal-subtitle">
                  O membro será removido da comunidade e impedido de reingressar.
                </p>
              </div>
              <button
                type="button"
                className="server-modal-close-btn"
                onClick={() => setBanningMember(null)}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="server-settings-field">
              <label className="server-settings-label">
                Motivo do banimento (opcional)
              </label>
              <textarea
                className="server-settings-textarea"
                rows={3}
                placeholder="Informe o motivo para registro da moderação..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>

            <div className="server-modal-footer">
              <button
                type="button"
                className="server-btn server-btn-secondary"
                onClick={() => setBanningMember(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="server-btn server-btn-solid-danger"
                onClick={() => handleConfirmBan(banningMember)}
              >
                Banir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXPULSAR MEMBRO */}
      {kickingMember && (
        <div
          className="server-modal-backdrop"
          onClick={() => setKickingMember(null)}
        >
          <div
            className="server-modal-container"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="kick-member-modal-title"
          >
            <div className="server-modal-header">
              <div>
                <h3 id="kick-member-modal-title" className="server-modal-title">
                  Expulsar {kickingMember.profiles.display_name}
                </h3>
                <p className="server-modal-subtitle">
                  O membro será removido da comunidade, mas poderá retornar caso receba um novo convite.
                </p>
              </div>
              <button
                type="button"
                className="server-modal-close-btn"
                onClick={() => setKickingMember(null)}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="server-settings-field">
              <label className="server-settings-label">
                Motivo da expulsão (opcional)
              </label>
              <textarea
                className="server-settings-textarea"
                rows={3}
                placeholder="Informe o motivo para registro da moderação..."
                value={kickReason}
                onChange={(e) => setKickReason(e.target.value)}
              />
            </div>

            <div className="server-modal-footer">
              <button
                type="button"
                className="server-btn server-btn-secondary"
                onClick={() => setKickingMember(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="server-btn server-btn-solid-danger"
                onClick={() => handleConfirmKick(kickingMember)}
              >
                Expulsar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
