import { db } from "../lib/supabase";
import type { Channel, Profile } from "../types";
export interface Community {
  id: string;
  name: string;
  image_url: string | null;
  owner_id: string;
  is_official: boolean;
  revision: number;
}
export interface Category {
  id: string;
  community_id: string;
  name: string;
  position: number;
  deleted_at: string | null;
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
}
export interface Member {
  user_id: string;
  role_id: string;
  left_at: string | null;
  profiles: Profile;
  community_roles: CommunityRole;
}
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
  return { available: true, items: data };
}
export async function loadCommunity(id: string) {
  const [channels, categories, members, roles, permissions] = await Promise.all(
    [
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
          "user_id,role_id,left_at,profiles!community_members_user_id_fkey(*),community_roles!community_members_community_id_role_id_fkey(*)",
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
    ],
  );
  for (const result of [channels, categories, members, roles, permissions])
    if (result.error) throw result.error;
  return {
    communityId: id,
    channels: channels.data as Channel[],
    categories: categories.data as Category[],
    members: members.data as unknown as Member[],
    roles: (roles.data || []).map(
      ({ community_role_permissions, ...role }) => ({
        ...role,
        permissions: (
          community_role_permissions as { permission: string }[]
        ).map((p) => p.permission),
      }),
    ) as CommunityRole[],
    permissions: permissions.data as string[],
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
  };
}
