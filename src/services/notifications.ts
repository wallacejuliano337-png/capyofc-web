import { db, supabase } from "../lib/supabase";

export interface UserNotificationSettings {
  user_id: string;
  desktop_enabled: boolean;
  sounds_enabled: boolean;
  dms_enabled: boolean;
  mentions_enabled: boolean;
  calls_enabled: boolean;
}

export type CommunityNotificationLevel = "all" | "mentions" | "nothing";
export type ChannelNotificationLevel = "default" | "all" | "mentions" | "nothing";

export interface ChannelUnreadState {
  channel_id: string;
  unread_count: number;
  mention_count: number;
  last_message_id: string | null;
  last_read_message_id: string | null;
  last_read_at: string | null;
}

export interface CommunityUnreadSummary {
  community_id: string;
  has_unreads: boolean;
  mention_count: number;
}

const DEFAULT_USER_SETTINGS: Omit<UserNotificationSettings, "user_id"> = {
  desktop_enabled: true,
  sounds_enabled: true,
  dms_enabled: true,
  mentions_enabled: true,
  calls_enabled: true,
};

/**
 * Loads user notification settings from Supabase with localStorage cache fallback
 */
export async function loadUserNotificationSettings(
  userId: string,
): Promise<UserNotificationSettings> {
  const localKey = `lyc_notif_settings_${userId}`;
  let cached: UserNotificationSettings | null = null;
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) cached = JSON.parse(raw);
  } catch {
    // ignore
  }

  if (!supabase) {
    return cached || { user_id: userId, ...DEFAULT_USER_SETTINGS };
  }

  try {
    const { data, error } = await db()
      .from("user_notification_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    if (data) {
      const settings: UserNotificationSettings = {
        user_id: data.user_id,
        desktop_enabled: Boolean(data.desktop_enabled),
        sounds_enabled: Boolean(data.sounds_enabled),
        dms_enabled: Boolean(data.dms_enabled),
        mentions_enabled: Boolean(data.mentions_enabled),
        calls_enabled: Boolean(data.calls_enabled),
      };
      try {
        localStorage.setItem(localKey, JSON.stringify(settings));
      } catch {
        // ignore
      }
      return settings;
    }
  } catch {
    // fallback to cache or defaults
  }

  return cached || { user_id: userId, ...DEFAULT_USER_SETTINGS };
}

/**
 * Saves user notification settings to database and local cache
 */
export async function saveUserNotificationSettings(
  settings: UserNotificationSettings,
): Promise<void> {
  const localKey = `lyc_notif_settings_${settings.user_id}`;
  try {
    localStorage.setItem(localKey, JSON.stringify(settings));
  } catch {
    // ignore
  }

  if (!supabase) return;

  const { error } = await db()
    .from("user_notification_settings")
    .upsert(
      {
        user_id: settings.user_id,
        desktop_enabled: settings.desktop_enabled,
        sounds_enabled: settings.sounds_enabled,
        dms_enabled: settings.dms_enabled,
        mentions_enabled: settings.mentions_enabled,
        calls_enabled: settings.calls_enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) throw error;
}

/**
 * Loads community-level notification preference ('all' | 'mentions' | 'nothing')
 */
export async function loadCommunityNotificationLevel(
  communityId: string,
  userId: string,
): Promise<CommunityNotificationLevel> {
  const localKey = `lyc_comm_notif_${communityId}_${userId}`;
  try {
    const raw = localStorage.getItem(localKey) as CommunityNotificationLevel;
    if (raw && ["all", "mentions", "nothing"].includes(raw)) return raw;
  } catch {
    // ignore
  }

  if (!supabase) return "all";

  try {
    const { data } = await db()
      .from("community_notification_settings")
      .select("level")
      .eq("community_id", communityId)
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.level) {
      try {
        localStorage.setItem(localKey, data.level);
      } catch {
        // ignore
      }
      return data.level as CommunityNotificationLevel;
    }
  } catch {
    // ignore
  }

  return "all";
}

/**
 * Saves community-level notification preference
 */
export async function saveCommunityNotificationLevel(
  communityId: string,
  userId: string,
  level: CommunityNotificationLevel,
): Promise<void> {
  const localKey = `lyc_comm_notif_${communityId}_${userId}`;
  try {
    localStorage.setItem(localKey, level);
  } catch {
    // ignore
  }

  if (!supabase) return;

  const { error } = await db()
    .from("community_notification_settings")
    .upsert(
      {
        community_id: communityId,
        user_id: userId,
        level,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "community_id,user_id" },
    );

  if (error) throw error;
}

/**
 * Loads channel-level notification preference ('default' | 'all' | 'mentions' | 'nothing')
 */
export async function loadChannelNotificationLevel(
  channelId: string,
  userId: string,
): Promise<ChannelNotificationLevel> {
  const localKey = `lyc_chan_notif_${channelId}_${userId}`;
  try {
    const raw = localStorage.getItem(localKey) as ChannelNotificationLevel;
    if (raw && ["default", "all", "mentions", "nothing"].includes(raw)) return raw;
  } catch {
    // ignore
  }

  if (!supabase) return "default";

  try {
    const { data } = await db()
      .from("channel_notification_settings")
      .select("level")
      .eq("channel_id", channelId)
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.level) {
      try {
        localStorage.setItem(localKey, data.level);
      } catch {
        // ignore
      }
      return data.level as ChannelNotificationLevel;
    }
  } catch {
    // ignore
  }

  return "default";
}

/**
 * Saves channel-level notification preference
 */
export async function saveChannelNotificationLevel(
  channelId: string,
  userId: string,
  level: ChannelNotificationLevel,
): Promise<void> {
  const localKey = `lyc_chan_notif_${channelId}_${userId}`;
  try {
    localStorage.setItem(localKey, level);
  } catch {
    // ignore
  }

  if (!supabase) return;

  const { error } = await db()
    .from("channel_notification_settings")
    .upsert(
      {
        channel_id: channelId,
        user_id: userId,
        level,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id,user_id" },
    );

  if (error) throw error;
}

/**
 * Marks a channel as read up to a specific message or current timestamp
 */
export async function markChannelRead(
  channelId: string,
  messageId?: string,
): Promise<void> {
  if (!supabase) {
    try {
      localStorage.setItem(
        `lyc_chan_read_${channelId}`,
        JSON.stringify({ last_read_at: new Date().toISOString(), message_id: messageId || null }),
      );
    } catch {
      // ignore
    }
    return;
  }

  try {
    const { error } = await db().rpc("mark_channel_read", {
      p_channel_id: channelId,
      p_message_id: messageId || null,
    });
    if (error) {
      // Fallback direct upsert if RPC not present in test/local
      const uid = (await db().auth.getUser()).data.user?.id;
      if (uid) {
        await db().from("channel_reads").upsert({
          channel_id: channelId,
          user_id: uid,
          last_read_message_id: messageId || null,
          last_read_at: new Date().toISOString(),
        });
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Fetches unread message & mention counts for all channels in a community in a single query
 */
export async function fetchCommunityUnreads(
  communityId: string,
): Promise<Record<string, ChannelUnreadState>> {
  if (!supabase) return {};

  try {
    const { data, error } = await db().rpc("get_community_unreads", {
      p_community_id: communityId,
    });
    if (error) throw error;

    const result: Record<string, ChannelUnreadState> = {};
    for (const row of data || []) {
      result[row.channel_id] = {
        channel_id: row.channel_id,
        unread_count: Number(row.unread_count || 0),
        mention_count: Number(row.mention_count || 0),
        last_message_id: row.last_message_id || null,
        last_read_message_id: row.last_read_message_id || null,
        last_read_at: row.last_read_at || null,
      };
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Fetches unread indicator & mention summary for all communities for the server rail
 */
export async function fetchAllCommunitiesUnreads(): Promise<
  Record<string, CommunityUnreadSummary>
> {
  if (!supabase) return {};

  try {
    const { data, error } = await db().rpc("get_all_communities_unreads");
    if (error) throw error;

    const result: Record<string, CommunityUnreadSummary> = {};
    for (const row of data || []) {
      result[row.community_id] = {
        community_id: row.community_id,
        has_unreads: Boolean(row.has_unreads),
        mention_count: Number(row.mention_count || 0),
      };
    }
    return result;
  } catch {
    return {};
  }
}

export interface NotificationEvaluationParams {
  type: "channel_message" | "dm_message" | "call";
  authorId: string;
  currentUserId: string;
  isMention?: boolean;
  isWindowFocused: boolean;
  isViewingTarget: boolean;
  userSettings: UserNotificationSettings;
  communityLevel?: CommunityNotificationLevel;
  channelLevel?: ChannelNotificationLevel;
  presenceStatus?: string;
}

export interface NotificationDecision {
  shouldShowDesktop: boolean;
  shouldPlaySound: boolean;
  soundType: "message" | "mention" | "call" | null;
}

/**
 * Pure function to evaluate notification and sound triggering rules
 */
export function evaluateNotificationAction(
  params: NotificationEvaluationParams,
): NotificationDecision {
  // Rule 1: Never notify self
  if (params.authorId === params.currentUserId) {
    return { shouldShowDesktop: false, shouldPlaySound: false, soundType: null };
  }

  // Rule 2: Presence DND / busy suppresses sounds and desktop notifications
  const isDnd = params.presenceStatus === "busy" || params.presenceStatus === "dnd";
  if (isDnd) {
    return { shouldShowDesktop: false, shouldPlaySound: false, soundType: null };
  }

  // Rule 3: Channel and Community mute levels
  let effectiveLevel: "all" | "mentions" | "nothing" = params.communityLevel || "all";
  if (params.channelLevel && params.channelLevel !== "default") {
    effectiveLevel = params.channelLevel;
  }

  if (params.type === "channel_message") {
    if (effectiveLevel === "nothing") {
      return { shouldShowDesktop: false, shouldPlaySound: false, soundType: null };
    }
    if (effectiveLevel === "mentions" && !params.isMention) {
      return { shouldShowDesktop: false, shouldPlaySound: false, soundType: null };
    }
  }

  // Rule 4: If window is focused AND user is looking at that exact target:
  // Normal messages do NOT notify or beep. Mentions can beep if enabled.
  if (params.isWindowFocused && params.isViewingTarget) {
    if (params.isMention && params.userSettings.mentions_enabled && params.userSettings.sounds_enabled) {
      return { shouldShowDesktop: false, shouldPlaySound: true, soundType: "mention" };
    }
    return { shouldShowDesktop: false, shouldPlaySound: false, soundType: null };
  }

  // Rule 5: User Master Switches
  if (params.type === "call") {
    const allowDesktop = params.userSettings.desktop_enabled && params.userSettings.calls_enabled;
    const allowSound = params.userSettings.sounds_enabled && params.userSettings.calls_enabled;
    return {
      shouldShowDesktop: allowDesktop,
      shouldPlaySound: allowSound,
      soundType: allowSound ? "call" : null,
    };
  }

  if (params.type === "dm_message") {
    if (!params.userSettings.dms_enabled) {
      return { shouldShowDesktop: false, shouldPlaySound: false, soundType: null };
    }
    const allowDesktop = params.userSettings.desktop_enabled;
    const allowSound = params.userSettings.sounds_enabled;
    return {
      shouldShowDesktop: allowDesktop,
      shouldPlaySound: allowSound,
      soundType: allowSound ? "message" : null,
    };
  }

  // Channel message
  if (params.isMention) {
    if (!params.userSettings.mentions_enabled) {
      return { shouldShowDesktop: false, shouldPlaySound: false, soundType: null };
    }
    const allowDesktop = params.userSettings.desktop_enabled;
    const allowSound = params.userSettings.sounds_enabled;
    return {
      shouldShowDesktop: allowDesktop,
      shouldPlaySound: allowSound,
      soundType: allowSound ? "mention" : null,
    };
  }

  // Normal channel message
  const allowDesktop = params.userSettings.desktop_enabled;
  const allowSound = params.userSettings.sounds_enabled;
  return {
    shouldShowDesktop: allowDesktop,
    shouldPlaySound: allowSound,
    soundType: allowSound ? "message" : null,
  };
}
