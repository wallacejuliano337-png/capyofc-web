import { useState, useMemo } from "react";
import {
  Folder,
  Trash2,
  Check,
  X,
  Slash,
  Plus,
  Shield,
  User,
} from "lucide-react";
import { Modal, ErrorNotice, useTask } from "../../components/ui";
import {
  communityAction,
  type Category,
  type CommunityRole,
  type Member,
  type CategoryPermissionOverride,
} from "../../services/communities";
import {
  CHANNEL_PERMISSIONS,
  type TriStatePermission,
} from "../../services/channel-permissions";
import { recordAuditLogEntry } from "../../services/community-audit";

export interface EditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category;
  communityId: string;
  roles: CommunityRole[];
  members: Member[];
  categoryOverrides: CategoryPermissionOverride[];
  actorProfile?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
  };
  onUpdated: () => Promise<void> | void;
  onDeleted?: () => Promise<void> | void;
}

export function EditCategoryModal({
  isOpen,
  onClose,
  category,
  communityId,
  roles,
  members,
  categoryOverrides,
  actorProfile,
  onUpdated,
  onDeleted,
}: EditCategoryModalProps) {
  const [tab, setTab] = useState<"overview" | "permissions">("overview");

  // Overview Form
  const [name, setName] = useState(category.name);

  // Permissions Form
  const everyoneRole = useMemo(
    () => roles.find((r) => r.is_default || r.base_role === "MEMBER" || r.position === 0),
    [roles],
  );

  const [selectedTarget, setSelectedTarget] = useState<{
    type: "role" | "member";
    id: string;
    name: string;
    color?: string;
  }>(() => ({
    type: "role",
    id: everyoneRole?.id || "",
    name: "@todos",
    color: "#99aab5",
  }));

  const [addingTarget, setAddingTarget] = useState(false);

  // Overrides locais para o target selecionado
  const currentOverridesForTarget = useMemo(() => {
    const map: Record<string, TriStatePermission> = {};
    for (const perm of CHANNEL_PERMISSIONS) {
      const match = categoryOverrides.find(
        (o) =>
          o.category_id === category.id &&
          o.permission === perm.key &&
          o.target_type === selectedTarget.type &&
          (selectedTarget.type === "role"
            ? o.role_id === selectedTarget.id
            : o.user_id === selectedTarget.id),
      );
      map[perm.key] = match ? (match.state as TriStatePermission) : "inherit";
    }
    return map;
  }, [categoryOverrides, category.id, selectedTarget]);

  const [localOverrides, setLocalOverrides] = useState<Record<string, TriStatePermission>>({});

  // Targets com regras existentes
  const targetsWithOverrides = useMemo(() => {
    const roleIds = new Set<string>();
    const userIds = new Set<string>();

    for (const ov of categoryOverrides) {
      if (ov.category_id === category.id) {
        if (ov.target_type === "role" && ov.role_id) roleIds.add(ov.role_id);
        if (ov.target_type === "member" && ov.user_id) userIds.add(ov.user_id);
      }
    }

    const roleTargets = roles
      .filter((r) => roleIds.has(r.id) && r.id !== everyoneRole?.id)
      .map((r) => ({
        type: "role" as const,
        id: r.id,
        name: r.name,
        color: r.color,
      }));

    const memberTargets = members
      .filter((m) => userIds.has(m.user_id))
      .map((m) => ({
        type: "member" as const,
        id: m.user_id,
        name: m.profiles?.display_name || m.profiles?.username || "Membro",
        color: undefined,
      }));

    return { roleTargets, memberTargets };
  }, [categoryOverrides, category.id, roles, members, everyoneRole]);

  const task = useTask();

  if (!isOpen) return null;

  const activeOverrides = {
    ...currentOverridesForTarget,
    ...localOverrides,
  };

  const hasPermChanges = Object.keys(localOverrides).some(
    (k) => localOverrides[k] !== currentOverridesForTarget[k],
  );

  // Handlers
  const handleSaveOverview = () => {
    const cleanName = name.trim();
    if (!cleanName) return;

    void task.run(async () => {
      await communityAction("edit_category", {
        community_id: communityId,
        id: category.id,
        name: cleanName,
        position: category.position,
      });

      if (actorProfile) {
        recordAuditLogEntry(communityId, actorProfile, {
          action_type: "category_update",
          target_type: "category",
          target_id: category.id,
          target_name: cleanName,
        });
      }

      await onUpdated();
      onClose();
    });
  };

  const handleDeleteCategory = () => {
    if (!confirm(`Excluir a categoria "${category.name}"? Todos os canais devem ser removidos primeiro.`)) {
      return;
    }
    void task.run(async () => {
      await communityAction("delete_category", {
        community_id: communityId,
        id: category.id,
      });

      if (actorProfile) {
        recordAuditLogEntry(communityId, actorProfile, {
          action_type: "category_delete",
          target_type: "category",
          target_id: category.id,
          target_name: category.name,
        });
      }

      if (onDeleted) await onDeleted();
      await onUpdated();
      onClose();
    });
  };

  const handleSavePermissions = () => {
    void task.run(async () => {
      await communityAction("set_category_override", {
        community_id: communityId,
        category_id: category.id,
        target_type: selectedTarget.type,
        target_id: selectedTarget.id,
        permissions: activeOverrides,
      });

      setLocalOverrides({});
      await onUpdated();
    });
  };

  const handleDeleteOverride = () => {
    if (selectedTarget.id === everyoneRole?.id) return;
    void task.run(async () => {
      await communityAction("delete_category_override", {
        community_id: communityId,
        category_id: category.id,
        target_type: selectedTarget.type,
        target_id: selectedTarget.id,
      });

      if (everyoneRole) {
        setSelectedTarget({
          type: "role",
          id: everyoneRole.id,
          name: "@todos",
          color: "#99aab5",
        });
      }
      setLocalOverrides({});
      await onUpdated();
    });
  };

  return (
    <Modal
      title={`Editar categoria: ${category.name}`}
      className="compact-modal"
      onClose={onClose}
    >
      <div className="compact-modal-body" style={{ minWidth: "560px" }}>
        <ErrorNotice text={task.error} />

        <div className="channel-edit-tabs">
          <button
            type="button"
            className={`channel-edit-tab ${tab === "overview" ? "active" : ""}`}
            onClick={() => setTab("overview")}
          >
            Visão Geral
          </button>
          <button
            type="button"
            className={`channel-edit-tab ${tab === "permissions" ? "active" : ""}`}
            onClick={() => setTab("permissions")}
          >
            Permissões
          </button>
        </div>

        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="form-group">
              <label htmlFor="edit-cat-name" className="compact-modal-label">
                NOME DA CATEGORIA
              </label>
              <div className="channel-input-wrapper">
                <span className="channel-input-prefix">
                  <Folder size={16} />
                </span>
                <input
                  id="edit-cat-name"
                  className="channel-input-field"
                  type="text"
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "16px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                marginTop: "8px",
              }}
            >
              <button
                type="button"
                className="btn-danger"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  background: "transparent",
                  color: "#ed4245",
                  border: "1px solid rgba(237,66,69,0.3)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
                onClick={handleDeleteCategory}
                disabled={task.busy}
              >
                <Trash2 size={15} />
                <span>Excluir categoria</span>
              </button>

              <button
                type="button"
                className="btn-submit"
                onClick={handleSaveOverview}
                disabled={task.busy || !name.trim()}
              >
                {task.busy ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        )}

        {tab === "permissions" && (
          <div>
            <div className="perm-editor-layout">
              {/* Coluna Esquerda: Lista de Alvos */}
              <div className="perm-target-list">
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#949ba4",
                    letterSpacing: "0.5px",
                    padding: "4px 8px",
                  }}
                >
                  CARGOS / MEMBROS
                </span>

                {/* @todos sempre no topo */}
                {everyoneRole && (
                  <button
                    type="button"
                    className={`perm-target-item ${
                      selectedTarget.type === "role" && selectedTarget.id === everyoneRole.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedTarget({
                        type: "role",
                        id: everyoneRole.id,
                        name: "@todos",
                        color: "#99aab5",
                      });
                      setLocalOverrides({});
                    }}
                  >
                    <Shield size={14} style={{ color: "#99aab5" }} />
                    <span>@todos</span>
                  </button>
                )}

                {/* Cargos com override */}
                {targetsWithOverrides.roleTargets.map((rt) => (
                  <button
                    key={rt.id}
                    type="button"
                    className={`perm-target-item ${
                      selectedTarget.type === "role" && selectedTarget.id === rt.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedTarget(rt);
                      setLocalOverrides({});
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: rt.color || "#5865f2",
                      }}
                    />
                    <span>{rt.name}</span>
                  </button>
                ))}

                {/* Membros com override */}
                {targetsWithOverrides.memberTargets.map((mt) => (
                  <button
                    key={mt.id}
                    type="button"
                    className={`perm-target-item ${
                      selectedTarget.type === "member" && selectedTarget.id === mt.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedTarget(mt);
                      setLocalOverrides({});
                    }}
                  >
                    <User size={14} style={{ color: "#949ba4" }} />
                    <span>{mt.name}</span>
                  </button>
                ))}

                {/* Botão de Adicionar Regra */}
                <button
                  type="button"
                  style={{
                    marginTop: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 8px",
                    background: "transparent",
                    color: "#5865f2",
                    border: "1px dashed rgba(88,101,242,0.4)",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                  onClick={() => setAddingTarget(!addingTarget)}
                >
                  <Plus size={14} />
                  <span>Adicionar cargo/membro</span>
                </button>

                {addingTarget && (
                  <div
                    style={{
                      background: "#2b2d31",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                      padding: "8px",
                      marginTop: "6px",
                      maxHeight: "180px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#949ba4" }}>
                      CARGOS
                    </span>
                    {roles
                      .filter(
                        (r) =>
                          r.id !== everyoneRole?.id &&
                          !targetsWithOverrides.roleTargets.some((t) => t.id === r.id),
                      )
                      .map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="perm-target-item"
                          style={{ padding: "4px 6px", fontSize: "12px" }}
                          onClick={() => {
                            setSelectedTarget({
                              type: "role",
                              id: r.id,
                              name: r.name,
                              color: r.color,
                            });
                            setLocalOverrides({});
                            setAddingTarget(false);
                          }}
                        >
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: r.color || "#5865f2",
                            }}
                          />
                          <span>{r.name}</span>
                        </button>
                      ))}

                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#949ba4", marginTop: "4px" }}>
                      MEMBROS
                    </span>
                    {members
                      .filter(
                        (m) => !targetsWithOverrides.memberTargets.some((t) => t.id === m.user_id),
                      )
                      .map((m) => (
                        <button
                          key={m.user_id}
                          type="button"
                          className="perm-target-item"
                          style={{ padding: "4px 6px", fontSize: "12px" }}
                          onClick={() => {
                            setSelectedTarget({
                              type: "member",
                              id: m.user_id,
                              name: m.profiles?.display_name || m.profiles?.username || "Membro",
                            });
                            setLocalOverrides({});
                            setAddingTarget(false);
                          }}
                        >
                          <User size={12} />
                          <span>{m.profiles?.display_name || m.profiles?.username}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Coluna Direita: Editor de Permissões da Categoria */}
              <div className="perm-content-area">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: "10px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {selectedTarget.type === "role" ? (
                      <span
                        style={{
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          backgroundColor: selectedTarget.color || "#5865f2",
                        }}
                      />
                    ) : (
                      <User size={16} style={{ color: "#5865f2" }} />
                    )}
                    <strong style={{ fontSize: "15px", color: "#f2f3f5" }}>
                      {selectedTarget.name}
                    </strong>
                  </div>

                  {selectedTarget.id !== everyoneRole?.id && (
                    <button
                      type="button"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ed4245",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      onClick={handleDeleteOverride}
                    >
                      <Trash2 size={13} />
                      <span>Excluir regra</span>
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {CHANNEL_PERMISSIONS.map((perm) => {
                    const state = activeOverrides[perm.key] || "inherit";
                    return (
                      <div key={perm.key} className="perm-row-item">
                        <div className="perm-row-info">
                          <span className="perm-row-name">{perm.name}</span>
                          <span className="perm-row-desc">{perm.description}</span>
                        </div>

                        <div className="perm-tri-state">
                          <button
                            type="button"
                            className={`tri-btn deny ${state === "deny" ? "active" : ""}`}
                            onClick={() =>
                              setLocalOverrides((prev) => ({
                                ...prev,
                                [perm.key]: "deny",
                              }))
                            }
                            title="Negar"
                          >
                            <X size={15} />
                          </button>
                          <button
                            type="button"
                            className={`tri-btn inherit ${state === "inherit" ? "active" : ""}`}
                            onClick={() =>
                              setLocalOverrides((prev) => ({
                                ...prev,
                                [perm.key]: "inherit",
                              }))
                            }
                            title="Herdar"
                          >
                            <Slash size={13} />
                          </button>
                          <button
                            type="button"
                            className={`tri-btn allow ${state === "allow" ? "active" : ""}`}
                            onClick={() =>
                              setLocalOverrides((prev) => ({
                                ...prev,
                                [perm.key]: "allow",
                              }))
                            }
                            title="Permitir"
                          >
                            <Check size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Barra de Salvar Permissões */}
                {hasPermChanges && (
                  <div
                    style={{
                      position: "sticky",
                      bottom: 0,
                      background: "#111214",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxShadow: "0 -2px 10px rgba(0,0,0,0.5)",
                    }}
                  >
                    <span style={{ fontSize: "13px", color: "#dbdee1" }}>
                      Você tem alterações não salvas!
                    </span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="btn-cancel"
                        style={{ padding: "6px 12px", fontSize: "12px" }}
                        onClick={() => setLocalOverrides({})}
                        disabled={task.busy}
                      >
                        Redefinir
                      </button>
                      <button
                        type="button"
                        className="btn-submit"
                        style={{ padding: "6px 12px", fontSize: "12px" }}
                        onClick={handleSavePermissions}
                        disabled={task.busy}
                      >
                        {task.busy ? "Salvando..." : "Salvar alterações"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
