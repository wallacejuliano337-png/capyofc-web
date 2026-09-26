import { validateProfileMedia } from "./profile-media";
import { db } from "../lib/supabase";
import { publishAvatar } from "../hooks/useAvatar";
export const AVATAR_LIMIT = 5 * 1024 * 1024;
export const AVATAR_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
export function validateAvatar(file: Pick<File, "type" | "size">) {
  if (!AVATAR_TYPES.includes(file.type))
    throw new Error("Escolha uma imagem PNG, JPG, WEBP ou GIF.");
  if (!file.size || file.size > AVATAR_LIMIT)
    throw new Error("A imagem deve ter até 5 MB e não pode estar vazia.");
}
export function ownedAvatarPath(url: string | null, id: string): string | null {
  if (!url) return null;
  const base = db().storage.from("avatars").getPublicUrl("").data.publicUrl;
  if (!url.startsWith(base)) return null;
  const path = url.slice(base.length).split("?")[0];
  return path.startsWith(id + "/") && path.split("/").length === 2
    ? path
    : null;
}
export async function assertProfileOwner(id: string) {
  const { data, error } = await db().auth.getUser();
  if (error || data.user?.id !== id)
    throw new Error("Entre na sua conta para alterar sua foto.");
}
export function queueProfileCleanup(id: string, path: string) {
  const key = "lyc-avatar-cleanup:" + id;
  let pending: string[] = [];
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(value))
      pending = value.filter((x) => typeof x === "string");
  } catch {
    /* Recover a malformed local queue. */
  }
  if (!pending.includes(path)) pending.push(path);
  localStorage.setItem(key, JSON.stringify(pending));
  const times = JSON.parse(localStorage.getItem(key + ":times") || "{}");
  times[path] ??= Date.now();
  localStorage.setItem(key + ":times", JSON.stringify(times));
}
export async function cleanupProfileFiles(id: string, path?: string | null) {
  try {
    if (path) queueProfileCleanup(id, path);
    const key = "lyc-avatar-cleanup:" + id;
    const pending: string[] = JSON.parse(localStorage.getItem(key) || "[]");
    const times: Record<string, number> = JSON.parse(
      localStorage.getItem(key + ":times") || "{}",
    );
    const { data, error } = await db()
      .from("profiles")
      .select("avatar_url,banner_url")
      .eq("id", id)
      .single();
    if (error) throw error;
    const inUse = [
      ownedAvatarPath(data.avatar_url, id),
      ownedAvatarPath(data.banner_url, id),
    ];
    for (const item of [...pending]) {
      if (
        !item.startsWith(id + "/") ||
        item.split("/").length !== 2 ||
        inUse.includes(item)
      ) {
        pending.splice(pending.indexOf(item), 1);
        continue;
      }
      if (
        item !== path &&
        times[item] &&
        Date.now() - times[item] < 15 * 60 * 1000
      )
        continue;
      const { error } = await db().storage.from("avatars").remove([item]);
      if (!error) pending.splice(pending.indexOf(item), 1);
    }
    for (const item of Object.keys(times))
      if (!pending.includes(item)) delete times[item];
    localStorage.setItem(key + ":times", JSON.stringify(times));
    localStorage.setItem(key, JSON.stringify(pending));
    return pending.length
      ? "Perfil salvo. A limpeza de arquivos anteriores será tentada na próxima alteração."
      : "";
  } catch {
    return "A limpeza de arquivos será tentada na próxima alteração.";
  }
}
export async function stageProfileImage(id: string, file: File) {
  await validateProfileMedia(file);
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = id + "/" + crypto.randomUUID() + "." + ext;
  // Register before uploading, so interrupted saves can clean their orphan on retry.
  queueProfileCleanup(id, path);
  const { error } = await db().storage.from("avatars").upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return {
    path,
    url: db().storage.from("avatars").getPublicUrl(path).data.publicUrl,
  };
}
async function currentAvatar(id: string) {
  const { data, error } = await db()
    .from("profiles")
    .select("avatar_url")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data.avatar_url as string | null;
}
async function link(id: string, previous: string | null, next: string | null) {
  let query = db().from("profiles").update({ avatar_url: next }).eq("id", id);
  query =
    previous === null
      ? query.is("avatar_url", null)
      : query.eq("avatar_url", previous);
  const { data, error } = await query.select("id").single();
  if (error || !data)
    throw new Error("O perfil mudou em outra sessão. Tente novamente.");
  publishAvatar(id, next);
}
export async function uploadAvatar(id: string, file: File) {
  validateAvatar(file);
  await assertProfileOwner(id);
  const previous = await currentAvatar(id);
  const { path, url } = await stageProfileImage(id, file);
  try {
    await link(id, previous, url);
  } catch (error) {
    await cleanupProfileFiles(id, path);
    throw error;
  }
  return {
    url,
    warning: await cleanupProfileFiles(id, ownedAvatarPath(previous, id)),
  };
}
export async function removeAvatar(id: string) {
  await assertProfileOwner(id);
  const previous = await currentAvatar(id);
  await link(id, previous, null);
  return {
    url: null,
    warning: await cleanupProfileFiles(id, ownedAvatarPath(previous, id)),
  };
}
