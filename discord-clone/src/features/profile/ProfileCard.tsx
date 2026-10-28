import type { Profile } from "../../types";
import { normalizeUsername, presenceLabels } from "../../services/social";
import "./profile-editor.css";
export interface ProfileAppearance {
  banner: string | null;
  bio: string;
  primary: string;
  secondary: string;
  accent: string;
}
export const defaultAppearance: ProfileAppearance = {
  banner: null,
  bio: "",
  primary: "#142744",
  secondary: "#30204c",
  accent: "#7588f5",
};
export function ProfileCard({
  profile,
  appearance,
  presence = "offline",
}: {
  profile: Pick<
    Profile,
    "display_name" | "username" | "avatar_url" | "created_at"
  >;
  appearance: ProfileAppearance;
  presence?: string;
}) {
  const color = (value: string, fallback: string) =>
    /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  const joined = new Date(profile.created_at);
  return (
    <article
      className="lyc-profile-card"
      style={{ borderColor: color(appearance.accent, "#7588f5") + "55" }}
    >
      <div
        className="lyc-profile-banner"
        style={{
          background: `linear-gradient(120deg, ${color(appearance.primary, "#142744")}, ${color(appearance.secondary, "#30204c")})`,
        }}
      >
        {appearance.banner && (
          <img src={appearance.banner} alt="Banner do perfil" />
        )}
      </div>
      <div className="lyc-profile-card-body min-w-0">
        <div className="lyc-profile-avatar flex-shrink-0">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar do perfil" />
          ) : (
            <span>{profile.display_name.slice(0, 2).toUpperCase()}</span>
          )}
          <i className={"presence-dot presence-" + presence} />
        </div>
        <h3 className="break-words min-w-0 [overflow-wrap:anywhere]">{profile.display_name || "Seu nome"}</h3>
        <p className="lyc-profile-handle break-all min-w-0 [overflow-wrap:anywhere]">@{normalizeUsername(profile.username, profile.display_name)}</p>
        <p className="lyc-profile-status min-w-0 truncate">
          {presenceLabels[presence] || presenceLabels.offline}
        </p>
        {appearance.bio && (
          <>
            <h4>Sobre mim</h4>
            <p className="lyc-profile-bio break-words min-w-0 [overflow-wrap:anywhere]">{appearance.bio}</p>
          </>
        )}
        {!Number.isNaN(joined.getTime()) && (
          <>
            <h4>Membro desde</h4>
            <p className="lyc-profile-date">
              {joined.toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </>
        )}
      </div>
    </article>
  );
}
