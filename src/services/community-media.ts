import { db, supabase } from "../lib/supabase";
import { validateProfileMedia, PROFILE_MEDIA_LIMIT } from "./profile-media";

export const COMMUNITY_MEDIA_LIMIT = PROFILE_MEDIA_LIMIT; // 5 MB
export const COMMUNITY_MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const COMMUNITY_NAME_MAX_LENGTH = 60;
export const COMMUNITY_DESC_MAX_LENGTH = 300;

export interface CommunityMediaUploadResult {
  url: string;
  path: string;
}

/**
 * Validates a community name according to database constraints and UX standards.
 * Length must be between 1 and 60 characters after trim.
 */
export function validateCommunityName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "O nome da comunidade não pode ficar em branco.";
  }
  if (trimmed.length > COMMUNITY_NAME_MAX_LENGTH) {
    return `O nome da comunidade deve ter no máximo ${COMMUNITY_NAME_MAX_LENGTH} caracteres.`;
  }
  return null;
}

/**
 * Validates a community description. Maximum 300 characters.
 */
export function validateCommunityDescription(description: string): string | null {
  if (description.length > COMMUNITY_DESC_MAX_LENGTH) {
    return `A descrição deve ter no máximo ${COMMUNITY_DESC_MAX_LENGTH} caracteres.`;
  }
  return null;
}

/**
 * Checks if a user has permission to manage the community profile.
 */
export function canManageCommunity(
  communityOwnerId: string,
  userId?: string,
  permissions: string[] = [],
): boolean {
  if (!userId) return false;
  if (communityOwnerId === userId) return true;
  return permissions.includes("manage_community");
}

/**
 * Converts a file to a base64 Data URL (used for local/demo mode or preview).
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo localmente."));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a community icon or banner securely to the existing 'avatars' bucket.
 * Respects storage RLS by prefixing the path with the authenticated user ID:
 * `${userId}/community-${communityId}-${kind}-${uuid}.${ext}`
 */
export async function uploadCommunityMedia(
  userId: string,
  communityId: string,
  kind: "icon" | "banner",
  file: File,
): Promise<CommunityMediaUploadResult> {
  await validateProfileMedia(file);

  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1] || "png";
  const uniqueId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const path = `${userId}/community-${communityId}-${kind}-${uniqueId}.${ext}`;

  if (supabase && userId !== "local-user") {
    const { error } = await db().storage.from("avatars").upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      throw new Error(`Falha no upload da imagem: ${error.message}`);
    }

    const { data: publicUrlData } = db().storage.from("avatars").getPublicUrl(path);
    return {
      url: publicUrlData.publicUrl,
      path,
    };
  }

  // Demo / local mode fallback
  const dataUrl = await readFileAsDataUrl(file);
  return {
    url: dataUrl,
    path,
  };
}

/**
 * Best-effort cleanup for old or superseded community files from the storage bucket.
 */
export async function cleanupCommunityMedia(path?: string | null): Promise<void> {
  if (!path || !supabase || path.startsWith("local-") || path.startsWith("data:")) return;
  try {
    await db().storage.from("avatars").remove([path]);
  } catch {
    // Non-blocking cleanup
  }
}
