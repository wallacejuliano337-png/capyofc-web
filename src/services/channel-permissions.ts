import type { Channel } from "../types";
import type {
  Community,
  CommunityRole,
  Member,
  ChannelPermissionOverride,
  CategoryPermissionOverride,
} from "./communities";

export type TriStatePermission = "inherit" | "allow" | "deny";

export interface ChannelPermissionDef {
  key: string;
  name: string;
  description: string;
  scope: "all" | "text" | "voice";
}

export const CHANNEL_PERMISSIONS: ChannelPermissionDef[] = [
  // Geral
  {
    key: "view_channels",
    name: "Ver canais",
    description: "Permite que os membros visualizem este canal.",
    scope: "all",
  },
  {
    key: "manage_channels",
    name: "Gerenciar canal",
    description: "Permite editar o nome, configurações ou excluir este canal.",
    scope: "all",
  },
  // Texto
  {
    key: "send_messages",
    name: "Enviar mensagens",
    description: "Permite que os membros enviem mensagens de texto neste canal.",
    scope: "text",
  },
  {
    key: "attach_files",
    name: "Anexar arquivos",
    description: "Permite enviar fotos, vídeos e arquivos neste canal.",
    scope: "text",
  },
  {
    key: "embed_links",
    name: "Inserir links",
    description: "Permite que links enviados exibam previews automáticos.",
    scope: "text",
  },
  {
    key: "add_reactions",
    name: "Adicionar reações",
    description: "Permite adicionar novas reações com emojis às mensagens.",
    scope: "text",
  },
  {
    key: "mention_everyone",
    name: "Mencionar @todos",
    description: "Permite enviar notificações para todos os membros do canal.",
    scope: "text",
  },
  {
    key: "manage_messages",
    name: "Gerenciar mensagens",
    description: "Permite apagar ou fixar mensagens de outros membros.",
    scope: "text",
  },
  // Voz
  {
    key: "connect_voice",
    name: "Conectar",
    description: "Permite entrar e ouvir conversas nesta sala de voz.",
    scope: "voice",
  },
  {
    key: "speak",
    name: "Falar",
    description: "Permite abrir o microfone e falar nesta sala de voz.",
    scope: "voice",
  },
  {
    key: "video",
    name: "Vídeo / Câmera",
    description: "Permite ligar a webcam nesta sala de voz.",
    scope: "voice",
  },
  {
    key: "share_screen",
    name: "Compartilhar tela",
    description: "Permite transmitir telas ou janelas nesta sala de voz.",
    scope: "voice",
  },
  {
    key: "mute_members",
    name: "Silenciar membros",
    description: "Permite silenciar o áudio de outros usuários na sala.",
    scope: "voice",
  },
  {
    key: "disconnect_members",
    name: "Desconectar membros",
    description: "Permite desconectar outros usuários da sala de voz.",
    scope: "voice",
  },
];

export interface ChannelPermissionContext {
  userId: string;
  community: Pick<Community, "id" | "owner_id">;
  channel: Channel;
  category?: { id: string } | null;
  member?: Member | null;
  memberRoles: CommunityRole[];
  allRoles?: CommunityRole[];
  channelOverrides: ChannelPermissionOverride[];
  categoryOverrides: CategoryPermissionOverride[];
}

/**
 * Resolução de permissões seguindo a hierarquia canônica idêntica ao SQL (private.channel_permission)
 * 1. Proprietário -> bypass total (ALLOW)
 * 2. Cargo com 'administrator' -> bypass total (ALLOW)
 * 3. Overrides específicos de membro no canal (ALLOW / DENY)
 * 4. Overrides dos cargos atribuídos no canal (Any ALLOW -> ALLOW; Any DENY -> DENY)
 * 5. Override de @todos no canal (ALLOW / DENY)
 * 6. Herança da Categoria (se sync_permissions !== false e category_id):
 *    - 6a. Override de membro na categoria (ALLOW / DENY)
 *    - 6b. Overrides dos cargos atribuídos na categoria (Any ALLOW -> ALLOW; Any DENY -> DENY)
 *    - 6c. Override de @todos na categoria (ALLOW / DENY)
 * 7. Permissão base da comunidade (fallback)
 */
export function hasChannelPermission(
  permission: string,
  ctx: ChannelPermissionContext,
): boolean {
  // 1. Proprietário
  if (ctx.userId && ctx.community.owner_id === ctx.userId) {
    return true;
  }

  // 2. Administrador
  if (ctx.memberRoles.some((r) => r.permissions?.includes("administrator"))) {
    return true;
  }

  // Identificar o cargo @todos
  const everyoneRole =
    ctx.allRoles?.find((r) => r.is_default || r.base_role === "MEMBER" || r.position === 0) ||
    ctx.memberRoles.find((r) => r.is_default || r.base_role === "MEMBER" || r.position === 0);
  const everyoneRoleId = everyoneRole?.id;

  // A. OVERRIDES DO CANAL
  const chOverrides = ctx.channelOverrides.filter(
    (o) => o.channel_id === ctx.channel.id && o.permission === permission,
  );

  // 3. Override de membro no canal
  const chMemberOverride = chOverrides.find(
    (o) => o.target_type === "member" && o.user_id === ctx.userId,
  );
  if (chMemberOverride) {
    if (chMemberOverride.state === "deny") return false;
    if (chMemberOverride.state === "allow") return true;
  }

  // 4. Overrides de cargos atribuídos no canal (excluindo @todos)
  const memberAssignedRoleIds = ctx.memberRoles
    .map((r) => r.id)
    .filter((id) => id !== everyoneRoleId);

  const chAssignedRoleOverrides = chOverrides.filter(
    (o) => o.target_type === "role" && o.role_id && memberAssignedRoleIds.includes(o.role_id),
  );

  const chRoleAllows = chAssignedRoleOverrides.some((o) => o.state === "allow");
  const chRoleDenies = chAssignedRoleOverrides.some((o) => o.state === "deny");

  if (chRoleAllows) return true;
  if (chRoleDenies) return false;

  // 5. Override de @todos no canal
  if (everyoneRoleId) {
    const chEveryoneOverride = chOverrides.find(
      (o) => o.target_type === "role" && o.role_id === everyoneRoleId,
    );
    if (chEveryoneOverride) {
      if (chEveryoneOverride.state === "deny") return false;
      if (chEveryoneOverride.state === "allow") return true;
    }
  }

  // B. HERANÇA DA CATEGORIA (se sync_permissions !== false e category_id)
  const isSynced = ctx.channel.sync_permissions !== false;
  const catId = ctx.channel.category_id || ctx.category?.id;

  if (isSynced && catId) {
    const catOverrides = ctx.categoryOverrides.filter(
      (o) => o.category_id === catId && o.permission === permission,
    );

    // 6a. Override de membro na categoria
    const catMemberOverride = catOverrides.find(
      (o) => o.target_type === "member" && o.user_id === ctx.userId,
    );
    if (catMemberOverride) {
      if (catMemberOverride.state === "deny") return false;
      if (catMemberOverride.state === "allow") return true;
    }

    // 6b. Overrides de cargos atribuídos na categoria (excluindo @todos)
    const catAssignedRoleOverrides = catOverrides.filter(
      (o) => o.target_type === "role" && o.role_id && memberAssignedRoleIds.includes(o.role_id),
    );

    const catRoleAllows = catAssignedRoleOverrides.some((o) => o.state === "allow");
    const catRoleDenies = catAssignedRoleOverrides.some((o) => o.state === "deny");

    if (catRoleAllows) return true;
    if (catRoleDenies) return false;

    // 6c. Override de @todos na categoria
    if (everyoneRoleId) {
      const catEveryoneOverride = catOverrides.find(
        (o) => o.target_type === "role" && o.role_id === everyoneRoleId,
      );
      if (catEveryoneOverride) {
        if (catEveryoneOverride.state === "deny") return false;
        if (catEveryoneOverride.state === "allow") return true;
      }
    }
  }

  // C. PERMISSÕES BASE DA COMUNIDADE (Fallback)
  return ctx.memberRoles.some((r) => r.permissions?.includes(permission));
}

/**
 * Retorna um mapa booleano com a resolução de todas as permissões para o canal
 */
export function resolveChannelPermissions(
  ctx: ChannelPermissionContext,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const perm of CHANNEL_PERMISSIONS) {
    result[perm.key] = hasChannelPermission(perm.key, ctx);
  }
  return result;
}
