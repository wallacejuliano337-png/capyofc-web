import { db } from "../lib/supabase";
import type { Channel, Profile } from "../types";
export interface Community {
  id: string;
  name: string;
  image_url: string | null;
  banner_url?: string | null;
  description?: string;
  tag?: string | null;
  verification_level?: "none" | "low" | "medium" | "high" | "highest";
  content_filter?: "disabled" | "norole" | "all";
  owner_id: string;
  is_official: boolean;
  revision: number;
  is_community?: boolean;
  rules_channel_id?: string | null;
  public_updates_channel_id?: string | null;
}
export interface Category {
  id: string;
  community_id: string;
  name: string;
  position: number;
  deleted_at: string | null;
}
export interface ChannelPermissionOverride {
  id: string;
  community_id: string;
  channel_id: string;
  target_type: "role" | "member";
  role_id: string | null;
  user_id: string | null;
  permission: string;
  state: "allow" | "deny";
  created_at?: string;
}
export interface CategoryPermissionOverride {
  id: string;
  community_id: string;
  category_id: string;
  target_type: "role" | "member";
  role_id: string | null;
  user_id: string | null;
  permission: string;
  state: "allow" | "deny";
  created_at?: string;
}
export const communityPermissionLabels: Record<string, string> = {
  manage_community: "Administrar comunidade",
  manage_channels: "Gerenciar canais",
  manage_roles: "Gerenciar cargos",
  create_invites: "Criar convites",
  send_messages: "Enviar mensagens",
  connect_voice: "Entrar em voz",
  speak: "Falar",
  share_screen: "Compartilhar tela",
  manage_members: "Gerenciar membros",
  moderate_members: "Moderar membros",
};
export const communityAdminPermissions = [
  "manage_community",
  "manage_channels",
  "manage_roles",
  "create_invites",
  "manage_members",
  "moderate_members",
];
export interface CommunityRole {
  permissions?: string[];
  deleted_at?: string | null;
  id: string;
  name: string;
  base_role: string | null;
  position: number;
  color?: string;
  is_default?: boolean;
}
export interface Member {
  user_id: string;
  role_id: string;
  role_ids?: string[];
  joined_at?: string;
  left_at: string | null;
  profiles: Profile;
  community_roles: CommunityRole;
}
export * from "./community-roles";
export async function communityAction<T = unknown>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await db().rpc("community_action", {
    action,
    payload: Object.fromEntries(
      Object.entries(payload).filter(
        ([key, value]) => key !== "id" || value !== "",
      ),
    ),
  });
  if (error) throw error;
  return data as T;
}
export async function loadCommunities(): Promise<{
  available: boolean;
  items: Community[];
}> {
  const { data, error } = await db()
    .from("communities")
    .select("*")
    .order("is_official", { ascending: false })
    .order("created_at");
  if (error && ["PGRST205", "42P01"].includes(error.code))
    return { available: false, items: [] };
  if (error) throw error;
  const items = (data || []).map((c: any) => {
    let localBanner = "";
    let localDesc = "";
    let localTag = "";
    let localVerification: Community["verification_level"] = "low";
    let localContentFilter: Community["content_filter"] = "norole";
    let localIsCommunity = false;
    let localRulesCh = "";
    let localUpdatesCh = "";
    try {
      localBanner = localStorage.getItem(`lyc_community_banner_${c.id}`) || "";
      localDesc = localStorage.getItem(`lyc_community_desc_${c.id}`) || "";
      localTag = localStorage.getItem(`lyc_community_tag_${c.id}`) || "";
      localVerification =
        (localStorage.getItem(
          `lyc_community_verification_level_${c.id}`,
        ) as Community["verification_level"]) || "low";
      localContentFilter =
        (localStorage.getItem(
          `lyc_community_content_filter_${c.id}`,
        ) as Community["content_filter"]) || "norole";
      localIsCommunity = localStorage.getItem(`lyc_community_enabled_${c.id}`) === "true";
      localRulesCh = localStorage.getItem(`lyc_community_rules_ch_${c.id}`) || "";
      localUpdatesCh = localStorage.getItem(`lyc_community_updates_ch_${c.id}`) || "";
    } catch {
      // ignore
    }
    return {
      ...c,
      is_community: c.is_community !== undefined ? Boolean(c.is_community) : localIsCommunity,
      rules_channel_id: c.rules_channel_id || localRulesCh || null,
      public_updates_channel_id: c.public_updates_channel_id || localUpdatesCh || null,
      banner_url: c.banner_url || localBanner || null,
      description: c.description || localDesc || "",
      tag: c.tag || localTag || null,
      verification_level: c.verification_level || localVerification,
      content_filter: c.content_filter || localContentFilter,
    };
  });
  return { available: true, items };
}
export async function loadCommunity(id: string) {
  const [
    channels,
    categories,
    members,
    roles,
    permissions,
    memberRoles,
    channelOverrides,
    categoryOverrides,
  ] = await Promise.all([
    db()
      .from("channels")
      .select("*")
      .eq("community_id", id)
      .is("deleted_at", null)
      .order("position")
      .order("id"),
    db()
      .from("channel_categories")
      .select("*")
      .eq("community_id", id)
      .is("deleted_at", null)
      .order("position")
      .order("id"),
    db()
      .from("community_members")
      .select(
        "user_id,role_id,joined_at,left_at,profiles!community_members_user_id_fkey(*),community_roles!community_members_community_id_role_id_fkey(*)",
      )
      .eq("community_id", id)
      .is("left_at", null)
      .order("joined_at"),
    db()
      .from("community_roles")
      .select("*,community_role_permissions(permission)")
      .is("deleted_at", null)
      .eq("community_id", id)
      .order("position", { ascending: false }),
    db().rpc("my_community_permissions", { community_id: id }),
    db()
      .from("community_member_roles")
      .select("user_id,role_id")
      .eq("community_id", id),
    db()
      .from("channel_permission_overrides")
      .select("*")
      .eq("community_id", id),
    db()
      .from("category_permission_overrides")
      .select("*")
      .eq("community_id", id),
  ]);
  for (const result of [channels, categories, members, roles, permissions])
    if (result.error) throw result.error;

  const memberRoleMap = new Map<string, string[]>();
  if (memberRoles.data) {
    for (const r of memberRoles.data as { user_id: string; role_id: string }[]) {
      const cur = memberRoleMap.get(r.user_id) || [];
      if (!cur.includes(r.role_id)) cur.push(r.role_id);
      memberRoleMap.set(r.user_id, cur);
    }
  }

  const mappedRoles = (roles.data || []).map(
    ({ community_role_permissions, color, is_default, ...role }) => ({
      ...role,
      color:
        color ||
        (role.base_role === "OWNER"
          ? "#f1c40f"
          : role.base_role === "ADMIN"
            ? "#e91e63"
            : role.base_role === "MODERATOR"
              ? "#2ecc71"
              : "#99aab5"),
      is_default: Boolean(is_default || role.base_role === "MEMBER"),
      permissions: (
        community_role_permissions as { permission: string }[]
      ).map((p) => p.permission),
    }),
  ) as CommunityRole[];

  const mappedMembers = (members.data || []).map((m: Record<string, unknown>) => {
    const userId = m.user_id as string;
    const primaryRoleId = m.role_id as string;
    const assignedIds = memberRoleMap.get(userId) || [];
    if (primaryRoleId && !assignedIds.includes(primaryRoleId)) {
      assignedIds.push(primaryRoleId);
    }
    return {
      ...m,
      role_ids: assignedIds,
    };
  }) as unknown as Member[];

  return {
    communityId: id,
    channels: channels.data as Channel[],
    categories: categories.data as Category[],
    members: mappedMembers,
    roles: mappedRoles,
    permissions: permissions.data as string[],
    channelOverrides: (channelOverrides.data || []) as ChannelPermissionOverride[],
    categoryOverrides: (categoryOverrides.data || []) as CategoryPermissionOverride[],
  };
}
export function inviteCode(value: string) {
  const trimmed = value.trim();
  if (/^[a-f0-9]{32}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("invite");
    if (code && /^[a-f0-9]{32}$/.test(code)) return code;
  } catch {
    /* Input may be a plain code. */
  }
  throw new Error("Informe um código de convite válido.");
}

// Rolling deployment compatibility: active chat/voice stay available until the
// additive community migration exists. This path reads existing database rows.
export async function loadLegacyCommunity() {
  const [channels, profiles] = await Promise.all([
    db().from("channels").select("*").order("position"),
    db().from("profiles").select("*").order("display_name"),
  ]);
  if (channels.error) throw channels.error;
  if (profiles.error) throw profiles.error;
  return {
    communityId: undefined,
    channels: channels.data.map((c) => ({ ...c, category_id: c.category })),
    categories: [...new Set(channels.data.map((c) => String(c.category)))].map(
      (name, i) => ({
        id: name,
        community_id: "",
        name,
        position: i,
        deleted_at: null,
      }),
    ),
    members: profiles.data.map((p) => ({
      user_id: p.id,
      role_id: p.role,
      left_at: null,
      profiles: p,
      community_roles: {
        id: p.role,
        name: p.role,
        base_role: p.role,
        position: 0,
      },
    })) as Member[],
    roles: [] as CommunityRole[],
    permissions: [] as string[],
    channelOverrides: [] as ChannelPermissionOverride[],
    categoryOverrides: [] as CategoryPermissionOverride[],
  };
}

export function isPresenceOnline(
  presence: { status?: string | null; expires_at?: string | null } | null | undefined,
  now: number = Date.now()
): boolean {
  if (!presence) return false;
  if (presence.status !== "online") return false;
  if (typeof presence.expires_at !== "string") return false;
  const parsed = Date.parse(presence.expires_at);
  if (!Number.isFinite(parsed)) return false;
  return parsed > now;
}

export async function fetchCommunityStats(communityId: string): Promise<{ totalMembers: number; onlineMembers: number }> {
  try {
    const { data: memberRows, count, error } = await db()
      .from("community_members")
      .select("user_id", { count: "exact" })
      .eq("community_id", communityId)
      .is("left_at", null);

    if (error || !memberRows) {
      return { totalMembers: count ?? 0, onlineMembers: 0 };
    }

    const totalMembers = count ?? memberRows.length;
    const userIds = memberRows.map((m) => m.user_id);
    if (userIds.length === 0) return { totalMembers: 0, onlineMembers: 0 };

    const { data: presenceRows, error: presError } = await db()
      .from("user_presence")
      .select("user_id, status, expires_at")
      .in("user_id", userIds)
      .eq("status", "online");

    if (presError || !presenceRows) {
      return { totalMembers, onlineMembers: 0 };
    }

    const now = Date.now();
    const onlineMembers = presenceRows.filter((p) => isPresenceOnline(p, now)).length;

    return { totalMembers, onlineMembers };
  } catch {
    return { totalMembers: 0, onlineMembers: 0 };
  }
}

