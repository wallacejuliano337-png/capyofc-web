import type { Community, CommunityRole, Member } from "./communities";

export const DEFAULT_ROLE_COLORS = [
  "#99aab5", // Padrão (@todos)
  "#1abc9c", // Aqua / Turquesa
  "#2ecc71", // Verde Esmeralda
  "#3498db", // Azul Safira
  "#9b59b6", // Roxo Ametista
  "#e91e63", // Rosa Choque
  "#f1c40f", // Dourado
  "#e67e22", // Laranja Fogo
  "#e74c3c", // Vermelho Carmim
  "#5865f2", // Blurple LYC
  "#34495e", // Grafite Escuro
  "#eb459e", // Fúcsia Neon
  "#00e5ff", // Ciano Elétrico LYC
];

export interface PermissionDefinition {
  key: string;
  name: string;
  description: string;
  isDanger?: boolean;
}

export interface PermissionGroup {
  id: "general" | "members" | "messages" | "voice" | "advanced";
  title: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "general",
    title: "GERAL",
    permissions: [
      {
        key: "view_channels",
        name: "Ver canais",
        description:
          "Permite que os membros visualizem os canais de texto e salas de voz por padrão.",
      },
      {
        key: "manage_channels",
        name: "Gerenciar canais",
        description:
          "Permite criar, editar ou excluir canais de texto e salas de voz.",
      },
      {
        key: "manage_roles",
        name: "Gerenciar cargos",
        description:
          "Permite criar novos cargos e alterar permissões de cargos abaixo deste na hierarquia.",
      },
      {
        key: "manage_community",
        name: "Gerenciar comunidade",
        description:
          "Permite alterar nome, descrição, ícone, banner e configurações básicas do servidor.",
      },
      {
        key: "view_audit_log",
        name: "Ver registro de auditoria",
        description:
          "Permite visualizar o histórico de ações administrativas da comunidade.",
      },
    ],
  },
  {
    id: "members",
    title: "MEMBROS",
    permissions: [
      {
        key: "change_nickname",
        name: "Alterar apelido próprio",
        description:
          "Permite aos membros alterarem seu próprio apelido de exibição neste servidor.",
      },
      {
        key: "manage_nicknames",
        name: "Gerenciar apelidos",
        description:
          "Permite alterar o apelido de outros membros neste servidor.",
      },
      {
        key: "kick_members",
        name: "Expulsar membros",
        description:
          "Permite expulsar membros do servidor. Eles poderão retornar se convidados.",
      },
      {
        key: "ban_members",
        name: "Banir membros",
        description:
          "Permite banir permanentemente membros do servidor, impedindo seu retorno.",
      },
      {
        key: "timeout_members",
        name: "Aplicar timeout",
        description:
          "Permite suspender temporariamente a capacidade de envio de mensagens de membros.",
      },
    ],
  },
  {
    id: "messages",
    title: "MENSAGENS",
    permissions: [
      {
        key: "send_messages",
        name: "Enviar mensagens",
        description: "Permite enviar mensagens de texto nos canais públicos.",
      },
      {
        key: "manage_messages",
        name: "Gerenciar mensagens",
        description:
          "Permite excluir mensagens de outros membros e fixar mensagens importantes.",
      },
      {
        key: "embed_links",
        name: "Incorporar links",
        description:
          "Permite que links enviados nas mensagens exibam pré-visualização rica.",
      },
      {
        key: "attach_files",
        name: "Anexar arquivos",
        description: "Permite fazer upload de imagens, arquivos e documentos no chat.",
      },
      {
        key: "add_reactions",
        name: "Adicionar reações",
        description: "Permite reagir a mensagens com emojis.",
      },
      {
        key: "mention_everyone",
        name: "Mencionar @todos",
        description:
          "Permite usar a menção @todos para notificar todos os membros da comunidade.",
      },
    ],
  },
  {
    id: "voice",
    title: "VOZ",
    permissions: [
      {
        key: "connect_voice",
        name: "Conectar",
        description: "Permite conectar-se e ouvir nas salas de voz.",
      },
      {
        key: "speak",
        name: "Falar",
        description: "Permite falar pelo microfone nas salas de voz.",
      },
      {
        key: "video",
        name: "Vídeo",
        description: "Permite ligar a câmera/webcam nas salas de voz.",
      },
      {
        key: "share_screen",
        name: "Compartilhar tela",
        description:
          "Permite transmitir telas, janelas e aplicativos em salas de voz.",
      },
      {
        key: "mute_members",
        name: "Silenciar membros",
        description:
          "Permite silenciar o microfone de outros membros em salas de voz.",
      },
      {
        key: "disconnect_members",
        name: "Desconectar membros",
        description:
          "Permite desconectar outros participantes de salas de voz.",
      },
    ],
  },
  {
    id: "advanced",
    title: "AVANÇADO",
    permissions: [
      {
        key: "administrator",
        name: "Administrador",
        description:
          "Concede todas as permissões da comunidade e ignora qualquer restrição de canal. Esta é uma permissão perigosa que deve ser concedida apenas a pessoas de confiança.",
        isDanger: true,
      },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

/**
 * Retorna todos os cargos associados a um membro, ordenados da maior hierarquia para a menor.
 */
export function getMemberRoles(
  member: Member,
  allRoles: CommunityRole[],
): CommunityRole[] {
  const roleIdSet = new Set<string>();
  if (member.role_ids && member.role_ids.length > 0) {
    for (const rid of member.role_ids) roleIdSet.add(rid);
  } else if (member.role_id) {
    roleIdSet.add(member.role_id);
  }

  const assigned = allRoles.filter((r) => roleIdSet.has(r.id));
  return assigned.sort((a, b) => b.position - a.position);
}

/**
 * Retorna o cargo mais alto atribuído ao membro (ou @todos caso não possua cargo personalizado).
 */
export function getHighestRole(
  member: Member,
  allRoles: CommunityRole[],
): CommunityRole | null {
  const roles = getMemberRoles(member, allRoles);
  if (roles.length > 0) return roles[0];
  const everyone = allRoles.find((r) => r.is_default || r.base_role === "MEMBER");
  return everyone || null;
}

/**
 * Retorna a cor de um cargo ou fallback padrão.
 */
export function getRoleColor(
  arg1?: string | CommunityRole | null,
  arg2?: CommunityRole | null,
  fallback = "#99aab5",
): string {
  const role = typeof arg1 === "object" ? arg1 : arg2;
  if (role?.color && role.color !== "#99aab5") return role.color;
  if (role?.base_role === "OWNER") return "#f1c40f";
  if (role?.base_role === "ADMIN") return "#e91e63";
  if (role?.base_role === "MODERATOR") return "#2ecc71";
  return role?.color || fallback;
}

/**
 * Retorna a cor de exibição do membro com base no seu cargo mais alto.
 */
export function getDisplayRoleColor(
  member: Member,
  allRoles: CommunityRole[],
  fallback = "#99aab5",
): string {
  const highest = getHighestRole(member, allRoles);
  if (highest && highest.color && highest.color !== "#99aab5") {
    return highest.color;
  }
  if (highest?.base_role === "OWNER") return "#f1c40f";
  if (highest?.base_role === "ADMIN") return "#e91e63";
  if (highest?.base_role === "MODERATOR") return "#2ecc71";
  return fallback;
}

/**
 * Calcula o conjunto de permissões efetivas de um membro.
 * Proprietário ou quem possui a permissão 'administrator' recebe todas as permissões.
 */
export function getEffectivePermissions(
  member: Member | { user_id: string; role_ids?: string[]; role_id?: string },
  community: Community,
  allRoles: CommunityRole[],
): Set<string> {
  const perms = new Set<string>();

  // 1. Proprietário possui todas as permissões
  if (member.user_id === community.owner_id) {
    for (const key of ALL_PERMISSION_KEYS) perms.add(key);
    perms.add("manage_members");
    perms.add("moderate_members");
    perms.add("create_invites");
    return perms;
  }

  // 2. Coletar cargos atribuídos
  const roleIdSet = new Set<string>();
  if ("role_ids" in member && member.role_ids && member.role_ids.length > 0) {
    for (const rid of member.role_ids) roleIdSet.add(rid);
  } else if ("role_id" in member && member.role_id) {
    roleIdSet.add(member.role_id);
  }

  const assignedRoles = allRoles.filter((r) => roleIdSet.has(r.id));
  const everyoneRole = allRoles.find(
    (r) => r.is_default || r.base_role === "MEMBER",
  );

  // 3. Checar permissão de Administrador
  const hasAdmin = assignedRoles.some(
    (r) =>
      r.base_role === "OWNER" ||
      r.base_role === "ADMIN" ||
      r.permissions?.includes("administrator") ||
      r.permissions?.includes("manage_community"),
  );

  if (hasAdmin) {
    for (const key of ALL_PERMISSION_KEYS) perms.add(key);
    perms.add("manage_members");
    perms.add("moderate_members");
    perms.add("create_invites");
    return perms;
  }

  // 4. Permissões herdadas do cargo base @todos
  if (everyoneRole?.permissions) {
    for (const p of everyoneRole.permissions) perms.add(p);
  }

  // 5. Permissões de todos os cargos atribuídos
  for (const r of assignedRoles) {
    if (r.permissions) {
      for (const p of r.permissions) perms.add(p);
    }
  }

  return perms;
}

/**
 * Verifica se um membro possui uma permissão específica.
 */
export function hasPermission(
  member: Member | { user_id: string; role_ids?: string[]; role_id?: string },
  community: Community,
  allRoles: CommunityRole[],
  permission: string,
): boolean {
  const perms = getEffectivePermissions(member, community, allRoles);
  return perms.has(permission) || perms.has("administrator");
}

/**
 * Checa se o ator tem autoridade sobre um cargo específico na hierarquia.
 */
export function canManageRole(
  actor: Member,
  role: CommunityRole,
  community: Community,
  allRoles: CommunityRole[],
): boolean {
  if (role.base_role === "OWNER") return false;
  if (actor.user_id === community.owner_id) return true;

  if (!hasPermission(actor, community, allRoles, "manage_roles")) {
    return false;
  }

  const actorHighest = getHighestRole(actor, allRoles);
  const actorPos = actorHighest?.position ?? 0;

  // Não pode gerenciar cargo igual ou superior ao seu maior cargo
  if (role.position >= actorPos) return false;

  return true;
}

/**
 * Checa se o ator pode gerenciar as permissões e cargos de outro membro.
 */
export function canManageTargetMember(
  actor: Member,
  target: Member,
  community: Community,
  allRoles: CommunityRole[],
): boolean {
  if (target.user_id === community.owner_id) return false;
  if (actor.user_id === community.owner_id) return true;
  if (actor.user_id === target.user_id) return false;

  if (!hasPermission(actor, community, allRoles, "manage_roles")) {
    return false;
  }

  const actorHighest = getHighestRole(actor, allRoles);
  const targetHighest = getHighestRole(target, allRoles);

  const actorPos = actorHighest?.position ?? 0;
  const targetPos = targetHighest?.position ?? 0;

  return actorPos > targetPos;
}

/**
 * Checa se o ator pode atribuir um cargo a um membro específico.
 */
export function canAssignRoleToMember(
  actor: Member,
  target: Member,
  role: CommunityRole,
  community: Community,
  allRoles: CommunityRole[],
): boolean {
  if (role.base_role === "OWNER") return false;
  if (role.is_default || role.base_role === "MEMBER") return false; // @todos é implícito
  if (target.user_id === community.owner_id) return false;
  if (actor.user_id === community.owner_id) return true;
  if (actor.user_id === target.user_id) return false; // Sem auto-atribuição se não for owner

  if (!canManageRole(actor, role, community, allRoles)) return false;
  if (!canManageTargetMember(actor, target, community, allRoles)) return false;

  // Ator não pode conceder permissões que ele próprio não possui (exceto se for admin)
  if (!hasPermission(actor, community, allRoles, "administrator")) {
    const actorPerms = getEffectivePermissions(actor, community, allRoles);
    if (role.permissions?.some((p) => !actorPerms.has(p))) {
      return false;
    }
  }

  return true;
}

/**
 * Checa se o ator pode remover um cargo de um membro específico.
 */
export function canRemoveRoleFromMember(
  actor: Member,
  target: Member,
  role: CommunityRole,
  community: Community,
  allRoles: CommunityRole[],
): boolean {
  if (role.base_role === "OWNER") return false;
  if (role.is_default || role.base_role === "MEMBER") return false;
  if (target.user_id === community.owner_id) return false;
  if (actor.user_id === community.owner_id) return true;
  if (actor.user_id === target.user_id) return false;

  if (!canManageRole(actor, role, community, allRoles)) return false;
  if (!canManageTargetMember(actor, target, community, allRoles)) return false;

  return true;
}

// Helpers de conveniência rápidos para o app
export function canManageRoles(
  actor: Member,
  community: Community,
  allRoles: CommunityRole[],
): boolean {
  return hasPermission(actor, community, allRoles, "manage_roles");
}

export function canManageChannels(
  actor: Member,
  community: Community,
  allRoles: CommunityRole[],
): boolean {
  return hasPermission(actor, community, allRoles, "manage_channels");
}

export function canManageMessages(
  actor: Member,
  community: Community,
  allRoles: CommunityRole[],
): boolean {
  return hasPermission(actor, community, allRoles, "manage_messages");
}

export function canKickMembers(
  actor: Member,
  community: Community,
  allRoles: CommunityRole[],
): boolean {
  return (
    hasPermission(actor, community, allRoles, "kick_members") ||
    hasPermission(actor, community, allRoles, "moderate_members")
  );
}

export function canBanMembers(
  actor: Member,
  community: Community,
  allRoles: CommunityRole[],
): boolean {
  return hasPermission(actor, community, allRoles, "ban_members");
}

export function canManageCommunity(
  actor: Member,
  community: Community,
  allRoles: CommunityRole[],
): boolean {
  return hasPermission(actor, community, allRoles, "manage_community");
}

export function canStream(
  actor: Member,
  community: Community,
  allRoles: CommunityRole[],
): boolean {
  return hasPermission(actor, community, allRoles, "share_screen");
}
