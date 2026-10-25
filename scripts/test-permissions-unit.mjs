// Test the logic of canUserModerate and permission hierarchy
console.log('=== TESTE DE UNIDADE: PERMISSÕES E HIERARQUIA DE MODERAÇÃO ===');

// Mock roles
const roles = [
  {
    id: 'role-admin',
    name: 'Admin Fundador',
    permissions: { administrator: true, kickMembers: true, banMembers: true, manageRoles: true }
  },
  {
    id: 'role-mod',
    name: 'Moderador Geral',
    permissions: { administrator: false, kickMembers: true, banMembers: true, manageRoles: false }
  },
  {
    id: 'role-member',
    name: 'Membro Comum',
    permissions: { administrator: false, kickMembers: false, banMembers: false, manageRoles: false }
  }
];

const userRoleMap = {
  'user-admin': ['role-admin'],
  'user-mod': ['role-mod'],
  'user-common': ['role-member'],
  'user-victim': ['role-member'],
};

function canUserModerate(actorUserId, targetUserId) {
  const isOwner = actorUserId === 'user-ares' || actorUserId === 'user-admin';
  const actorRoleIds = userRoleMap[actorUserId] || [];
  const actorRoles = roles.filter(r => actorRoleIds.includes(r.id));
  
  const isAdmin = isOwner || actorRoles.some(r => r.permissions.administrator);
  const canKick = isAdmin || actorRoles.some(r => r.permissions.kickMembers);
  const canBan = isAdmin || actorRoles.some(r => r.permissions.banMembers);
  const canManageRoles = isAdmin || actorRoles.some(r => r.permissions.manageRoles);

  if (targetUserId) {
    if (targetUserId === actorUserId) {
      return { canKick: false, canBan: false, canManageRoles: false, isAdmin: false };
    }
    const targetRoleIds = userRoleMap[targetUserId] || [];
    const targetRoles = roles.filter(r => targetRoleIds.includes(r.id));
    const targetIsAdmin = targetUserId === 'user-ares' || targetRoles.some(r => r.permissions.administrator);
    if (targetIsAdmin && !isOwner) {
      return { canKick: false, canBan: false, canManageRoles: false, isAdmin };
    }
  }

  return { canKick, canBan, canManageRoles, isAdmin };
}

// 1. Membro comum tentando moderar
const commonPerms = canUserModerate('user-common', 'user-victim');
console.log('1. Membro comum moderando:', commonPerms);
if (commonPerms.canKick || commonPerms.canBan || commonPerms.canManageRoles || commonPerms.isAdmin) {
  throw new Error('Falha de segurança: Membro comum recebeu permissão de moderação!');
}

// 2. Moderador tentando moderar membro comum
const modVsCommon = canUserModerate('user-mod', 'user-victim');
console.log('2. Moderador moderando membro comum:', modVsCommon);
if (!modVsCommon.canKick || !modVsCommon.canBan || modVsCommon.canManageRoles || modVsCommon.isAdmin) {
  throw new Error('Falha: Moderador deveria poder expulsar/banir membro comum, mas não gerenciar cargos');
}

// 3. Moderador tentando moderar Admin (proteção de hierarquia)
const modVsAdmin = canUserModerate('user-mod', 'user-admin');
console.log('3. Moderador moderando Admin:', modVsAdmin);
if (modVsAdmin.canKick || modVsAdmin.canBan) {
  throw new Error('Falha de segurança: Moderador conseguiu permissão para expulsar/banir Admin!');
}

// 4. Admin ou Moderador tentando moderar a si mesmo (proteção contra auto-expulsão)
const selfMod = canUserModerate('user-mod', 'user-mod');
console.log('4. Usuário moderando a si mesmo:', selfMod);
if (selfMod.canKick || selfMod.canBan) {
  throw new Error('Falha de segurança: Usuário conseguiu permissão para expulsar a si próprio!');
}

// 5. Admin moderando membro comum
const adminVsCommon = canUserModerate('user-admin', 'user-victim');
console.log('5. Admin moderando membro comum:', adminVsCommon);
if (!adminVsCommon.canKick || !adminVsCommon.canBan || !adminVsCommon.canManageRoles || !adminVsCommon.isAdmin) {
  throw new Error('Falha: Admin deveria ter permissões completas');
}

console.log(' Todos os testes de unidade de permissões e hierarquia passaram com sucesso!\n');
