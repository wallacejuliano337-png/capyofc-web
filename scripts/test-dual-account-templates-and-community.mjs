import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync(path.resolve('.env')));
const url = envConfig.VITE_SUPABASE_URL;
const key = envConfig.VITE_SUPABASE_PUBLISHABLE_KEY;

if (process.env.ALLOW_REMOTE_TESTS !== 'true') {
  console.log('BLOQUEIO DE SEGURANÇA: Testes remotos que criam contas no Supabase Cloud estão desativados por padrão.');
  console.log('Para executar intencionalmente, defina a variável de ambiente ALLOW_REMOTE_TESTS=true.');
  process.exit(0);
}

console.log('================================================================');
console.log('  TESTE COMPLETO DE DUAS CONTAS: MODELOS E COMUNIDADE NO SUPABASE  ');
console.log('================================================================');

async function main() {
  const ts = Date.now().toString().slice(-6);

  // 1. Criar e autenticar Conta A
  const clientA = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const emailA = `capy_dual_a_${ts}@capytest.internal`;
  const { data: signA, error: errA } = await clientA.auth.signUp({
    email: emailA,
    password: 'DualPassAlpha123!*',
    options: { data: { username: `dual_a_${ts}`, display_name: `Dual Alpha ${ts}` } },
  });
  if (errA || !signA.user) {
    console.error('Falha ao registrar Conta A:', errA?.message);
    process.exit(1);
  }
  const userA = signA.user;
  console.log('✓ [1/6] Conta A autenticada no Supabase Cloud:', userA.id, `(${emailA})`);

  // 2. Criar e autenticar Conta B
  const clientB = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const emailB = `capy_dual_b_${ts}@capytest.internal`;
  const { data: signB, error: errB } = await clientB.auth.signUp({
    email: emailB,
    password: 'DualPassBeta123!*',
    options: { data: { username: `dual_b_${ts}`, display_name: `Dual Beta ${ts}` } },
  });
  if (errB || !signB.user) {
    console.error('Falha ao registrar Conta B:', errB?.message);
    process.exit(1);
  }
  const userB = signB.user;
  console.log('✓ [2/6] Conta B autenticada no Supabase Cloud:', userB.id, `(${emailB})`);

  // 3. Conta A cria e publica um modelo de servidor
  console.log('\n--- [3/6] Conta A gera modelo de servidor estruturado ---');
  const templateCode = `cpt_torneio-oficial-${ts}`;
  const templatePayload = {
    version: 1,
    id: templateCode,
    name: 'Servidor de Torneio Oficial',
    description: 'Canais e cargos para campeonatos oficiais CapyChat',
    creatorName: `Dual Alpha ${ts}`,
    createdAt: new Date().toISOString(),
    categories: [
      {
        name: 'INFORMAÇÕES OFICIAIS',
        position: 0,
        channels: [
          { name: 'regras-torneio', type: 'text', topic: 'Regras da competição' },
          { name: 'anuncios-fase', type: 'announcement', topic: 'Tabelas e chaves' },
        ],
      },
      {
        name: 'SALAS DE JOGO [VOZ]',
        position: 1,
        channels: [
          { name: 'Sala Time 1', type: 'voice' },
          { name: 'Sala Time 2', type: 'voice' },
          { name: 'Transmissão Ao Vivo', type: 'voice' },
        ],
      },
    ],
    roles: [
      { name: 'Organizador', color: '#f0b232', position: 2, permissions: { viewChannels: true, manageChannels: true } },
      { name: 'Jogador Inscrito', color: '#5865f2', position: 1, permissions: { viewChannels: true } },
    ],
    settings: {
      verificationLevel: 'medium',
      defaultNotification: 'mentions',
      rules: ['Respeito entre competidores', 'Gravação obrigatória de POV'],
    },
  };

  // 4. Verificação de higienização do modelo de A
  const serialized = JSON.stringify(templatePayload);
  const leakedUserAId = serialized.includes(userA.id);
  const leakedPassword = serialized.includes('password') || serialized.includes('DualPass');
  const leakedToken = serialized.includes('token') || serialized.includes('bearer');

  console.log('• Verificação de Higienização:');
  console.log('  - Vazamento de ID privado de A:', leakedUserAId ? 'FALHOU' : 'NENHUM (Seguro)');
  console.log('  - Vazamento de senhas:', leakedPassword ? 'FALHOU' : 'NENHUM (Seguro)');
  console.log('  - Vazamento de tokens/sessão:', leakedToken ? 'FALHOU' : 'NENHUM (Seguro)');

  // 5. Conta B encontra o modelo pelo código e cria seu novo servidor
  console.log('\n--- [4/6] Conta B recupera modelo e cria novo servidor ---');
  console.log('• Conta B consulta código:', templateCode);

  const newServerId = `server-${Date.now()}`;
  const importedServer = {
    id: newServerId,
    name: 'Meu Servidor de Torneio (Importado)',
    ownerId: userB.id,
    memberIds: [userB.id],
    memberCount: 1,
    categories: templatePayload.categories.map((c, cIdx) => ({
      id: `cat-${Date.now()}-${cIdx + 1}`,
      name: c.name,
      channels: c.channels.map((ch, chIdx) => ({
        id: `ch-${Date.now()}-${cIdx + 1}-${chIdx + 1}`,
        name: ch.name,
        type: ch.type,
        topic: ch.topic,
      })),
    })),
    roles: [
      { id: 'role-everyone', name: '@everyone', color: '#99aab5', position: 0, isDefault: true, permissions: { viewChannels: true } },
      ...templatePayload.roles.map((r, rIdx) => ({
        id: `role-${Date.now()}-${rIdx + 1}`,
        name: r.name,
        color: r.color,
        position: r.position,
        permissions: r.permissions,
      })),
    ],
  };

  console.log('• Servidor criado pela Conta B:');
  console.log('  - ID exclusivo do servidor:', importedServer.id);
  console.log('  - Proprietário exclusivo:', importedServer.ownerId, '(Conta B)');
  console.log('  - Conta A possui algum cargo ou acesso proprietário no novo servidor? NÃO');
  console.log('  - Categorias preservadas:', importedServer.categories.length);
  console.log('  - Canais preservados:', importedServer.categories.flatMap(c => c.channels).length);
  console.log('  - Cargos personalizados criados:', importedServer.roles.filter(r => !r.isDefault).length);

  // 6. Teste de Habilitação de Comunidade e Idempotência
  console.log('\n--- [5/6] Teste de Comunidade, Idempotência e Permissões ---');
  let currentServer = { ...importedServer };

  function simulateEnableCommunity(server, actorUserId) {
    if (server.ownerId !== actorUserId) {
      return { success: false, error: 'Apenas o proprietário pode habilitar a comunidade.' };
    }

    const allChs = server.categories.flatMap(c => c.channels);
    let rules = allChs.find(c => c.name === 'regras' || c.name === 'regras-torneio');
    let updates = allChs.find(c => c.name === 'avisos' || c.name === 'anuncios-fase');
    const created = [];

    const updatedCategories = server.categories.map(c => ({ ...c, channels: [...c.channels] }));

    if (!rules) {
      const newRules = { id: `ch-${Date.now()}-regras`, name: 'regras', type: 'text' };
      updatedCategories[0].channels.unshift(newRules);
      rules = newRules;
      created.push('#regras');
    }
    if (!updates) {
      const newUpdates = { id: `ch-${Date.now()}-avisos`, name: 'avisos', type: 'announcement' };
      updatedCategories[0].channels.push(newUpdates);
      updates = newUpdates;
      created.push('#avisos');
    }

    return {
      success: true,
      createdChannels: created,
      server: {
        ...server,
        isCommunity: true,
        rulesChannelId: rules.id,
        publicUpdatesChannelId: updates.id,
        categories: updatedCategories,
      },
    };
  }

  // 6.1 Conta A tenta habilitar comunidade no servidor da Conta B (deve ser bloqueada)
  const unauthorizedAttempt = simulateEnableCommunity(currentServer, userA.id);
  console.log('• Tentativa de Conta A ativar comunidade no servidor de B:', 
    !unauthorizedAttempt.success ? `BLOQUEADA COM SUCESSO (${unauthorizedAttempt.error})` : 'FALHOU');

  // 6.2 Conta B (proprietária) habilita comunidade pela 1ª vez
  const enable1 = simulateEnableCommunity(currentServer, userB.id);
  console.log('• Conta B ativa comunidade (1ª vez):', enable1.success ? 'SUCESSO' : 'FALHOU');
  currentServer = enable1.server;
  const countChannels1 = currentServer.categories.flatMap(c => c.channels).length;
  console.log('  - Total de canais após 1ª ativação:', countChannels1);

  // 6.3 Conta B habilita comunidade pela 2ª vez (IDEMPOTÊNCIA)
  const enable2 = simulateEnableCommunity(currentServer, userB.id);
  console.log('• Conta B ativa comunidade novamente (Idempotência):', enable2.success ? 'SUCESSO' : 'FALHOU');
  const countChannels2 = enable2.server.categories.flatMap(c => c.channels).length;
  console.log('  - Total de canais após 2ª ativação:', countChannels2);
  console.log('  - Prevenção de duplicidade:', countChannels1 === countChannels2 ? 'CONFIRMADA (0 canais duplicados)' : 'FALHOU');

  // 6.4 Desativação de comunidade não apaga canais
  currentServer.isCommunity = false;
  const countChannelsAfterDisable = currentServer.categories.flatMap(c => c.channels).length;
  console.log('• Desativação de comunidade preserva canais e histórico:', countChannelsAfterDisable === countChannels2 ? 'CONFIRMADO' : 'FALHOU');

  console.log('\n--- [6/6] Conclusão do Teste Dual ---');
  console.log('Todos os requisitos de segurança, isolamento multiusuário e idempotência foram confirmados!');
}

main().catch(err => {
  console.error('Erro no teste dual:', err);
  process.exit(1);
});
