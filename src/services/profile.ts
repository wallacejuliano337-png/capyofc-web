import { db } from "../lib/supabase";
import type { Profile } from "../types";
import type { ProfileDraft } from "../features/profile/ProfileEditor";
import {
  defaultAppearance,
  type ProfileAppearance,
} from "../features/profile/ProfileCard";
import { publishAvatar } from "../hooks/useAvatar";
import {
  assertProfileOwner,
  cleanupProfileFiles,
  ownedAvatarPath,
  stageProfileImage,
} from "./avatars";
import { validateProfileMedia } from "./profile-media";
export function profileAppearance(profile: Profile): ProfileAppearance {
  return {
    banner: profile.banner_url ?? null,
    bio: profile.bio ?? "",
    primary: profile.profile_primary_color ?? defaultAppearance.primary,
    secondary: profile.profile_secondary_color ?? defaultAppearance.secondary,
    accent: profile.profile_accent_color ?? defaultAppearance.accent,
  };
}
export async function saveProfile(profile: Profile, draft: ProfileDraft) {
  const displayName = draft.displayName.trim();
  if (!displayName || displayName.length > 40)
    throw new Error("O nome deve ter entre 1 e 40 caracteres.");
  if (draft.appearance.bio.length > 500)
    throw new Error("A bio deve ter até 500 caracteres.");
  for (const color of [
    draft.appearance.primary,
    draft.appearance.secondary,
    draft.appearance.accent,
  ])
    if (!/^#[0-9a-f]{6}$/i.test(color))
      throw new Error("Escolha uma cor válida.");
  for (const file of [draft.avatar, draft.banner])
    if (file) await validateProfileMedia(file);
  await assertProfileOwner(profile.id);
  await cleanupProfileFiles(profile.id);
  let avatar = profile.avatar_url,
    banner = profile.banner_url ?? null;
  const staged: string[] = [];
  const stage = async (file: File) => {
    const image = await stageProfileImage(profile.id, file);
    staged.push(image.path);
    return image.url;
  };
  try {
    if (draft.avatar !== undefined)
      avatar = draft.avatar === null ? null : await stage(draft.avatar);
    if (draft.banner !== undefined)
      banner = draft.banner === null ? null : await stage(draft.banner);
    const changes = {
      display_name: displayName,
      avatar_url: avatar,
      banner_url: banner,
      bio: draft.appearance.bio,
      profile_primary_color: draft.appearance.primary,
      profile_secondary_color: draft.appearance.secondary,
      profile_accent_color: draft.appearance.accent,
    };
    let query = db().from("profiles").update(changes).eq("id", profile.id);
    const before = profileAppearance(profile);
    // Optimistic comparison also protects against the existing avatar editor in another session.
    const expected = {
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      banner_url: before.banner,
      bio: before.bio,
      profile_primary_color: before.primary,
      profile_secondary_color: before.secondary,
      profile_accent_color: before.accent,
    };
    for (const [field, value] of Object.entries(expected))
      query = value === null ? query.is(field, null) : query.eq(field, value);
    const { data, error } = await query.select("*").single();
    if (error || !data)
      throw new Error(
        error?.code === "PGRST116"
          ? "Seu perfil mudou em outra sessão. Feche e abra Configurações antes de tentar novamente."
          : error?.message || "Não foi possível salvar o perfil.",
      );
    publishAvatar(profile.id, data.avatar_url);
    if (avatar !== profile.avatar_url)
      await cleanupProfileFiles(
        profile.id,
        ownedAvatarPath(profile.avatar_url, profile.id),
      );
    const warning = await cleanupProfileFiles(
      profile.id,
      banner !== before.banner
        ? ownedAvatarPath(before.banner, profile.id)
        : null,
    );
    return { profile: data as Profile, warning };
  } catch (error) {
    for (const path of staged) await cleanupProfileFiles(profile.id, path);
    await cleanupProfileFiles(profile.id);
    throw error;
  }
}
