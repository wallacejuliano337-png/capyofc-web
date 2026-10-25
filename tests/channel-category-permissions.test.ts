import { describe, it, expect } from "vitest";
import {
  hasChannelPermission,
  resolveChannelPermissions,
} from "../src/services/channel-permissions";
import type { Channel } from "../src/types";
import type {
  Community,
  CommunityRole,
  ChannelPermissionOverride,
  CategoryPermissionOverride,
} from "../src/services/communities";

describe("LYC Arena — Sistema Real de Cargos e Permissões — Fase 2 (Regressão A–J)", () => {
  const community: Community = {
    id: "comm-alpha",
    name: "LYC Arena",
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

  const roleStaff: CommunityRole = {
    id: "role-staff",
    name: "TESTE STAFF",
    base_role: null,
    position: 80,
    color: "#3498db",
    permissions: ["view_channels", "send_messages", "manage_messages"],
  };

  const roleAdmin: CommunityRole = {
    id: "role-admin",
    name: "Admin",
    base_role: "ADMIN",
    position: 90,
    color: "#e91e63",
    permissions: ["administrator"],
  };

  const baseChannel: Channel = {
    id: "chan-1",
    community_id: community.id,
    category_id: "cat-1",
    name: "geral",
    category: "Canais",
    kind: "text",
    description: "",
    team_id: null,
    sync_permissions: true,
  };

  // Case A: Proprietário possui acesso irrestrito total, mesmo com NEGAR explícito
  it("Caso A: Proprietário possui bypass total sobre qualquer NEGAR de canal e categoria", () => {
    const channelWithDenies: ChannelPermissionOverride[] = [
      {
        id: "ov-1",
        community_id: community.id,
        channel_id: baseChannel.id,
        target_type: "member",
        user_id: "user-owner",
        role_id: null,
        permission: "view_channels",
        state: "deny",
      },
      {
        id: "ov-2",
        community_id: community.id,
        channel_id: baseChannel.id,
        target_type: "role",
        role_id: roleEveryone.id,
        user_id: null,
        permission: "send_messages",
        state: "deny",
      },
    ];

    const canView = hasChannelPermission("view_channels", {
      userId: "user-owner",
      community,
      channel: baseChannel,
      memberRoles: [roleEveryone],
      channelOverrides: channelWithDenies,
      categoryOverrides: [],
    });

    const canSend = hasChannelPermission("send_messages", {
      userId: "user-owner",
      community,
      channel: baseChannel,
      memberRoles: [roleEveryone],
      channelOverrides: channelWithDenies,
      categoryOverrides: [],
    });

    expect(canView).toBe(true);
    expect(canSend).toBe(true);
  });

  // Case B: Administrador possui bypass total sobre qualquer NEGAR
  it("Caso B: Cargo com 'administrator' bypassa todos os bloqueios de canal e categoria", () => {
    const channelWithDenies: ChannelPermissionOverride[] = [
      {
        id: "ov-1",
        community_id: community.id,
        channel_id: baseChannel.id,
        target_type: "role",
        role_id: roleAdmin.id,
        user_id: null,
        permission: "send_messages",
        state: "deny",
      },
      {
        id: "ov-2",
        community_id: community.id,
        channel_id: baseChannel.id,
        target_type: "member",
        user_id: "user-admin",
        role_id: null,
        permission: "view_channels",
        state: "deny",
      },
    ];

    const canView = hasChannelPermission("view_channels", {
      userId: "user-admin",
      community,
      channel: baseChannel,
      memberRoles: [roleEveryone, roleAdmin],
      channelOverrides: channelWithDenies,
      categoryOverrides: [],
    });

    expect(canView).toBe(true);
  });

  // Case C: Override específico de membro no canal tem precedência sobre override de cargo no canal
  it("Caso C: Override de membro no canal tem precedência sobre override de cargo", () => {
    // Cenário 1: Cargo tem NEGAR, mas membro específico tem PERMITIR
    const overrides1: ChannelPermissionOverride[] = [
      {
        id: "ov-1",
        community_id: community.id,
        channel_id: baseChannel.id,
        target_type: "role",
        role_id: roleStaff.id,
        user_id: null,
        permission: "send_messages",
        state: "deny",
      },
      {
        id: "ov-2",
        community_id: community.id,
        channel_id: baseChannel.id,
        target_type: "member",
        user_id: "user-naori",
        role_id: null,
        permission: "send_messages",
        state: "allow",
      },
    ];

    const allowed = hasChannelPermission("send_messages", {
      userId: "user-naori",
      community,
      channel: baseChannel,
      memberRoles: [roleEveryone, roleStaff],
      channelOverrides: overrides1,
      categoryOverrides: [],
    });
    expect(allowed).toBe(true);

    // Cenário 2: Cargo tem PERMITIR, mas membro específico tem NEGAR
    const overrides2: ChannelPermissionOverride[] = [
      {
        id: "ov-3",
        community_id: community.id,
        channel_id: baseChannel.id,
        target_type: "role",
        role_id: roleStaff.id,
        user_id: null,
        permission: "send_messages",
        state: "allow",
      },
      {
        id: "ov-4",
        community_id: community.id,
        channel_id: baseChannel.id,
        target_type: "member",
        user_id: "user-naori",
        role_id: null,
        permission: "send_messages",
        state: "deny",
      },
    ];

    const denied = hasChannelPermission("send_messages", {
      userId: "user-naori",
      community,
      channel: baseChannel,
      memberRoles: [roleEveryone, roleStaff],
      channelOverrides: overrides2,
      categoryOverrides: [],
    });
    expect(denied).toBe(false);
  });

  // Case D: Override de cargo no canal tem precedência sobre @todos no canal
  it("Caso D: Override de cargo atribuído tem precedência sobre @todos no canal", () => {
    // Canal privado onde @todos tem NEGAR view_channels, mas TESTE STAFF tem PERMITIR
    const privateChannelOverrides: ChannelPermissionOverride[] = [
      {
        id: "ov-1",
        community_id: community.id,
        channel_id: baseChannel.id,
        target_type: "role",
        role_id: roleEveryone.id,
        user_id: null,
        permission: "view_channels",
        state: "deny",
      },
      {
        id: "ov-2",
        community_id: community.id,
        channel_id: baseChannel.id,
        target_type: "role",
        role_id: roleStaff.id,
        user_id: null,
        permission: "view_channels",
        state: "allow",
      },
    ];

    // Membro comum (só @todos) -> BLOQUEADO
    const memberRegular = hasChannelPermission("view_channels", {
      userId: "user-regular",
      community,
      channel: baseChannel,
      memberRoles: [roleEveryone],
      channelOverrides: privateChannelOverrides,
      categoryOverrides: [],
    });
    expect(memberRegular).toBe(false);

    // Membro com TESTE STAFF -> PERMITIDO
    const memberStaff = hasChannelPermission("view_channels", {
      userId: "user-staff",
      community,
      channel: baseChannel,
      memberRoles: [roleEveryone, roleStaff],
      channelOverrides: privateChannelOverrides,
      categoryOverrides: [],
    });
    expect(memberStaff).toBe(true);
  });

  // Case E: Override explícito de canal tem precedência sobre overrides de categoria
  it("Caso E: Override no canal prevalece sobre o que estiver configurado na categoria", () => {
    // Categoria dá PERMITIR send_messages, mas o canal tem override NEGAR send_messages para @todos
    const catOverrides: CategoryPermissionOverride[] = [
      {
        id: "cat-ov-1",
        community_id: community.id,
        category_id: "cat-1",
        target_type: "role",
        role_id: roleEveryone.id,
        user_id: null,
        permission: "send_messages",
        state: "allow",
      },
    ];

    const chanOverrides: ChannelPermissionOverride[] = [
      {
        id: "ch-ov-1",
        community_id: community.id,
        channel_id: baseChannel.id,
        target_type: "role",
        role_id: roleEveryone.id,
        user_id: null,
        permission: "send_messages",
        state: "deny",
      },
    ];

    const result = hasChannelPermission("send_messages", {
      userId: "user-regular",
      community,
      channel: baseChannel,
      memberRoles: [roleEveryone],
      channelOverrides: chanOverrides,
      categoryOverrides: catOverrides,
    });
    // Prevalece o deny do canal
    expect(result).toBe(false);
  });

  // Case F: Override de membro na categoria tem precedência sobre cargos na categoria
  it("Caso F: Override de membro na categoria tem precedência sobre cargo na categoria", () => {
    const catOverrides: CategoryPermissionOverride[] = [
      {
        id: "cat-ov-1",
        community_id: community.id,
        category_id: "cat-1",
        target_type: "role",
        role_id: roleStaff.id,
        user_id: null,
        permission: "send_messages",
        state: "deny",
      },
      {
        id: "cat-ov-2",
        community_id: community.id,
        category_id: "cat-1",
        target_type: "member",
        user_id: "user-naori",
        role_id: null,
        permission: "send_messages",
        state: "allow",
      },
    ];

    const result = hasChannelPermission("send_messages", {
      userId: "user-naori",
      community,
      channel: baseChannel, // sem overrides de canal
      memberRoles: [roleEveryone, roleStaff],
      channelOverrides: [],
      categoryOverrides: catOverrides,
    });
    expect(result).toBe(true);
  });

  // Case G: Override de cargo na categoria tem precedência sobre @todos na categoria
  it("Caso G: Override de cargo na categoria prevalece sobre @todos na categoria", () => {
    const catOverrides: CategoryPermissionOverride[] = [
      {
        id: "cat-ov-1",
        community_id: community.id,
        category_id: "cat-1",
        target_type: "role",
        role_id: roleEveryone.id,
        user_id: null,
        permission: "view_channels",
        state: "deny",
      },
      {
        id: "cat-ov-2",
        community_id: community.id,
        category_id: "cat-1",
        target_type: "role",
        role_id: roleStaff.id,
        user_id: null,
        permission: "view_channels",
        state: "allow",
      },
    ];

    const staffAllowed = hasChannelPermission("view_channels", {
      userId: "user-staff",
      community,
      channel: baseChannel,
      memberRoles: [roleEveryone, roleStaff],
      channelOverrides: [],
      categoryOverrides: catOverrides,
    });
    expect(staffAllowed).toBe(true);

    const regularBlocked = hasChannelPermission("view_channels", {
      userId: "user-regular",
      community,
      channel: baseChannel,
      memberRoles: [roleEveryone],
      channelOverrides: [],
      categoryOverrides: catOverrides,
    });
    expect(regularBlocked).toBe(false);
  });

  // Case H: Herança da Categoria com sync_permissions = true
  it("Caso H: Canal sincronizado (sync_permissions = true) herda permissões da categoria", () => {
    const syncedChannel: Channel = {
      ...baseChannel,
      sync_permissions: true,
    };

    const catOverrides: CategoryPermissionOverride[] = [
      {
        id: "cat-ov-1",
        community_id: community.id,
        category_id: "cat-1",
        target_type: "role",
        role_id: roleEveryone.id,
        user_id: null,
        permission: "send_messages",
        state: "deny",
      },
    ];

    const result = hasChannelPermission("send_messages", {
      userId: "user-regular",
      community,
      channel: syncedChannel,
      memberRoles: [roleEveryone],
      channelOverrides: [],
      categoryOverrides: catOverrides,
    });
    expect(result).toBe(false);
  });

  // Case I: Canal dessincronizado (sync_permissions = false) NÃO herda da categoria
  it("Caso I: Canal dessincronizado (sync_permissions = false) NÃO herda overrides da categoria", () => {
    const desyncedChannel: Channel = {
      ...baseChannel,
      sync_permissions: false,
    };

    // A categoria bloqueia envio de mensagens
    const catOverrides: CategoryPermissionOverride[] = [
      {
        id: "cat-ov-1",
        community_id: community.id,
        category_id: "cat-1",
        target_type: "role",
        role_id: roleEveryone.id,
        user_id: null,
        permission: "send_messages",
        state: "deny",
      },
    ];

    // Como o canal é sync_permissions = false e não tem override próprio no canal,
    // ele ignora a categoria e usa a permissão base do cargo @todos (que tem send_messages)
    const result = hasChannelPermission("send_messages", {
      userId: "user-regular",
      community,
      channel: desyncedChannel,
      memberRoles: [roleEveryone],
      channelOverrides: [],
      categoryOverrides: catOverrides,
    });
    expect(result).toBe(true);
  });

  // Case J: Permissão base da comunidade se aplica quando overrides estão ausentes ou em HERDAR
  it("Caso J: Permissão base da comunidade se aplica quando overrides são ausentes / neutros", () => {
    const regularCanSpeak = hasChannelPermission("speak", {
      userId: "user-regular",
      community,
      channel: baseChannel,
      memberRoles: [roleEveryone],
      channelOverrides: [],
      categoryOverrides: [],
    });
    expect(regularCanSpeak).toBe(true);

    const regularCannotManageRoles = hasChannelPermission("manage_roles", {
      userId: "user-regular",
      community,
      channel: baseChannel,
      memberRoles: [roleEveryone],
      channelOverrides: [],
      categoryOverrides: [],
    });
    expect(regularCannotManageRoles).toBe(false);
  });

  // Teste de resolução consolidada
  it("resolveChannelPermissions retorna o mapa booleano de todas as permissões", () => {
    const perms = resolveChannelPermissions({
      userId: "user-staff",
      community,
      channel: baseChannel,
      memberRoles: [roleEveryone, roleStaff],
      channelOverrides: [],
      categoryOverrides: [],
    });

    expect(perms.view_channels).toBe(true);
    expect(perms.send_messages).toBe(true);
    expect(perms.manage_messages).toBe(true);
    expect(perms.administrator).toBeUndefined(); // Não é do escopo de canal
  });
});
