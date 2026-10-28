import { useState } from "react";
import { Modal, ErrorNotice, useTask } from "../../components/ui";
import { communityAction } from "../../services/communities";
import { recordAuditLogEntry } from "../../services/community-audit";

export interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  categoriesCount: number;
  actorProfile?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
  };
  onCategoryCreated: (newCategoryId: string) => Promise<void> | void;
}

export function CreateCategoryModal({
  isOpen,
  onClose,
  communityId,
  categoriesCount,
  actorProfile,
  onCategoryCreated,
}: CreateCategoryModalProps) {
  const [name, setName] = useState("");
  const task = useTask();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    void task.run(async () => {
      const categoryId = await communityAction<string>("create_category", {
        community_id: communityId,
        name: cleanName,
        position: categoriesCount,
      });

      recordAuditLogEntry(
        communityId,
        actorProfile || {
          id: "admin",
          display_name: "Administrador",
          username: "admin",
        },
        {
          action_type: "category_create",
          target_type: "category",
          target_id: categoryId,
          target_name: cleanName,
        },
      );

      await onCategoryCreated(categoryId);
      onClose();
    });
  };

  return (
    <Modal title="Criar categoria" className="compact-modal" onClose={onClose}>
      <form onSubmit={handleSubmit} className="compact-modal-form">
        <div className="compact-modal-body">
          <ErrorNotice text={task.error} />

          <div className="form-group">
            <label
              htmlFor="category-name-input"
              className="compact-modal-label"
            >
              NOME DA CATEGORIA
            </label>
            <div className="channel-input-wrapper">
              <input
                id="category-name-input"
                className="channel-input-field"
                type="text"
                required
                maxLength={60}
                placeholder="ex.: TORNEIOS"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
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
            {task.busy ? "Criando..." : "Criar categoria"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
