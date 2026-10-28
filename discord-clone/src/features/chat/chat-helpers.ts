import type { Reaction } from "../../types";

export interface GroupedReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export function groupReactions(
  reactions: Reaction[] = [],
  currentUserId?: string,
): GroupedReaction[] {
  const map = new Map<string, { count: number; reactedByMe: boolean }>();
  for (const r of reactions) {
    const existing = map.get(r.emoji) || { count: 0, reactedByMe: false };
    existing.count += 1;
    if (r.user_id === currentUserId) {
      existing.reactedByMe = true;
    }
    map.set(r.emoji, existing);
  }
  return Array.from(map.entries()).map(([emoji, val]) => ({
    emoji,
    count: val.count,
    reactedByMe: val.reactedByMe,
  }));
}

export function isDifferentDay(d1: string, d2?: string): boolean {
  if (!d2) return true;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getFullYear() !== date2.getFullYear() ||
    date1.getMonth() !== date2.getMonth() ||
    date1.getDate() !== date2.getDate()
  );
}

export function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return "Hoje";
  }

  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return "Ontem";
  }

  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
