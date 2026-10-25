import { getAvatarUrl, DEFAULT_AVATAR } from '../src/utils/avatar.ts';

console.log('=== TESTE DE UNIDADE: AVATAR PADRÃO E COMPATIBILIDADE ===');

// 1. New user without avatar (null or undefined)
const testNewUserAvatar = getAvatarUrl(null);
console.log('1. Novo usuário sem avatar ->', testNewUserAvatar);
if (testNewUserAvatar !== DEFAULT_AVATAR) {
  throw new Error(`Falha no fallback de avatar padrão: esperado ${DEFAULT_AVATAR}, recebido ${testNewUserAvatar}`);
}

// 2. User with empty string
const testEmptyAvatar = getAvatarUrl('');
console.log('2. Usuário com string vazia ->', testEmptyAvatar);
if (testEmptyAvatar !== DEFAULT_AVATAR) {
  throw new Error(`Falha no fallback de string vazia`);
}

// 3. User with legacy robot avatar
const testLegacyAvatar = getAvatarUrl('/assets/mascote-cabeca.png');
console.log('3. Usuário antigo com mascote-cabeca ->', testLegacyAvatar);
if (testLegacyAvatar !== DEFAULT_AVATAR) {
  throw new Error(`Falha no upgrade de avatar legado`);
}

// 4. User with custom avatar (e.g. Unsplash or Supabase Storage)
const customUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120';
const testCustomAvatar = getAvatarUrl(customUrl);
console.log('4. Usuário com avatar personalizado ->', testCustomAvatar);
if (testCustomAvatar !== customUrl) {
  throw new Error(`Falha na preservação de avatar personalizado! O avatar foi indevidamente alterado.`);
}

console.log(' Todos os testes de unidade de avatar passaram com sucesso!\n');
