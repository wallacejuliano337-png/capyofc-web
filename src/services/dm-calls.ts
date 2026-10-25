import { db } from "../lib/supabase";

export type CallType = "voice" | "video";
export type CallStatus =
  | "idle"
  | "calling"
  | "ringing"
  | "connecting"
  | "connected"
  | "declined"
  | "missed"
  | "ended"
  | "failed";

export interface DMCall {
  id: string;
  conversation_id: string;
  caller_id: string;
  receiver_id: string;
  call_type: CallType;
  status: CallStatus;
  room_name: string;
  duration_seconds: number;
  started_at: string;
  connected_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function callAction<T = unknown>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await db().rpc("call_action", { action, payload });
  if (error) throw error;
  return data as T;
}

export async function startCall(
  conversationId: string,
  callType: CallType = "voice",
): Promise<DMCall> {
  return await callAction<DMCall>("start_call", {
    conversation_id: conversationId,
    call_type: callType,
  });
}

export async function answerCall(callId: string): Promise<DMCall> {
  return await callAction<DMCall>("answer_call", {
    call_id: callId,
  });
}

export async function declineCall(callId: string): Promise<void> {
  await callAction<boolean>("decline_call", {
    call_id: callId,
  });
}

export async function endCall(callId: string): Promise<void> {
  await callAction<boolean>("end_call", {
    call_id: callId,
  });
}

export async function missCall(callId: string): Promise<void> {
  await callAction<boolean>("miss_call", {
    call_id: callId,
  });
}

export async function getActiveCall(): Promise<DMCall | null> {
  return await callAction<DMCall | null>("get_active_call", {});
}

export async function getConversationCalls(
  conversationId: string,
): Promise<DMCall[]> {
  const { data, error } = await db()
    .from("dm_calls")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data || []) as DMCall[];
}

export function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return `${mm}:${ss}`;
}
