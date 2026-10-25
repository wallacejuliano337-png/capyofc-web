import { useState, useMemo, useEffect, useRef } from "react";
import {
  Plus,
  Search,
  Shield,
  Trash2,
  ChevronUp,
  ChevronDown,
  UserCheck,
  UserPlus,
  UserMinus,
  Lock,
  GripVertical,
  AlertTriangle,
} from "lucide-react";
import { Avatar, ErrorNotice, useTask } from "../../components/ui";
import {
  communityAction,
  type Community,
  type Member,
  type CommunityRole,
} from "../../services/communities";
import {
  DEFAULT_ROLE_COLORS,
  PERMISSION_GROUPS,
  getHighestRole,
  canAssignRoleToMember,
  canRemoveRoleFromMember,
  getRoleColor,
} from "../../services/community-roles";
import {
  recordAuditLogEntry,
  type AuditChangeDetail,
} from "../../services/community-audit";

export { getRoleColor };

export function RolesManagerView({
  community,
  roles,
  members,
  permissions,
  userId,
  onChanged,
}: {
  community: Community;
  roles: CommunityRole[];
  members: Member[];
  permissions: string[];
  userId: string;
  onChanged: () => Promise<void>;
}) {
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

  const actor = useMemo(
    () => ({
      id: userId,
      display_name: actorMember?.profiles.display_name || "Administrador",
      username: actorMember?.profiles.username || "admin",
      avatar_url: actorMember?.profiles.avatar_url,
    }),
    [userId, actorMember],
  );

  const canCreateRole =
    isOwner ||
    permissions.includes("manage_roles") ||
    permissions.includes("administrator") ||
    permissions.includes("manage_community");

  const isRoleEditable = (r: CommunityRole) => {
    if (r.base_role === "OWNER") return false;
    if (isOwner) return true;
    if (!canCreateRole) return false;
    return r.position < actorPosition;
  };

  const canGrantPermission = (permKey: string) => {
    if (isOwner) return true;
    if (
      permissions.includes("administrator") ||
      permissions.includes("manage_community")
    )
      return true;
    return permissions.includes(permKey);
  };

  // Search filter for left list
  const [searchQuery, setSearchQuery] = useState("");

  // Roles sorted descending by position: highest on top, @todos always at the bottom
  const sortedRoles = useMemo(() => {
    const list = [...roles];
    const custom = list.filter((r) => !r.is_default && r.base_role !== "MEMBER");
    custom.sort((a, b) => b.position - a.position);
    const everyone = list.find((r) => r.is_default || r.base_role === "MEMBER");
    if (everyone) {
      custom.push(everyone);
    }
    return custom;
  }, [roles]);

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return sortedRoles;
    const q = searchQuery.trim().toLowerCase();
    return sortedRoles.filter((r) => r.name.toLowerCase().includes(q));
  }, [sortedRoles, searchQuery]);

  // Selected role in master-detail split layout
  const [selectedRoleId, setSelectedRoleId] = useState<string>(() => {
    return sortedRoles[0]?.id || "";
  });

  // Ensure a valid role is selected if roles change
  useEffect(() => {
    if (sortedRoles.length > 0) {
      if (!selectedRoleId || !sortedRoles.some((r) => r.id === selectedRoleId)) {
        setSelectedRoleId(sortedRoles[0].id);
      }
    }
  }, [sortedRoles, selectedRoleId]);

  const activeRole = useMemo(() => {
    return roles.find((r) => r.id === selectedRoleId) || sortedRoles[0] || null;
  }, [roles, selectedRoleId, sortedRoles]);

  const task = useTask();

  // Create new role
  const handleCreateRole = async () => {
    await task.run(async () => {
      const targetPos = Math.max(
        1,
        isOwner ? 80 : Math.max(1, actorPosition - 1),
      );
      const res = await communityAction<string>("create_role", {
        community_id: community.id,
        name: "Novo cargo",
        color: "#5865f2",
        position: targetPos,
        permissions: [
          "view_channels",
          "send_messages",
          "connect_voice",
          "speak",
        ],
      });

      recordAuditLogEntry(community.id, actor, {
        action_type: "role_create",
        target_type: "role",
        target_id: res,
        target_name: "Novo cargo",
        metadata: {
          changes: [
            { field: "Nome", after: "Novo cargo" },
            { field: "Cor", after: "#5865f2" },
            { field: "Prioridade", after: targetPos },
          ],
        },
      });

      await onChanged();
      setSelectedRoleId(res);
    });
  };

  // Reorder role priority up or down
  const handleMoveRole = async (
    role: CommunityRole,
    direction: "up" | "down",
  ) => {
    if (role.is_default || role.base_role === "MEMBER") return;
    const customRoles = sortedRoles.filter(
      (r) => !r.is_default && r.base_role !== "MEMBER" && r.base_role !== "OWNER",
    );
    const index = customRoles.findIndex((r) => r.id === role.id);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= customRoles.length) return;

    const swapTarget = customRoles[targetIndex];
    if (!isRoleEditable(role) || !isRoleEditable(swapTarget)) {
      alert("Você não possui autoridade para alterar a prioridade deste cargo.");
      return;
    }

    const reordered = [...customRoles];
    reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, role);

    await task.run(async () => {
      await communityAction("reorder_roles", {
        community_id: community.id,
        ids: reordered.map((r) => r.id),
      });
      await onChanged();
    });
  };

  // Drag and Drop reordering
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = async () => {
    const fromIndex = dragItem.current;
    const toIndex = dragOverItem.current;
    dragItem.current = null;
    dragOverItem.current = null;

    if (
      fromIndex === null ||
      toIndex === null ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0
    ) {
      return;
    }

    const customRoles = sortedRoles.filter(
      (r) => !r.is_default && r.base_role !== "MEMBER" && r.base_role !== "OWNER",
    );

    if (fromIndex >= customRoles.length || toIndex >= customRoles.length) {
      return; // Cannot drag into @todos position
    }

    const roleToMove = customRoles[fromIndex];
    const targetRole = customRoles[toIndex];

    if (!isRoleEditable(roleToMove) || !isRoleEditable(targetRole)) {
      alert("Você não possui autoridade para reordenar estes cargos.");
      return;
    }

    const reordered = [...customRoles];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);

    await task.run(async () => {
      await communityAction("reorder_roles", {
        community_id: community.id,
        ids: reordered.map((r) => r.id),
      });
      await onChanged();
    });
  };

  // Delete role
  const handleDeleteRole = async (r: CommunityRole) => {
    if (r.is_default || r.base_role === "MEMBER" || r.base_role === "OWNER") {
      alert("Cargos padrão do sistema não podem ser excluídos.");
      return;
    }
    if (
      !confirm(
        `Excluir o cargo "${r.name}"? Os membros que possuem este cargo voltarão a @todos.`,
      )
    ) {
      return;
    }
    await task.run(async () => {
      await communityAction("delete_role", {
        community_id: community.id,
        id: r.id,
      });

      recordAuditLogEntry(community.id, actor, {
        action_type: "role_delete",
        target_type: "role",
        target_id: r.id,
        target_name: r.name,
      });

      await onChanged();
      if (selectedRoleId === r.id) {
        setSelectedRoleId(sortedRoles.find((x) => x.id !== r.id)?.id || "");
      }
    });
  };

  return (
    <section className="roles-manager-section" aria-labelledby="roles-view-title">
      <ErrorNotice text={task.error} />

      {/* Main Header */}
      <div className="roles-main-header">
        <div>
          <h2 id="roles-view-title" className="server-settings-title">
            Cargos
          </h2>
          <p className="server-settings-description">
            Defina a hierarquia, atribua cores e configure permissões para os membros da comunidade.
          </p>
        </div>
      </div>

      {/* Split Master-Detail Layout */}
      <div className="roles-split-layout">
        {/* LEFT COLUMN: LISTA DE CARGOS */}
        <aside className="roles-master-sidebar">
          {/* Action Bar */}
          <div className="roles-sidebar-toolbar">
            <div className="roles-sidebar-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Buscar cargos"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {canCreateRole && (
              <button
                type="button"
                className="server-btn server-btn-primary roles-add-role-btn"
                onClick={() => void handleCreateRole()}
                disabled={task.busy}
                title="Criar novo cargo"
              >
                <Plus size={15} />
                <span>Criar</span>
              </button>
            )}
          </div>

          <div className="roles-sidebar-count-label">
            CARGOS — {filteredRoles.length}
          </div>

          {/* Reorderable List */}
          <div className="roles-sidebar-list">
            {filteredRoles.map((r, idx) => {
              const isSelected = selectedRoleId === r.id;
              const isEveryone = Boolean(r.is_default || r.base_role === "MEMBER");
              const isOwnerRole = r.base_role === "OWNER";
              const editable = isRoleEditable(r);
              const memberCount = members.filter((m) =>
                m.role_ids ? m.role_ids.includes(r.id) : m.role_id === r.id,
              ).length;

              return (
                <div
                  key={r.id}
                  className={`roles-sidebar-item ${isSelected ? "selected" : ""} ${
                    isEveryone ? "is-everyone" : ""
                  }`}
                  onClick={() => setSelectedRoleId(r.id)}
                  draggable={!isEveryone && !isOwnerRole && editable}
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={() => void handleDragEnd()}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className="roles-sidebar-item-left">
                    {!isEveryone && !isOwnerRole && editable ? (
                      <span className="role-drag-handle" title="Arraste para reordenar hierarquia">
                        <GripVertical size={14} />
                      </span>
                    ) : (
                      <span className="role-lock-icon" title={isEveryone ? "Cargo padrão (@todos)" : "Cargo do proprietário"}>
                        <Lock size={12} />
                      </span>
                    )}

                    <span
                      className="role-color-dot"
                      style={{ background: r.color || "#99aab5" }}
                    />

                    <div className="role-sidebar-info">
                      <span className="role-sidebar-name">{r.name}</span>
                      {isEveryone && (
                        <span className="role-sidebar-badge default">Padrão</span>
                      )}
                      {isOwnerRole && (
                        <span className="role-sidebar-badge owner">Dono</span>
                      )}
                    </div>
                  </div>

                  <div className="roles-sidebar-item-right">
                    <span className="role-sidebar-member-count" title={`${memberCount} membro(s)`}>
                      {memberCount}
                    </span>

                    {/* Up / Down Controls for reliable reordering without dragging */}
                    {!isEveryone && !isOwnerRole && editable && (
                      <div className="role-reorder-buttons" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="role-reorder-btn"
                          title="Mover cargo para cima"
                          onClick={() => void handleMoveRole(r, "up")}
                          disabled={idx === 0 || task.busy}
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          className="role-reorder-btn"
                          title="Mover cargo para baixo"
                          onClick={() => void handleMoveRole(r, "down")}
                          disabled={
                            idx >= sortedRoles.length - 2 || task.busy
                          }
                        >
                          <ChevronDown size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredRoles.length === 0 && (
              <p className="roles-empty-hint">Nenhum cargo encontrado.</p>
            )}
          </div>
        </aside>

        {/* RIGHT COLUMN: EDITOR DO CARGO SELECIONADO */}
        <main className="roles-detail-editor">
          {activeRole ? (
            <RoleDetailEditor
              key={activeRole.id}
              community={community}
              role={activeRole}
              members={members}
              allRoles={roles}
              isOwner={isOwner}
              editable={isRoleEditable(activeRole)}
              canGrantPermission={canGrantPermission}
              onChanged={onChanged}
              actor={actor}
              actorMember={actorMember}
              onDeleteRole={handleDeleteRole}
            />
          ) : (
            <div className="roles-editor-placeholder">
              <Shield size={36} />
              <p>Selecione um cargo à esquerda para gerenciar.</p>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

// ============================================================
// COMPONENTE: EDITOR DE DETALHES DO CARGO (Coluna da Direita)
// ============================================================
function RoleDetailEditor({
  community,
  role,
  members,
  allRoles,
  isOwner: _isOwner,
  editable,
  canGrantPermission,
  onChanged,
  actor,
  actorMember,
  onDeleteRole,
}: {
  community: Community;
  role: CommunityRole;
  members: Member[];
  allRoles: CommunityRole[];
  isOwner: boolean;
  editable: boolean;
  canGrantPermission: (perm: string) => boolean;
  onChanged: () => Promise<void>;
  actor?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
  };
  actorMember?: Member;
  onDeleteRole: (role: CommunityRole) => Promise<void>;
}) {
  const isEveryone = Boolean(role.is_default || role.base_role === "MEMBER");
  const isOwnerRole = role.base_role === "OWNER";

  const [tab, setTab] = useState<"display" | "permissions" | "members">("display");

  // Form States
  const [roleName, setRoleName] = useState(role.name);
  const [roleColor, setRoleColor] = useState(role.color || "#99aab5");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    role.permissions || [],
  );

  const initialName = role.name;
  const initialColor = role.color || "#99aab5";
  const initialPermissions = useMemo(() => role.permissions || [], [role.permissions]);

  const isDirty = useMemo(() => {
    if (roleName.trim() !== initialName) return true;
    if (roleColor.toLowerCase() !== initialColor.toLowerCase()) return true;
    if (selectedPermissions.length !== initialPermissions.length) return true;
    return selectedPermissions.some((p) => !initialPermissions.includes(p));
  }, [roleName, roleColor, selectedPermissions, initialName, initialColor, initialPermissions]);

  const task = useTask();
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Search & Filter for Members tab
  const [memberSearch, setMemberSearch] = useState("");
  const [filterOnlyAssigned, setFilterOnlyAssigned] = useState(false);

  // Set of assigned member IDs
  const assignedMemberIds = useMemo(() => {
    return new Set(
      members
        .filter((m) =>
          m.role_ids ? m.role_ids.includes(role.id) : m.role_id === role.id,
        )
        .map((m) => m.user_id),
    );
  }, [members, role.id]);

  // Handle Save
  const handleSaveRole = async () => {
    if (!roleName.trim()) return;
    await task.run(async () => {
      await communityAction("edit_role", {
        community_id: community.id,
        id: role.id,
        name: roleName.trim(),
        color: roleColor,
        position: isEveryone ? 0 : role.position,
        permissions: selectedPermissions,
      });

      const changes: AuditChangeDetail[] = [];
      if (roleName.trim() !== initialName) {
        changes.push({
          field: "Nome do cargo",
          before: initialName,
          after: roleName.trim(),
        });
      }
      if (roleColor !== initialColor) {
        changes.push({
          field: "Cor do cargo",
          before: initialColor,
          after: roleColor,
        });
      }

      if (changes.length > 0 && actor) {
        recordAuditLogEntry(community.id, actor, {
          action_type: "role_update",
          target_type: "role",
          target_id: role.id,
          target_name: roleName.trim(),
          metadata: { changes },
        });
      }

      await onChanged();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    });
  };

  const handleReset = () => {
    setRoleName(initialName);
    setRoleColor(initialColor);
    setSelectedPermissions(initialPermissions);
  };

  const handleTogglePermission = (permKey: string) => {
    if (!editable || !canGrantPermission(permKey)) return;
    setSelectedPermissions((cur) =>
      cur.includes(permKey)
        ? cur.filter((p) => p !== permKey)
        : [...cur, permKey],
    );
  };

  // Toggle member role
  const handleToggleMemberRole = async (targetMember: Member) => {
    const isAssigned = assignedMemberIds.has(targetMember.user_id);
    await task.run(async () => {
      if (isAssigned) {
        await communityAction("remove_member_role", {
          community_id: community.id,
          user_id: targetMember.user_id,
          role_id: role.id,
        });
      } else {
        await communityAction("add_member_role", {
          community_id: community.id,
          user_id: targetMember.user_id,
          role_id: role.id,
        });
      }

      if (actor) {
        recordAuditLogEntry(community.id, actor, {
          action_type: isAssigned ? "member_role_remove" : "member_role_add",
          target_type: "member",
          target_id: targetMember.user_id,
          target_name: targetMember.profiles.display_name,
          metadata: {
            changes: [
              {
                field: "Cargo",
                before: isAssigned ? role.name : "Nenhum",
                after: isAssigned ? "Nenhum" : role.name,
              },
            ],
          },
        });
      }

      await onChanged();
    });
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (filterOnlyAssigned && !assignedMemberIds.has(m.user_id)) return false;
      if (!memberSearch.trim()) return true;
      const q = memberSearch.trim().toLowerCase();
      return (
        m.profiles.display_name.toLowerCase().includes(q) ||
        m.profiles.username.toLowerCase().includes(q)
      );
    });
  }, [members, filterOnlyAssigned, assignedMemberIds, memberSearch]);

  return (
    <div className="role-editor-inner">
      <ErrorNotice text={task.error} />

      {/* Editor Header */}
      <div className="role-editor-header">
        <div className="role-editor-title-wrap">
          <span
            className="role-editor-color-badge"
            style={{ background: roleColor }}
          />
          <h3 className="role-editor-title">{roleName}</h3>
          {isEveryone && <span className="role-tag-badge gold">@todos</span>}
          {isOwnerRole && <span className="role-tag-badge gold">Dono</span>}
        </div>

        {!isEveryone && !isOwnerRole && editable && (
          <button
            type="button"
            className="server-btn server-btn-danger role-delete-btn"
            onClick={() => void onDeleteRole(role)}
            disabled={task.busy}
            title="Excluir este cargo"
          >
            <Trash2 size={14} />
            <span>Excluir cargo</span>
          </button>
        )}
      </div>

      {!editable && (
        <div className="server-settings-alert info" style={{ marginBottom: "16px" }}>
          <AlertTriangle size={15} />
          <span>
            {isOwnerRole
              ? "O cargo de proprietário é gerenciado pelo sistema e não pode ser editado."
              : "Você não possui autoridade para editar este cargo porque ele está acima ou igual ao seu cargo mais alto na hierarquia."}
          </span>
        </div>
      )}

      {savedSuccess && (
        <div className="role-saved-notice" style={{ marginBottom: "16px" }}>
          Alterações salvas com sucesso!
        </div>
      )}

      {/* Subnav Tabs */}
      <div className="role-editor-tabs">
        <button
          type="button"
          className={`role-editor-tab-btn ${tab === "display" ? "active" : ""}`}
          onClick={() => setTab("display")}
        >
          Exibição
        </button>
        <button
          type="button"
          className={`role-editor-tab-btn ${tab === "permissions" ? "active" : ""}`}
          onClick={() => setTab("permissions")}
        >
          Permissões
        </button>
        {!isEveryone && (
          <button
            type="button"
            className={`role-editor-tab-btn ${tab === "members" ? "active" : ""}`}
            onClick={() => setTab("members")}
          >
            Membros ({assignedMemberIds.size})
          </button>
        )}
      </div>

      {/* TAB 1: EXIBIÇÃO (Nome e Cor) */}
      {tab === "display" && (
        <div className="role-editor-tab-content">
          <div className="role-display-grid">
            <div className="role-display-form">
              {/* Nome do Cargo */}
              <div className="server-settings-field">
                <label className="server-settings-label">NOME DO CARGO</label>
                <input
                  type="text"
                  className="server-settings-input"
                  value={roleName}
                  maxLength={40}
                  disabled={!editable || isEveryone}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Nome do cargo"
                />
                {isEveryone && (
                  <p className="role-field-hint">
                    O nome @todos representa todos os membros da comunidade e não pode ser alterado.
                  </p>
                )}
              </div>

              {/* Cor do Cargo */}
              <div className="server-settings-field">
                <label className="server-settings-label">COR DO CARGO</label>
                <p className="role-field-hint">
                  Os membros recebem a cor do cargo mais alto na lista de cargos.
                </p>

                {/* Predefined Palette */}
                <div className="role-color-palette">
                  {DEFAULT_ROLE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`role-color-swatch ${
                        roleColor.toLowerCase() === c.toLowerCase() ? "selected" : ""
                      }`}
                      style={{ background: c }}
                      onClick={() => editable && setRoleColor(c)}
                      title={c}
                    />
                  ))}
                </div>

                {/* Custom Color Picker & Hex Input */}
                <div className="role-custom-color-row">
                  <input
                    type="color"
                    className="role-color-picker-input"
                    value={roleColor}
                    disabled={!editable}
                    onChange={(e) => setRoleColor(e.target.value)}
                    title="Seletor de cor personalizada"
                  />
                  <input
                    type="text"
                    className="server-settings-input role-hex-input"
                    value={roleColor}
                    maxLength={7}
                    disabled={!editable}
                    onChange={(e) => setRoleColor(e.target.value)}
                    placeholder="#5865f2"
                  />
                </div>
              </div>
            </div>

            {/* Live Role Preview */}
            <div className="role-preview-card">
              <div className="server-card-preview-label">Visualização</div>
              <div className="role-preview-box">
                <div className="role-preview-user-row">
                  <div className="role-preview-avatar">
                    <span>L</span>
                  </div>
                  <div className="role-preview-info">
                    <strong
                      className="role-preview-name"
                      style={{ color: roleColor }}
                    >
                      Membro Exemplo
                    </strong>
                    <span
                      className="role-preview-badge"
                      style={{
                        borderColor: roleColor,
                        color: roleColor,
                        background: `${roleColor}1a`,
                      }}
                    >
                      {roleName || "Cargo"}
                    </span>
                  </div>
                </div>
                <p className="role-preview-hint">
                  Esta é uma demonstração de como o nome e o cargo aparecerão no chat e na lista de membros.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PERMISSÕES */}
      {tab === "permissions" && (
        <div className="role-editor-tab-content">
          <p className="server-settings-description" style={{ marginBottom: "16px" }}>
            {isEveryone
              ? "Permissões concedidas a todos os membros por padrão nesta comunidade."
              : "Ative ou desative permissões para os membros que possuem este cargo."}
          </p>

          <div className="role-permissions-groups">
            {PERMISSION_GROUPS.map((group) => (
              <div className="role-perm-group" key={group.title}>
                <div className="role-perm-group-header">{group.title}</div>

                <div className="role-perm-items-list">
                  {group.permissions.map((p) => {
                    const isChecked = selectedPermissions.includes(p.key);
                    const canEditThis = editable && canGrantPermission(p.key);

                    return (
                      <div
                        key={p.key}
                        className={`role-perm-row ${
                          p.isDanger ? "perm-danger-card" : ""
                        }`}
                      >
                        <div className="role-perm-info">
                          <div className="role-perm-name-wrap">
                            <span className="role-perm-name">{p.name}</span>
                            {p.isDanger && (
                              <span className="role-admin-badge">
                                <Shield size={12} /> Acesso Total
                              </span>
                            )}
                          </div>
                          <span className="role-perm-desc">{p.description}</span>
                        </div>

                        {/* Modern ON/OFF Toggle Switch */}
                        <label className="role-switch">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!canEditThis}
                            onChange={() => handleTogglePermission(p.key)}
                          />
                          <span className="role-switch-slider" />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: GERENCIAR MEMBROS */}
      {tab === "members" && !isEveryone && (
        <div className="role-editor-tab-content">
          <div className="role-members-bar">
            <div className="server-members-search" style={{ margin: 0, flex: 1 }}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar membros para este cargo"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
            </div>
            <label className="role-members-filter-pill">
              <input
                type="checkbox"
                checked={filterOnlyAssigned}
                onChange={(e) => setFilterOnlyAssigned(e.target.checked)}
              />
              <span>Apenas atribuídos ({assignedMemberIds.size})</span>
            </label>
          </div>

          <div className="server-members-list" style={{ marginTop: "16px" }}>
            {filteredMembers.map((m) => {
              const isAssigned = assignedMemberIds.has(m.user_id);
              const isMemberOwner = m.user_id === community.owner_id;
              const canModify =
                actorMember &&
                (isAssigned
                  ? canRemoveRoleFromMember(actorMember, m, role, community, allRoles)
                  : canAssignRoleToMember(actorMember, m, role, community, allRoles));

              return (
                <div className="server-member-row" key={m.user_id}>
                  <div className="server-member-info">
                    <Avatar
                      userId={m.user_id}
                      name={m.profiles.display_name}
                      url={m.profiles.avatar_url}
                      size={36}
                    />
                    <div className="server-member-name-wrap">
                      <span className="server-member-name">
                        {m.profiles.display_name}
                      </span>
                      <span className="server-member-tag">
                        @{m.profiles.username}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {isAssigned && (
                      <span
                        className="server-role-badge"
                        style={{
                          background: `${roleColor}26`,
                          color: roleColor,
                        }}
                      >
                        <UserCheck size={13} style={{ marginRight: "4px" }} />
                        Atribuído
                      </span>
                    )}

                    {!isMemberOwner && canModify && (
                      <button
                        type="button"
                        className={`server-btn ${
                          isAssigned ? "server-btn-danger" : "server-btn-secondary"
                        }`}
                        style={{ fontSize: "12px", padding: "6px 12px" }}
                        disabled={task.busy}
                        onClick={() => void handleToggleMemberRole(m)}
                      >
                        {isAssigned ? (
                          <>
                            <UserMinus size={13} style={{ marginRight: "4px" }} />
                            Remover
                          </>
                        ) : (
                          <>
                            <UserPlus size={13} style={{ marginRight: "4px" }} />
                            Adicionar
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredMembers.length === 0 && (
              <p style={{ color: "#949ba4", padding: "16px", textAlign: "center" }}>
                Nenhum membro encontrado.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Floating Save Changes Bar when dirty */}
      {isDirty && (
        <div className="server-settings-save-bar">
          <span className="server-save-bar-text">
            Cuidado — você tem alterações não salvas no cargo!
          </span>
          <div className="server-save-bar-actions">
            <button
              type="button"
              className="server-btn server-btn-secondary"
              onClick={handleReset}
              disabled={task.busy}
            >
              Redefinir
            </button>
            <button
              type="button"
              className="server-btn server-btn-primary"
              onClick={() => void handleSaveRole()}
              disabled={task.busy}
            >
              {task.busy ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
