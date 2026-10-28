import { useEffect, useRef, useState } from "react";
import type { Profile } from "../../types";
import { Avatar, ErrorNotice, Modal, useTask } from "../../components/ui";
import { useAvatarUrl } from "../../hooks/useAvatar";
import {
  validateAvatar,
  uploadAvatar,
  removeAvatar,
} from "../../services/avatars";
export function AvatarEditor({
  profile,
  onSave,
  onClose,
}: {
  profile: Profile;
  onSave: (p: Profile) => void;
  onClose: () => void;
}) {
  const current = useAvatarUrl(profile.id, profile.avatar_url);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [warning, setWarning] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const task = useTask();
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const save = (remove = false) =>
    void task.run(async () => {
      const result = remove
        ? await removeAvatar(profile.id)
        : await uploadAvatar(profile.id, file!);
      onSave({ ...profile, avatar_url: result.url });
      setFile(null);
      if (result.warning) setWarning(result.warning);
      else onClose();
    });
  return (
    <Modal
      title="Foto de perfil"
      onClose={() => {
        if (!task.busy) onClose();
      }}
    >
      <div className="avatar-editor">
        <Avatar
          name={profile.display_name}
          url={preview || current}
          size={96}
        />
        <p>{file ? "Prévia da nova foto" : "Sua foto de perfil"}</p>
        <p className="muted">PNG, JPG, WEBP ou GIF · até 5 MB</p>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label="Selecionar foto de perfil"
          disabled={task.busy}
          onChange={(e) => {
            const candidate = e.target.files?.[0];
            e.target.value = "";
            if (!candidate) return;
            void task.run(async () => {
              validateAvatar(candidate);
              const decoded = await createImageBitmap(candidate);
              decoded.close();
              setFile(candidate);
              setWarning("");
            });
          }}
        />
        <ErrorNotice text={task.error} />
        {warning && <p className="notice">{warning}</p>}
        <div className="avatar-editor-actions">
          <button
            className="secondary"
            disabled={task.busy}
            onClick={() => input.current?.click()}
          >
            Alterar foto de perfil
          </button>
          {current && (
            <button
              className="danger"
              disabled={task.busy}
              onClick={() => save(true)}
            >
              Remover foto
            </button>
          )}
          <button className="secondary" disabled={task.busy} onClick={onClose}>
            Cancelar
          </button>
          <button
            className="primary"
            disabled={!file || task.busy}
            onClick={() => save()}
          >
            Salvar foto
          </button>
        </div>
      </div>
    </Modal>
  );
}
