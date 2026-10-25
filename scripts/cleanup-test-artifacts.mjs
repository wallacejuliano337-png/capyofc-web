import { chromium } from '@playwright/test';
import fs from 'node:fs';

const KNOWN_LEGITIMATE_IDS = new Set([
  'f8fcd139-cf43-4873-bd7d-a807ecd73567', // Coronel
  '96dde735-f6d8-4aaf-abd7-0176e44888f2', // Naori
  '7a4901f2-d51f-4747-9c5a-6b3aa716ada6', // Kirito
  '73426b78-425e-486a-abb5-951bf7ca959d', // Everton
  '89ef8f98-37c5-4199-b598-88c90ae2db6e', // HERMAN BETA
  'eda43ba0-44ee-4565-a0e7-bad81800e715', // FOOX7
  '33e0a99f-c10b-4057-b23d-85cf5fc13ba9', // Moraex
]);

const TEST_ACCOUNT_IDS = [
  'f724e836-be35-4d53-9fd9-4dc97ba1acb9',
  '52f38d7d-666e-4f0f-99c2-7d150659bb39',
  '95dbc856-1489-40f5-914d-3cbc90cbb4e6',
  'a05e5ba0-f76a-4059-8d84-3721761ddd00',
  '929794e5-2a05-4fd3-a72d-618e59d7dc25',
  '53f5007d-a0ba-4cac-92ee-cf57992168f9',
  'f44e2be3-03cd-43e7-995a-719a49f9b012',
  '7b477a9a-8ab1-4ea5-9461-12efe1f67365',
  'd77517df-6a3c-401d-ad3b-6922faa5992f',
  'ed69d1a7-b06c-41f6-8c55-835a7ab28b0b',
  'c542a680-42b2-413a-bf9c-83f967493cac',
  '8a0274f6-731a-4da9-a97d-06343229dbf7',
  '39d81d53-8d89-4f57-a65d-442a72d5e4ad',
  'dc9adf11-5776-40f1-878e-abf05f472f06',
  '6c0f8eef-3549-4efe-9004-c7e321784383',
  '3cb43393-4cdc-4313-9ad5-79cb7605df2c',
  '610a5033-2d02-48c0-8477-e45fba6c4a84',
  '9b13a11b-0180-4f26-b665-23a28d58e387',
  '91738f64-fb1e-464b-abac-a9d0bf45bf33',
  '4cffba8e-9053-4147-8dde-05856a07c37f',
  '3e014270-244b-499b-aa6d-1607fcba4519',
  '2a4ae293-bb97-4e95-9f02-a44551f78fc4',
  'cae45643-956a-4f75-a8fa-d7c279cebf5f',
  'a58a003b-6df2-4dda-90f5-3f9c4dcd0043',
  '06f17e89-d088-46ed-a254-cfc79217480c',
  '3a607ed3-ec3c-49f4-89cd-2e37fc566bb9',
  '811408b4-31cf-4b76-ad0b-d800acc9f157',
  'caa4962e-b170-42ed-aafa-fa11544163de',
  '857daae0-274a-46b3-86b5-86ccb5590d1f',
  'd5f11ad9-d964-4ec7-9bc6-f38a3c9d5477',
  'cb149b42-f4ff-450e-854b-5ee6bb72a161',
  'ad9ffc6e-38a5-4ed3-a486-b6f6febd7a20',
  '88b43829-8bdb-4594-b52e-25d14c6d4754',
  '31022437-2bd6-43ec-9928-9c036d4c196d',
  '40982cea-dd0f-47d7-8a86-963bac7d4f09',
  '000fd306-9ad4-40dc-a04e-8e31dcdc77c2',
  '1f3fdac8-67b6-4661-8ffc-5cdd5db73cb0',
  '4ae28e23-67b8-4d11-8f73-bd6da4dd2c10',
  '9a01d454-06df-48fc-8b2d-614af3778d98',
  '5f9bbc35-e688-4e1f-b6c2-813dc3c4d14a',
  'b230b2b6-f2b2-44af-810d-2a8aa44142d6',
  '6df208d7-2872-434d-92c5-87124302269d',
  'e6bdce18-9987-483a-9168-3fdfd0f64942',
  '989cef9a-0649-4b21-b429-62d0c1716500',
  '0d080b14-b714-4193-abbe-4ea3fd8c0b52',
  'ff8fea75-591b-4b5b-ac5a-69990f4e07f4',
  'd9bb15ae-30fa-4922-8ee7-0dca01b84a34',
  '05063ba9-db4a-423e-8329-81701e8966ce',
  '583edf45-058f-4292-b93e-d7ae4a07805d',
  '4e0d30c0-bc2d-401f-8bbe-3f4bf1a66c7a',
  'ff997b21-8be6-4acb-a980-ac28d8f8bb3b',
  '82668c61-d66c-4160-84cf-6f59236a77b5',
  'f2e463e2-a983-4511-bd16-397af49462cd',
  'a8879b28-cca6-4a7b-b5c4-8e2741a0716a',
  'be75df30-9abd-45d9-91b9-f13524b4919d',
  '791164b0-1ca9-4e6b-9fa1-12040b1be515'
];

async function main() {
  console.log('=== ROTINA DE LIMPEZA CONTROLADA DE TESTES ===\n');

  // 1. Verificação de Segurança
  for (const id of TEST_ACCOUNT_IDS) {
    if (KNOWN_LEGITIMATE_IDS.has(id)) {
      throw new Error(`CRITICAL: ID legítimo detectado na lista de exclusão: ${id}`);
    }
  }
  console.log(`[SEGURANÇA] Verificados ${TEST_ACCOUNT_IDS.length} IDs de teste. Zero IDs legítimos na lista.`);

  // 2. Gerar SQL Administrativo para o Supabase Dashboard
  const sqlFile = 'supabase/cleanup_test_accounts_safe.sql';
  const sqlContent = `-- LIMPEZA SEGURA E CONTROLADA DE CONTAS DE TESTE (56 CONTAS AUDITADAS)
-- Executar no SQL Editor do painel Supabase (tfjkinffnksmiqatdhnb)
-- Efeito ON DELETE CASCADE: remove de auth.users, public.profiles, public.community_members, etc.

DO $$
BEGIN
  -- 1. Excluir contas de teste auditadas de auth.users
  DELETE FROM auth.users 
  WHERE id IN (
${TEST_ACCOUNT_IDS.map(id => `    '${id}'`).join(',\n')}
  );

  RAISE NOTICE 'Contas de teste removidas com sucesso de auth.users.';
END $$;
`;

  fs.writeFileSync(sqlFile, sqlContent, 'utf8');
  console.log(`[SQL GERADO] Script de limpeza administrativa salvo em: ${sqlFile}`);

  // 3. Sanitização do LocalStorage do Electron via CDP
  console.log('\n[ELECTRON] Conectando ao Electron via CDP para sanitizar LocalStorage...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  const localCleanupResult = await page.evaluate((testIds) => {
    const testIdsSet = new Set(testIds);

    // 1. Limpar servidores customizados no LocalStorage
    let customServers = [];
    try {
      customServers = JSON.parse(localStorage.getItem('lyc_custom_servers') || '[]');
    } catch {}

    const cleanCustomServers = customServers.filter((s) => {
      if (s.name.includes('Alpha') || s.name.includes('Beta') || s.name.includes('Modelo')) return false;
      if (s.ownerId && testIdsSet.has(s.ownerId)) return false;
      return true;
    });
    localStorage.setItem('lyc_custom_servers', JSON.stringify(cleanCustomServers));

    // 2. Limpar lyc_servers_state
    let serversState = [];
    try {
      serversState = JSON.parse(localStorage.getItem('lyc_servers_state') || '[]');
    } catch {}

    const cleanServersState = serversState.filter((s) => {
      if (s.id === 'server-testes' || s.id === 'server-cs2' || s.id === 'server-val' || s.id === 'server-dev' || s.id === 'server-torneios') return false;
      if (s.name.includes('Alpha') || s.name.includes('Beta') || s.name.includes('Modelo')) return false;
      if (s.ownerId && testIdsSet.has(s.ownerId)) return false;
      return true;
    });
    localStorage.setItem('lyc_servers_state', JSON.stringify(cleanServersState));

    // 3. Limpar sessões salvas no alternador de contas
    let savedAccounts = [];
    try {
      savedAccounts = JSON.parse(localStorage.getItem('capychat_saved_accounts') || '[]');
    } catch {}

    const cleanSavedAccounts = savedAccounts.filter((a) => !testIdsSet.has(a.id) && !a.name.includes('amigo_') && !a.name.includes('alpha'));
    localStorage.setItem('capychat_saved_accounts', JSON.stringify(cleanSavedAccounts));

    // 4. Remover chaves de sessão de teste órfãs
    for (const id of testIds) {
      localStorage.removeItem(`capychat_session_${id}`);
      localStorage.removeItem(`lyc_community_enabled_server-${id}`);
      localStorage.removeItem(`lyc_displayed_badges_${id}`);
    }

    // 5. Atualizar o store em memória
    if (window.__DISCORD_STORE__) {
      const store = window.__DISCORD_STORE__.getState();
      store.savedAccounts = cleanSavedAccounts;
      store.servers = cleanServersState;
      // Recarregar membros com filtro
      store.fetchCommunityMembers();
    }

    return {
      beforeCustomCount: customServers.length,
      afterCustomCount: cleanCustomServers.length,
      beforeStateCount: serversState.length,
      afterStateCount: cleanServersState.length,
      remainingSavedAccounts: cleanSavedAccounts.map(a => a.name)
    };
  }, TEST_ACCOUNT_IDS);

  console.log('[ELECTRON] Resultado da sanitização local:');
  console.log(` - Servidores customizados: de ${localCleanupResult.beforeCustomCount} para ${localCleanupResult.afterCustomCount}`);
  console.log(` - Servidores no estado: de ${localCleanupResult.beforeStateCount} para ${localCleanupResult.afterStateCount}`);
  console.log(` - Contas salvas restantes:`, localCleanupResult.remainingSavedAccounts);

  // Recarregar a página para aplicar a inicialização limpa
  await page.reload();
  await page.waitForTimeout(2000);

  // Verificar o estado renderizado na janela do Electron
  const renderedState = await page.evaluate(() => {
    const s = window.__DISCORD_STORE__?.getState();
    const serverButtons = Array.from(document.querySelectorAll('aside[aria-label="Servidores"] [role="button"], aside [aria-label*="Servidor"], aside [data-server-id]'))
      .map(el => el.getAttribute('aria-label') || el.innerText || '');
    return {
      currentUser: s?.currentUser?.name || s?.currentUser?.displayName,
      serversInStore: s?.servers?.map(srv => ({ id: srv.id, name: srv.name })),
      communityMembersCount: s?.communityMembers?.length,
      membersList: s?.communityMembers?.map(m => m.displayName)
    };
  });

  console.log('\n[VERIFICAÇÃO PÓS-LIMPEZA NA INTERFACE DO ELECTRON]');
  console.log('Usuário ativo:', renderedState.currentUser);
  console.log('Servidores no Store:', renderedState.serversInStore);
  console.log(`Membros na Comunidade (${renderedState.communityMembersCount}):`, renderedState.membersList);

  // Capturar screenshot limpo
  const artifactDir = 'C:/Users/CORONEL/.gemini/antigravity/brain/8299f61a-3aea-46e8-a874-c529a6498520';
  const cleanScreenshot = `${artifactDir}/electron-live-clean-after-sanitization.png`;
  await page.screenshot({ path: cleanScreenshot });
  console.log(`✓ Screenshot da interface limpa salvo em: ${cleanScreenshot}`);

  await browser.close();
}

main().catch(console.error);
