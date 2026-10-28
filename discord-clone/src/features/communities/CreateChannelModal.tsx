import { useState } from "react";
import { Hash, Volume2, Lock } from "lucide-react";
import { Modal, ErrorNotice, useTask } from "../../components/ui";
import {
  communityAction,
  type Category,
  type CommunityRole,
} from "../../services/communities";
import { recordAuditLogEntry } from "../../services/community-audit";

export interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  categories: Array<Pick<Category, "id" | "name">>;
  initialCategoryId?: string;
  roles?: CommunityRole[];
  actorProfile?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
  };
  onChannelCreated: (channel: {
    id: string;
    name: string;
    kind: "text" | "voice";
    category_id: string;
  }) => Promise<void> | void;
}

export function CreateChannelModal({
  isOpen,
  onClose,
  communityId,
  categories,
  initialCategoryId,
  roles,
  actorProfile,
  onChannelCreated,
}: CreateChannelModalProps) {
  const [kind, setKind] = useState<"text" | "voice">("text");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>(() => {
    if (
      initialCategoryId &&
      categories.some((c) => c.id === initialCategoryId)
    ) {
      return initialCategoryId;
    }
    return categories[0]?.id || "";
  });
  const [isPrivate, setIsPrivate] = useState(false);
  const [privateRoleIds, setPrivateRoleIds] = useState<string[]>([]);
  const task = useTask();

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    if (kind === "text") {
      // Discord style: lowercase, replace spaces with hyphens, remove invalid characters
      setName(
        val
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-_]/g, ""),
      );
    } else {
      setName(val);
    }
  };

  const handleKindChange = (newKind: "text" | "voice") => {
    setKind(newKind);
    if (newKind === "text") {
      setName((prev) =>
        prev
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-_]/g, ""),
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    void task.run(async () => {
      const targetCatId = categoryId || categories[0]?.id;
      const channelId = await communityAction<string>("create_channel", {
        community_id: communityId,
        name: cleanName,
        category_id: targetCatId,
        kind,
        description: "",
        is_private: isPrivate,
        private_role_ids: isPrivate ? privateRoleIds : [],
      });

      const catName = categories.find((c) => c.id === targetCatId)?.name;
      recordAuditLogEntry(
        communityId,
        actorProfile || {
          id: "admin",
          display_name: "Administrador",
          username: "admin",
        },
        {
          action_type: "channel_create",
          target_type: "channel",
          target_id: channelId,
          target_name: kind === "text" ? `#${cleanName}` : `🔊 ${cleanName}`,
          metadata: {
            changes: [
              { field: "Tipo", after: kind === "text" ? "Texto" : "Voz" },
              ...(catName ? [{ field: "Categoria", after: catName }] : []),
            ],
          },
        },
      );

      await onChannelCreated({
        id: channelId,
        name: cleanName,
        kind,
        category_id: targetCatId,
      });

      onClose();
    });
  };

  return (
    <Modal title="Criar canal" className="compact-modal" onClose={onClose}>
      <form onSubmit={handleSubmit} className="compact-modal-form">
        <div className="compact-modal-body">
          <ErrorNotice text={task.error} />

          <div className="form-group">
            <span className="compact-modal-label">TIPO DE CANAL</span>
            <div className="channel-kind-group">
              <div
                className={`channel-kind-card ${kind === "text" ? "active" : ""}`}
                onClick={() => handleKindChange("text")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleKindChange("text");
                  }
                }}
              >
                <div className="kind-card-icon">
                  <Hash size={24} />
                </div>
                <div className="kind-card-info">
                  <strong>Texto</strong>
                  <span>Envie mensagens, imagens e memes</span>
                </div>
                <div className="kind-card-radio">
                  <input
                    type="radio"
                    name="channel-kind"
                    checked={kind === "text"}
                    onChange={() => handleKindChange("text")}
                  />
                </div>
              </div>

              <div
                className={`channel-kind-card ${kind === "voice" ? "active" : ""}`}
                onClick={() => handleKindChange("voice")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleKindChange("voice");
                  }
                }}
              >
                <div className="kind-card-icon">
                  <Volume2 size={24} />
                </div>
                <div className="kind-card-info">
                  <strong>Voz</strong>
                  <span>Converse por voz com áudio de baixa latência</span>
                </div>
                <div className="kind-card-radio">
                  <input
                    type="radio"
                    name="channel-kind"
                    checked={kind === "voice"}
                    onChange={() => handleKindChange("voice")}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="channel-name-input" className="compact-modal-label">
              NOME DO CANAL
            </label>
            <div className="channel-input-wrapper">
              <span className="channel-input-prefix">
                {kind === "text" ? "#" : <Volume2 size={16} />}
              </span>
              <input
                id="channel-name-input"
                className="channel-input-field"
                type="text"
                required
                maxLength={60}
                placeholder={kind === "text" ? "novo-canal" : "Nova Sala"}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {categories.length > 0 && (
            <div className="form-group">
              <label
                htmlFor="channel-category-select"
                className="compact-modal-label"
              >
                CATEGORIA
              </label>
              <select
                id="channel-category-select"
                className="compact-modal-select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group private-channel-group" style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                cursor: "pointer",
                userSelect: "none",
              }}
              onClick={() => setIsPrivate(!isPrivate)}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f2f3f5", fontWeight: 600, fontSize: "14px" }}>
                  <Lock size={16} style={{ color: isPrivate ? "#5865f2" : "#949ba4" }} />
                  <span>Canal privado</span>
                </div>
                <span style={{ fontSize: "12px", color: "#949ba4" }}>
                  Apenas membros e cargos selecionados poderão visualizar este canal.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#5865f2", margin: 0, flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {isPrivate && roles && roles.length > 0 && (
              <div className="private-channel-roles-container">
                <span className="private-channel-roles-header">
                  CARGOS COM ACESSO
                </span>
                <div className="private-channel-roles-list">
                  {roles
                    .filter((r) => !r.is_default && r.base_role !== "MEMBER" && r.base_role !== "OWNER")
                    .map((r) => {
                      const isChecked = privateRoleIds.includes(r.id);
                      return (
                        <div
                          key={r.id}
                          className={`private-role-row ${isChecked ? "selected" : ""}`}
                          onClick={() => {
                            setPrivateRoleIds((prev) =>
                              isChecked ? prev.filter((id) => id !== r.id) : [...prev, r.id],
                            );
                          }}
                        >
                          <input
                            type="checkbox"
                            className="private-role-checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              setPrivateRoleIds((prev) =>
                                e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id),
                              );
                            }}
                          />
                          <span
                            className="private-role-color-dot"
                            style={{
                              backgroundColor: r.color || "#99aab5",
                            }}
                          />
                          <span className="private-role-name">{r.name}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="compact-modal-footer">
          <button
            type="button"
            className="btn-cancel"
            onClick={onClose}
            disabled={task.busy}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-submit"
            disabled={!name.trim() || task.busy}
          >
            {task.busy ? "Criando..." : "Criar canal"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
