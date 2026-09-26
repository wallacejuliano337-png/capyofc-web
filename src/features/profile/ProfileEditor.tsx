import { useEffect, useRef, useState } from "react";
import type { Profile } from "../../types";
import { ProfileCard, type ProfileAppearance } from "./ProfileCard";
import {
  PROFILE_MEDIA_ACCEPT,
  validateProfileMedia,
} from "../../services/profile-media";
import { ErrorNotice, useTask } from "../../components/ui";
export interface ProfileDraft {
  displayName: string;
  appearance: ProfileAppearance;
  avatar: File | null | undefined;
  banner: File | null | undefined;
}
function useFilePreview(
  file: File | null | undefined,
  persisted: string | null,
) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return file === undefined ? persisted : file === null ? null : url;
}
export function ProfileEditor({
  profile,
  appearance,
  presence,
  onSave,
  unavailable,
}: {
  profile: Profile;
  appearance: ProfileAppearance;
  presence: string;
  onSave: (
    draft: ProfileDraft,
  ) => Promise<{ profile: Profile; warning: string }>;
  unavailable?: string;
}) {
  const [name, setName] = useState(profile.display_name);
  const [draft, setDraft] = useState(appearance);
  const [avatar, setAvatar] = useState<File | null>();
  const [banner, setBanner] = useState<File | null>();
  const avatarInput = useRef<HTMLInputElement>(null),
    bannerInput = useRef<HTMLInputElement>(null);
  const task = useTask();
  const avatarUrl = useFilePreview(avatar, profile.avatar_url),
    bannerUrl = useFilePreview(banner, appearance.banner);
  const [notice, setNotice] = useState("");
  const reset = () => {
    setName(profile.display_name);
    setDraft(appearance);
    setAvatar(undefined);
    setBanner(undefined);
    setNotice("");
  };
  const dirty =
    name !== profile.display_name ||
    JSON.stringify(draft) !== JSON.stringify(appearance) ||
    avatar !== undefined ||
    banner !== undefined;
  const choose = (file: File | undefined, set: (file: File) => void) => {
    if (file)
      void task.run(async () => {
        await validateProfileMedia(file);
        const decoded = await createImageBitmap(file);
        decoded.close();
        set(file);
        setNotice("");
      });
  };
  return (
    <div className="profile-editor">
      <h2>Perfil</h2>
      <p className="muted">
        Personalize seu perfil. Confira a prévia antes de salvar.
      </p>
      {unavailable && <p className="notice">{unavailable}</p>}
      <ErrorNotice text={task.error} />
      {notice && <p role="status">{notice}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            const result = await onSave({
              displayName: name.trim(),
              appearance: draft,
              avatar,
              banner,
            });
            setName(result.profile.display_name);
            setDraft({ ...draft, banner: result.profile.banner_url ?? null });
            setAvatar(undefined);
            setBanner(undefined);
            setNotice(result.warning || "Alterações salvas.");
          });
        }}
      >
        <fieldset disabled={task.busy} className="profile-editor-layout">
          <div className="profile-editor-controls">
            <h3>Avatar</h3>
            <div className="profile-editor-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Prévia do avatar" />
              ) : (
                <span>{name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <input
              hidden
              ref={avatarInput}
              type="file"
              accept={PROFILE_MEDIA_ACCEPT}
              onChange={(e) => {
                choose(e.target.files?.[0], setAvatar);
                e.target.value = "";
              }}
              aria-label="Escolher avatar"
            />
            <div className="profile-editor-buttons">
              <button
                type="button"
                className="secondary"
                onClick={() => avatarInput.current?.click()}
              >
                Alterar avatar
              </button>
              <button
                type="button"
                onClick={() => setAvatar(null)}
                disabled={!avatarUrl}
              >
                Remover avatar
              </button>
            </div>
            <h3>Banner do perfil</h3>
            <div
              className="profile-editor-banner"
              style={{
                background: `linear-gradient(120deg,${draft.primary},${draft.secondary})`,
              }}
            >
              {bannerUrl && <img src={bannerUrl} alt="Prévia do banner" />}
            </div>
            <input
              hidden
              ref={bannerInput}
              type="file"
              accept={PROFILE_MEDIA_ACCEPT}
              onChange={(e) => {
                choose(e.target.files?.[0], setBanner);
                e.target.value = "";
              }}
              aria-label="Escolher banner"
            />
            <div className="profile-editor-buttons">
              <button
                type="button"
                className="secondary"
                onClick={() => bannerInput.current?.click()}
              >
                Alterar banner
              </button>
              <button
                type="button"
                disabled={!bannerUrl}
                onClick={() => setBanner(null)}
              >
                Remover banner
              </button>
            </div>
            <p className="settings-hint">
              PNG, JPG, WEBP ou GIF · até 5 MB. GIFs mantêm a animação.
            </p>
            <h3>Tema do perfil</h3>
            <div className="profile-color-fields">
              {(
                [
                  ["primary", "Cor principal"],
                  ["secondary", "Cor secundária"],
                  ["accent", "Cor de destaque"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="color"
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <div
              className="profile-theme-sample"
              style={{
                background: `linear-gradient(120deg,${draft.primary},${draft.secondary})`,
              }}
            />
            <label>
              Nome de exibição
              <input
                required
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Bio
              <textarea
                maxLength={500}
                rows={4}
                value={draft.bio}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              />
              <small>{draft.bio.length}/500</small>
            </label>
            <p className="settings-hint">
              Seu status é o mesmo definido no menu de presença.
            </p>
          </div>
          <div className="profile-editor-preview">
            <span className="profile-preview-label">PRÉVIA DO PERFIL</span>
            <ProfileCard
              profile={{
                ...profile,
                display_name: name,
                avatar_url: avatarUrl,
              }}
              appearance={{ ...draft, banner: bannerUrl }}
              presence={presence}
            />
          </div>
        </fieldset>
        <div className="profile-editor-savebar">
          <span>
            {dirty
              ? "Você tem alterações não salvas."
              : "Seu perfil está atualizado."}
          </span>
          <button
            type="button"
            className="secondary"
            disabled={task.busy || !dirty}
            onClick={reset}
          >
            Descartar
          </button>
          <button
            className="primary"
            disabled={task.busy || !dirty || !!unavailable}
          >
            Salvar alterações
          </button>
        </div>
      </form>
    </div>
  );
}
