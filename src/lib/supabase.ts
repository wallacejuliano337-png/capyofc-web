import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
export function db() {
  if (!supabase)
    throw new Error("Configure o Supabase para utilizar este recurso.");
  return supabase;
}
export function messageOf(error: unknown) {
  if (!error) return "Não foi possível concluir. Tente novamente.";
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error);
  if (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("TypeError")
  ) {
    return "Falha temporária de conexão com o servidor. Verifique sua conexão.";
  }
  return msg || "Não foi possível concluir. Tente novamente.";
}
