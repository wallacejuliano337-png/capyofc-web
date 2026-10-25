import { supabase, db } from "../lib/supabase";
import { communityAction } from "./communities";

export interface CommunityBan {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url?: string | null;
  reason: string;
  created_at: string;
  banned_by_id: string;
  banned_by_name: string;
}

export function getCommunityBans(communityId: string): CommunityBan[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(`lyc_community_bans_${communityId}`);
      if (raw) return JSON.parse(raw) as CommunityBan[];
    }
  } catch {
    // fallback
  }
  return [];
}

export function saveCommunityBan(communityId: string, ban: CommunityBan): void {
  try {
    if (typeof localStorage !== "undefined") {
      const bans = getCommunityBans(communityId).filter(
        (b) => b.user_id !== ban.user_id,
      );
      bans.unshift(ban);
      localStorage.setItem(
        `lyc_community_bans_${communityId}`,
        JSON.stringify(bans),
      );
    }
  } catch {
    // fallback
  }
}

export async function loadCommunityBans(
  communityId: string,
): Promise<CommunityBan[]> {
  if (supabase) {
    try {
      const { data, error } = await db()
        .from("community_bans")
        .select(
          `
          user_id,
          reason,
          created_at,
          banned_by,
          target_profile:user_id(id, username, display_name, avatar_url),
          banner_profile:banned_by(id, username, display_name)
        `,
        )
        .eq("community_id", communityId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: CommunityBan[] = data.map((row: any) => ({
          user_id: row.user_id,
          display_name: row.target_profile?.display_name || "Membro banido",
          username: row.target_profile?.username || "usuario",
          avatar_url: row.target_profile?.avatar_url || null,
          reason: row.reason || "",
          created_at: row.created_at,
          banned_by_id: row.banned_by,
          banned_by_name: row.banner_profile?.display_name || "Moderador",
        }));

        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(
              `lyc_community_bans_${communityId}`,
              JSON.stringify(mapped),
            );
          }
        } catch {
          // ignore
        }

        return mapped;
      }
    } catch {
      // Fallback to local storage
    }
  }

  return getCommunityBans(communityId);
}

export async function executeCommunityBan(
  communityId: string,
  userId: string,
  reason: string,
): Promise<void> {
  if (supabase) {
    await communityAction("ban_member", {
      community_id: communityId,
      user_id: userId,
      reason,
    });
  }

  // Update local cache
  try {
    if (typeof localStorage !== "undefined") {
      const bans = getCommunityBans(communityId).filter(
        (b) => b.user_id !== userId,
      );
      bans.unshift({
        user_id: userId,
        display_name: "Membro banido",
        username: "usuario",
        reason,
        created_at: new Date().toISOString(),
        banned_by_id: "",
        banned_by_name: "Moderador",
      });
      localStorage.setItem(
        `lyc_community_bans_${communityId}`,
        JSON.stringify(bans),
      );
    }
  } catch {
    // ignore
  }
}

export async function revokeCommunityBan(
  communityId: string,
  userId: string,
): Promise<void> {
  if (supabase) {
    await communityAction("unban_member", {
      community_id: communityId,
      user_id: userId,
    });
  }

  try {
    if (typeof localStorage !== "undefined") {
      const bans = getCommunityBans(communityId).filter(
        (b) => b.user_id !== userId,
      );
      localStorage.setItem(
        `lyc_community_bans_${communityId}`,
        JSON.stringify(bans),
      );
    }
  } catch {
    // fallback
  }
}
