import { describe, it, expect } from "vitest";
import {
  getMemberRoles,
  getHighestRole,
  getDisplayRoleColor,
  getEffectivePermissions,
  hasPermission,
  canManageRole,
  canManageTargetMember,
  canAssignRoleToMember,
  canRemoveRoleFromMember,
  PERMISSION_GROUPS,
  ALL_PERMISSION_KEYS,
} from "../src/services/community-roles";
import type { Community, CommunityRole, Member } from "../src/services/communities";

const mockCommunity: Community = {
  id: "comm-1",
  name: "LYC Arena Official",
  image_url: null,
  owner_id: "user-owner",
  is_official: true,
  revision: 1,
};

const roleEveryone: CommunityRole = {
  id: "role-everyone",
  name: "@todos",
  base_role: "MEMBER",
  position: 0,
  color: "#99aab5",
  is_default: true,
  permissions: ["view_channels", "send_messages", "connect_voice", "speak"],
};

const roleVIP: CommunityRole = {
  id: "role-vip",
  name: "VIP",
  base_role: null,
  position: 25,
  color: "#f1c40f",
  permissions: ["embed_links", "attach_files", "add_reactions"],
};

const roleMod: CommunityRole = {
  id: "role-mod",
  name: "Moderador",
  base_role: "MODERATOR",
  position: 50,
  color: "#2ecc71",
  permissions: [
    "manage_roles",
    "kick_members",
    "mute_members",
    "manage_messages",
  ],
};

const roleAdmin: CommunityRole = {
  id: "role-admin",
  name: "Administrador",
  base_role: "ADMIN",
  position: 90,
  color: "#e91e63",
  permissions: ["administrator"],
};

const allRoles = [roleAdmin, roleMod, roleVIP, roleEveryone];

const memberUser: Member = {
  user_id: "user-normal",
  role_id: "role-everyone",
  role_ids: ["role-everyone"],
  left_at: null,
  profiles: {
    id: "user-normal",
    username: "user_normal",
    display_name: "Normal User",
    avatar_url: null,
    status: "online",
    role: "MEMBER",
    created_at: "2026-01-01T00:00:00Z",
  },
  community_roles: roleEveryone,
};

const memberVIP: Member = {
  user_id: "user-vip",
  role_id: "role-vip",
  role_ids: ["role-vip"],
  left_at: null,
  profiles: {
    id: "user-vip",
    username: "user_vip",
    display_name: "VIP User",
    avatar_url: null,
    status: "online",
    role: "MEMBER",
    created_at: "2026-01-01T00:00:00Z",
  },
  community_roles: roleVIP,
};

const memberMod: Member = {
  user_id: "user-mod",
  role_id: "role-mod",
  role_ids: ["role-mod", "role-vip"],
  left_at: null,
  profiles: {
    id: "user-mod",
    username: "user_mod",
    display_name: "Mod User",
    avatar_url: null,
    status: "online",
    role: "MEMBER",
    created_at: "2026-01-01T00:00:00Z",
  },
  community_roles: roleMod,
};

const memberOwner: Member = {
  user_id: "user-owner",
  role_id: "role-admin",
  role_ids: ["role-admin"],
  left_at: null,
  profiles: {
    id: "user-owner",
    username: "user_owner",
    display_name: "Owner User",
    avatar_url: null,
    status: "online",
    role: "MEMBER",
    created_at: "2026-01-01T00:00:00Z",
  },
  community_roles: roleAdmin,
};

describe("Community Roles Frontend Helpers", () => {
  it("carrega todos os grupos de permissão e suas chaves", () => {
    expect(PERMISSION_GROUPS).toHaveLength(5);
    expect(ALL_PERMISSION_KEYS).toContain("view_channels");
    expect(ALL_PERMISSION_KEYS).toContain("kick_members");
    expect(ALL_PERMISSION_KEYS).toContain("embed_links");
    expect(ALL_PERMISSION_KEYS).toContain("video");
    expect(ALL_PERMISSION_KEYS).toContain("administrator");
  });

  it("calcula getHighestRole e getDisplayRoleColor corretamente", () => {
    // Membro normal só tem @todos -> cor #99aab5
    expect(getHighestRole(memberUser, allRoles)?.name).toBe("@todos");
    expect(getDisplayRoleColor(memberUser, allRoles)).toBe("#99aab5");

    // VIP -> cor #f1c40f
    expect(getHighestRole(memberVIP, allRoles)?.name).toBe("VIP");
    expect(getDisplayRoleColor(memberVIP, allRoles)).toBe("#f1c40f");

    // Mod que tem [role-mod, role-vip] -> seu maior cargo é Moderador (pos 50), cor #2ecc71
    expect(getHighestRole(memberMod, allRoles)?.name).toBe("Moderador");
    expect(getDisplayRoleColor(memberMod, allRoles)).toBe("#2ecc71");
  });

  it("calcula getEffectivePermissions herdando @todos e união de múltiplos cargos", () => {
    // Normal herda permissões de @todos
    const normalPerms = getEffectivePermissions(memberUser, mockCommunity, allRoles);
    expect(normalPerms.has("send_messages")).toBe(true);
    expect(normalPerms.has("view_channels")).toBe(true);
    expect(normalPerms.has("kick_members")).toBe(false);

    // VIP herda @todos + VIP
    const vipPerms = getEffectivePermissions(memberVIP, mockCommunity, allRoles);
    expect(vipPerms.has("send_messages")).toBe(true);
    expect(vipPerms.has("embed_links")).toBe(true);
    expect(vipPerms.has("attach_files")).toBe(true);
    expect(vipPerms.has("kick_members")).toBe(false);

    // Mod tem permissões de @todos + VIP + Mod
    const modPerms = getEffectivePermissions(memberMod, mockCommunity, allRoles);
    expect(modPerms.has("send_messages")).toBe(true);
    expect(modPerms.has("embed_links")).toBe(true);
    expect(modPerms.has("kick_members")).toBe(true);
    expect(modPerms.has("manage_roles")).toBe(true);
    expect(modPerms.has("ban_members")).toBe(false);

    // Owner tem todas as permissões
    const ownerPerms = getEffectivePermissions(memberOwner, mockCommunity, allRoles);
    expect(ownerPerms.has("ban_members")).toBe(true);
    expect(ownerPerms.has("administrator")).toBe(true);
  });

  it("valida canManageRole respeitando hierarquia", () => {
    // Owner pode gerenciar qualquer cargo (exceto role OWNER)
    expect(canManageRole(memberOwner, roleMod, mockCommunity, allRoles)).toBe(true);
    expect(canManageRole(memberOwner, roleVIP, mockCommunity, allRoles)).toBe(true);

    // Mod (pos 50) pode gerenciar VIP (pos 25)
    expect(canManageRole(memberMod, roleVIP, mockCommunity, allRoles)).toBe(true);

    // Mod (pos 50) NÃO pode gerenciar seu próprio cargo ou Admin (pos 90)
    expect(canManageRole(memberMod, roleMod, mockCommunity, allRoles)).toBe(false);
    expect(canManageRole(memberMod, roleAdmin, mockCommunity, allRoles)).toBe(false);

    // Normal não pode gerenciar nenhum cargo
    expect(canManageRole(memberUser, roleVIP, mockCommunity, allRoles)).toBe(false);
  });

  it("valida canAssignRoleToMember e canRemoveRoleFromMember", () => {
    // Owner pode atribuir VIP a qualquer membro
    expect(
      canAssignRoleToMember(memberOwner, memberUser, roleVIP, mockCommunity, allRoles),
    ).toBe(true);

    // Mod pode atribuir VIP (pos 25 < pos 50) para membro normal (pos 0 < pos 50)
    expect(
      canAssignRoleToMember(memberMod, memberUser, roleVIP, mockCommunity, allRoles),
    ).toBe(true);

    // Mod NÃO pode atribuir cargo a si mesmo
    expect(
      canAssignRoleToMember(memberMod, memberMod, roleVIP, mockCommunity, allRoles),
    ).toBe(false);

    // Mod NÃO pode atribuir Admin para outro membro
    expect(
      canAssignRoleToMember(memberMod, memberUser, roleAdmin, mockCommunity, allRoles),
    ).toBe(false);

    // Mod pode remover VIP do membro
    expect(
      canRemoveRoleFromMember(memberMod, memberVIP, roleVIP, mockCommunity, allRoles),
    ).toBe(true);

    // Membro normal não pode atribuir nem remover nada
    expect(
      canAssignRoleToMember(memberUser, memberVIP, roleVIP, mockCommunity, allRoles),
    ).toBe(false);
  });

  it("valida getMemberRoles, hasPermission e canManageTargetMember", () => {
    // getMemberRoles
    const modRoles = getMemberRoles(memberMod, allRoles);
    expect(modRoles.length).toBe(2);
    expect(modRoles[0].id).toBe("role-mod");

    // hasPermission
    expect(hasPermission(memberMod, mockCommunity, allRoles, "kick_members")).toBe(true);
    expect(hasPermission(memberUser, mockCommunity, allRoles, "kick_members")).toBe(false);
    expect(hasPermission(memberOwner, mockCommunity, allRoles, "administrator")).toBe(true);

    // canManageTargetMember
    expect(canManageTargetMember(memberMod, memberUser, mockCommunity, allRoles)).toBe(true);
    expect(canManageTargetMember(memberMod, memberOwner, mockCommunity, allRoles)).toBe(false);
    expect(canManageTargetMember(memberUser, memberVIP, mockCommunity, allRoles)).toBe(false);
  });
});
