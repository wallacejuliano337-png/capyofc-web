import { createClient } from "@supabase/supabase-js";

export const DEFAULT_SUPABASE_URL = "https://tfjkinffnksmiqatdhnb.supabase.co";
export const DEFAULT_SUPABASE_KEY = "sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q";

export const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  DEFAULT_SUPABASE_URL;

export const supabaseKey =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
  DEFAULT_SUPABASE_KEY;

export const configured = Boolean(supabaseUrl && supabaseKey);

export const supabase = configured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: typeof window !== "undefined",
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
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
