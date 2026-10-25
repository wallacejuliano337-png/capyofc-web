import { db, supabase } from "../lib/supabase";
import type { MessageAttachment } from "../types";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
];

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `O arquivo "${file.name}" excede o limite máximo de 10 MB.`,
    };
  }

  // Check MIME or extension
  const ext = file.name.split(".").pop()?.toLowerCase();
  const validExts = ["png", "jpg", "jpeg", "webp", "gif", "pdf", "txt"];
  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(file.type);
  const isExtAllowed = ext && validExts.includes(ext);

  if (!isMimeAllowed && !isExtAllowed) {
    return {
      valid: false,
      error: `Formato de arquivo não suportado. Permitidos: PNG, JPG, WEBP, GIF, PDF, TXT.`,
    };
  }

  return { valid: true };
}

export async function uploadAttachment(
  file: File,
  userId: string,
): Promise<MessageAttachment> {
  const check = validateFile(file);
  if (!check.valid) {
    throw new Error(check.error || "Arquivo inválido.");
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const attachmentId = crypto.randomUUID();

  if (!supabase) {
    // Local / demo mode: use base64 data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: attachmentId,
          name: file.name,
          url: reader.result as string,
          size: file.size,
          content_type: file.type || "application/octet-stream",
        });
      };
      reader.onerror = () => reject(new Error("Erro ao ler arquivo local."));
      reader.readAsDataURL(file);
    });
  }

  const path = `${userId}/${Date.now()}_${cleanName}`;
  const { error: uploadError } = await db()
    .storage.from("attachments")
    .upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    // Fallback: If bucket does not exist or storage permission issue, read as data url
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: attachmentId,
          name: file.name,
          url: reader.result as string,
          size: file.size,
          content_type: file.type || "application/octet-stream",
        });
      };
      reader.onerror = () => {
        throw new Error(uploadError.message || "Erro no upload de anexo.");
      };
      reader.readAsDataURL(file);
    });
  }

  const { data: publicUrlData } = db()
    .storage.from("attachments")
    .getPublicUrl(path);

  return {
    id: attachmentId,
    name: file.name,
    url: publicUrlData.publicUrl,
    size: file.size,
    content_type: file.type || "application/octet-stream",
  };
}
