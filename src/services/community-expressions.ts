import { db, supabase } from "../lib/supabase";

export type ExpressionKind = "emoji" | "sticker" | "sound";

export interface CommunityExpression {
  id: string;
  community_id: string;
  kind: ExpressionKind;
  name: string;
  file_url: string;
  file_path?: string;
  description?: string;
  duration?: number; // In seconds (for soundboard)
  created_by: string;
  creator_name?: string;
  created_at: string;
}

export const EXPRESSION_LIMITS: Record<ExpressionKind, number> = {
  emoji: 50,
  sticker: 30,
  sound: 24,
};

export const EXPRESSION_SIZE_LIMITS: Record<ExpressionKind, number> = {
  emoji: 5 * 1024 * 1024, // 5 MB
  sticker: 5 * 1024 * 1024, // 5 MB
  sound: 3 * 1024 * 1024, // 3 MB
};

export const SOUND_MAX_DURATION = 10; // 10 seconds

export const EMOJI_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const STICKER_ACCEPT = "image/png,image/webp,image/gif";
export const SOUND_ACCEPT = "audio/mpeg,audio/ogg,audio/wav,audio/mp3";

const STORAGE_PREFIX = "lyc_community_expressions_";

/**
 * Validates an emoji name. Must be 2-32 chars, letters, numbers, and underscores.
 */
export function validateEmojiName(name: string): string | null {
  const clean = name.replace(/^:|:$/g, "").trim();
  if (clean.length < 2) {
    return "O nome do emoji deve ter no mínimo 2 caracteres.";
  }
  if (clean.length > 32) {
    return "O nome do emoji deve ter no máximo 32 caracteres.";
  }
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
    return "O nome do emoji deve conter apenas letras, números e sublinhados (ex: :lyc_trofeu:).";
  }
  return null;
}

/**
 * Formats an emoji name to always have leading and trailing colons (e.g., :lyc:).
 */
export function formatEmojiName(name: string): string {
  const clean = name.replace(/^:+|:+$/g, "").trim().toLowerCase();
  return `:${clean}:`;
}

/**
 * Validates a sticker name. Must be 2-32 characters.
 */
export function validateStickerName(name: string): string | null {
  const clean = name.trim();
  if (clean.length < 2) {
    return "O nome da figurinha deve ter no mínimo 2 caracteres.";
  }
  if (clean.length > 32) {
    return "O nome da figurinha deve ter no máximo 32 caracteres.";
  }
  return null;
}

/**
 * Validates a sound name. Must be 2-32 characters.
 */
export function validateSoundName(name: string): string | null {
  const clean = name.trim();
  if (clean.length < 2) {
    return "O nome do efeito sonoro deve ter no mínimo 2 caracteres.";
  }
  if (clean.length > 32) {
    return "O nome do efeito sonoro deve ter no máximo 32 caracteres.";
  }
  return null;
}

/**
 * Validates a file for the given expression kind.
 */
export async function validateExpressionFile(
  kind: ExpressionKind,
  file: File,
): Promise<{ duration?: number }> {
  const sizeLimit = EXPRESSION_SIZE_LIMITS[kind];
  if (!file.size || file.size > sizeLimit) {
    const limitMB = Math.round(sizeLimit / (1024 * 1024));
    throw new Error(
      `O arquivo excede o limite máximo permitido de ${limitMB} MB.`,
    );
  }

  if (kind === "emoji") {
    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      throw new Error(
        "Formato inválido para emoji. Escolha PNG, JPG, WEBP ou GIF.",
      );
    }
    return {};
  }

  if (kind === "sticker") {
    const validTypes = ["image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      throw new Error(
        "Formato inválido para figurinha. Escolha PNG, WEBP ou GIF.",
      );
    }
    return {};
  }

  if (kind === "sound") {
    const validTypes = [
      "audio/mpeg",
      "audio/ogg",
      "audio/wav",
      "audio/mp3",
      "audio/x-wav",
    ];
    const ext = file.name.split(".").pop()?.toLowerCase();
    const validExts = ["mp3", "ogg", "wav"];
    if (!validTypes.includes(file.type) && !validExts.includes(ext || "")) {
      throw new Error(
        "Formato inválido para efeito sonoro. Escolha MP3, OGG ou WAV.",
      );
    }

    if (typeof Audio !== "undefined") {
      try {
        const duration = await getAudioDuration(file);
        if (duration > SOUND_MAX_DURATION) {
          throw new Error(
            `A duração máxima do efeito sonoro é de ${SOUND_MAX_DURATION} segundos (o arquivo possui ${duration.toFixed(1)}s).`,
          );
        }
        return { duration: Math.round(duration * 10) / 10 };
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("duração máxima")) {
          throw err;
        }
        // Non-blocking fallback if browser Audio API fails
        return {};
      }
    }
  }

  return {};
}

/**
 * Gets audio duration from a File object.
 */
export function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.src = url;
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível carregar a prévia do áudio."));
      };
    } catch (e) {
      reject(e);
    }
  });
}

const memoryStore: Record<string, CommunityExpression[]> = {};

function getLocalStore(communityId: string): CommunityExpression[] {
  if (memoryStore[communityId]) return memoryStore[communityId];
  try {
    if (typeof localStorage !== "undefined") {
      const data = localStorage.getItem(`${STORAGE_PREFIX}${communityId}`);
      if (data) {
        const parsed = JSON.parse(data);
        memoryStore[communityId] = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function setLocalStore(
  communityId: string,
  expressions: CommunityExpression[],
): void {
  memoryStore[communityId] = expressions;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        `${STORAGE_PREFIX}${communityId}`,
        JSON.stringify(expressions),
      );
    }
  } catch {
    // ignore
  }
}

export function clearExpressionsMemoryStore(): void {
  for (const k of Object.keys(memoryStore)) {
    delete memoryStore[k];
  }
}

/**
 * Uploads an expression asset file.
 */
export async function uploadExpressionFile(
  userId: string,
  communityId: string,
  kind: ExpressionKind,
  file: File,
): Promise<{ url: string; path: string }> {
  await validateExpressionFile(kind, file);

  const ext =
    file.name.split(".").pop()?.toLowerCase() ||
    (kind === "sound" ? "mp3" : "png");
  const uniqueId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const path = `${userId}/expressions/${communityId}/${kind}-${uniqueId}.${ext}`;

  if (supabase && userId !== "local-user") {
    const { error } = await db().storage.from("avatars").upload(path, file, {
      contentType: file.type || (kind === "sound" ? "audio/mpeg" : "image/png"),
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      throw new Error(`Falha no upload do arquivo: ${error.message}`);
    }

    const { data } = db().storage.from("avatars").getPublicUrl(path);
    return {
      url: data.publicUrl,
      path,
    };
  }

  // Local / Demo mode fallback
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new Error("Erro ao ler o arquivo localmente."));
    reader.readAsDataURL(file);
  });

  return {
    url: dataUrl,
    path: `local-${kind}-${uniqueId}`,
  };
}

/**
 * Loads all expressions for a community.
 */
export async function loadCommunityExpressions(
  communityId: string,
  kind?: ExpressionKind,
): Promise<CommunityExpression[]> {
  const localList = getLocalStore(communityId);

  // If Supabase is connected, attempt to fetch from community_expressions table
  if (supabase) {
    try {
      let query = db()
        .from("community_expressions")
        .select("*")
        .eq("community_id", communityId)
        .order("created_at", { ascending: false });

      if (kind) {
        query = query.eq("kind", kind);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        return data as CommunityExpression[];
      }
    } catch {
      // Fallback to local storage
    }
  }

  if (kind) {
    return localList.filter((item) => item.kind === kind);
  }
  return localList;
}

/**
 * Creates and saves a new community expression.
 */
export async function createCommunityExpression(
  communityId: string,
  data: {
    kind: ExpressionKind;
    name: string;
    file_url: string;
    file_path?: string;
    description?: string;
    duration?: number;
    created_by: string;
    creator_name?: string;
  },
): Promise<CommunityExpression> {
  const currentList = getLocalStore(communityId);
  const kindList = currentList.filter((item) => item.kind === data.kind);

  if (kindList.length >= EXPRESSION_LIMITS[data.kind]) {
    throw new Error(
      `Limite de ${EXPRESSION_LIMITS[data.kind]} ${data.kind === "emoji" ? "emojis" : data.kind === "sticker" ? "figurinhas" : "efeitos sonoros"} atingido para esta comunidade.`,
    );
  }

  // Verify unique name per kind
  const normalizedName =
    data.kind === "emoji" ? formatEmojiName(data.name) : data.name.trim();

  if (
    kindList.some(
      (item) => item.name.toLowerCase() === normalizedName.toLowerCase(),
    )
  ) {
    throw new Error(
      `Já existe um ${data.kind === "emoji" ? "emoji" : data.kind === "sticker" ? "uma figurinha" : "um efeito sonoro"} com o nome "${normalizedName}".`,
    );
  }

  const newExpression: CommunityExpression = {
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    community_id: communityId,
    kind: data.kind,
    name: normalizedName,
    file_url: data.file_url,
    file_path: data.file_path,
    description: data.description?.trim() || "",
    duration: data.duration,
    created_by: data.created_by,
    creator_name: data.creator_name || "Membro",
    created_at: new Date().toISOString(),
  };

  const updatedList = [newExpression, ...currentList];
  setLocalStore(communityId, updatedList);

  if (supabase) {
    try {
      await db().from("community_expressions").insert({
        community_id: communityId,
        kind: newExpression.kind,
        name: newExpression.name,
        file_url: newExpression.file_url,
        file_path: newExpression.file_path,
        description: newExpression.description,
        duration: newExpression.duration,
        created_by: newExpression.created_by,
      });
    } catch {
      // Fallback already saved locally
    }
  }

  return newExpression;
}

/**
 * Updates an existing community expression.
 */
export async function updateCommunityExpression(
  communityId: string,
  id: string,
  patch: {
    name?: string;
    description?: string;
  },
): Promise<CommunityExpression> {
  const currentList = getLocalStore(communityId);
  const target = currentList.find((item) => item.id === id);
  if (!target) {
    throw new Error("Item não encontrado.");
  }

  let newName = target.name;
  if (patch.name !== undefined) {
    const formatted =
      target.kind === "emoji" ? formatEmojiName(patch.name) : patch.name.trim();
    // Check collision if changed
    if (
      formatted.toLowerCase() !== target.name.toLowerCase() &&
      currentList.some(
        (item) =>
          item.id !== id &&
          item.kind === target.kind &&
          item.name.toLowerCase() === formatted.toLowerCase(),
      )
    ) {
      throw new Error(`Já existe outro item com o nome "${formatted}".`);
    }
    newName = formatted;
  }

  const updatedItem: CommunityExpression = {
    ...target,
    name: newName,
    description:
      patch.description !== undefined
        ? patch.description.trim()
        : target.description,
  };

  const updatedList = currentList.map((item) =>
    item.id === id ? updatedItem : item,
  );
  setLocalStore(communityId, updatedList);

  if (supabase) {
    try {
      await db().from("community_expressions").update({
        name: updatedItem.name,
        description: updatedItem.description,
      }).eq("id", id);
    } catch {
      // Local copy updated
    }
  }

  return updatedItem;
}

/**
 * Deletes a community expression.
 */
export async function deleteCommunityExpression(
  communityId: string,
  id: string,
): Promise<boolean> {
  const currentList = getLocalStore(communityId);
  const target = currentList.find((item) => item.id === id);
  if (!target) return false;

  const updatedList = currentList.filter((item) => item.id !== id);
  setLocalStore(communityId, updatedList);

  // Best-effort cleanup of storage object
  if (
    supabase &&
    target.file_path &&
    !target.file_path.startsWith("local-") &&
    !target.file_path.startsWith("data:")
  ) {
    try {
      await db().storage.from("avatars").remove([target.file_path]);
    } catch {
      // non-blocking
    }
  }

  if (supabase) {
    try {
      await db().from("community_expressions").delete().eq("id", id);
    } catch {
      // Local copy already deleted
    }
  }

  return true;
}
