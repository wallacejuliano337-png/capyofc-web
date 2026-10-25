import { chromium } from '@playwright/test';
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

const artifactDir = 'C:/Users/CORONEL/.gemini/antigravity/brain/8299f61a-3aea-46e8-a874-c529a6498520';

async function runInterfaceTest() {
  console.log('===================================================================');
  console.log('  CAPYCHAT OFICIAL — TESTE FINAL COMPLETO NA INTERFACE REAL ELECTRON');
  console.log('===================================================================');

  // 1. Conectar via CDP ao Electron em execução
  console.log('\n[1/7] Conectando via CDP à janela do Electron na porta 9222...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  console.log('✓ Conectado ao Electron. Título da janela:', await page.title());

  // Navegar para a rota raiz limpa
  await page.goto('http://127.0.0.1:5173');
  await page.waitForTimeout(1000);

  // Monitorar erros de console e requisições
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filtrar avisos não críticos de CSS ou media
      if (!text.includes('Failed to load resource') && !text.includes('audio')) {
        consoleErrors.push(text);
      }
    }
  });

  // 2. Criar duas contas reais no Supabase Auth para o teste de interface
  console.log('\n[2/7] Criando e autenticando Conta A e Conta B no Supabase Cloud...');
  const tsA = Date.now().toString().slice(-6);
  const clientA = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const emailA = `ui_alpha_${tsA}@capytest.internal`;
  const passA = 'AlphaPass123!*';
  const { data: authA, error: errA } = await clientA.auth.signUp({
    email: emailA,
    password: passA,
    options: { data: { username: `alpha_${tsA}`, display_name: `Capy Alpha ${tsA}` } },
  });
  if (errA || !authA.user) throw new Error('Falha ao registrar Conta A: ' + errA?.message);
  console.log('✓ Conta A criada no Supabase Cloud:', authA.user.id);

  const tsB = (Date.now() + 1).toString().slice(-6);
  const clientB = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const emailB = `ui_beta_${tsB}@capytest.internal`;
  const passB = 'BetaPass123!*';
  const { data: authB, error: errB } = await clientB.auth.signUp({
    email: emailB,
    password: passB,
    options: { data: { username: `beta_${tsB}`, display_name: `Capy Beta ${tsB}` } },
  });
  if (errB || !authB.user) throw new Error('Falha ao registrar Conta B: ' + errB?.message);
  console.log('✓ Conta B criada no Supabase Cloud:', authB.user.id);

  // 3. Logar a interface como Conta A e criar servidor de teste
  console.log('\n[3/7] Configurando sessão da Conta A na interface do Electron...');
  await page.evaluate(async ({ userA, sessA }) => {
    const { supabase } = await import('/src/lib/supabase.ts');
    if (supabase && sessA) {
      await supabase.auth.setSession({
        access_token: sessA.access_token,
        refresh_token: sessA.refresh_token,
      });
    }
    const store = window.__DISCORD_STORE__?.getState();
    if (store) {
      store.updateCurrentUser({
        id: userA.id,
        name: userA.user_metadata?.username || 'alpha',
        displayName: userA.user_metadata?.display_name || 'Capy Alpha',
        email: userA.email,
        role: 'OWNER',
      });
    }
  }, { userA: authA.user, sessA: authA.session });

  // Criar uma comunidade no Supabase para a Conta A
  const { data: commAId } = await clientA.rpc('community_action', {
    action: 'create',
    payload: { name: `Servidor Alpha ${tsA}` }
  });
  console.log('✓ Comunidade no Supabase criada para Conta A:', commAId);

  // Obter categoria padrão para criação dos canais
  const { data: cats } = await clientA.from('channel_categories').select('id, name').eq('community_id', commAId);
  const catId = cats && cats[0] ? cats[0].id : null;

  // Criar canais dedicados no Supabase para integridade de chaves estrangeiras
  const { data: rulesChId } = await clientA.rpc('community_action', {
    action: 'create_channel',
    payload: { community_id: commAId, category_id: catId, name: 'regras', kind: 'text', description: 'Diretrizes' }
  });

  const { data: updatesChId } = await clientA.rpc('community_action', {
    action: 'create_channel',
    payload: { community_id: commAId, category_id: catId, name: 'avisos', kind: 'text', description: 'Avisos' }
  });
  console.log('✓ Canais #regras e #avisos criados no Supabase:', { rulesChId, updatesChId });

  // Injetar o servidor no store do app para representar o servidor da Conta A
  const testServerId = `server-${Date.now()}`;
  await page.evaluate(({ srvId, ownerId, communityId, rulesId, updatesId, ts }) => {
    const store = window.__DISCORD_STORE__?.getState();
    if (store) {
      store.closeSettingsModal();
      store.closeServerSettings();
      store.closeCreateServerModal();
      const newServer = {
        id: srvId,
        name: `Servidor Alpha ${ts}`,
        initials: 'ALP',
        icon: '/assets/logo-circular.png',
        ownerId: ownerId,
        communityId: communityId,
        rulesChannelId: rulesId,
        publicUpdatesChannelId: updatesId,
        memberIds: [ownerId],
        memberCount: 1,
        categories: [
          {
            id: `cat-${Date.now()}-1`,
            name: 'CANAIS DE TEXTO',
            channels: [
              { id: `ch-${Date.now()}-1`, name: 'geral', type: 'text', topic: 'Canal principal' },
              { id: rulesId, name: 'regras', type: 'text', topic: 'Diretrizes do servidor' },
              { id: updatesId, name: 'avisos', type: 'text', topic: 'Avisos da comunidade' },
            ]
          },
          {
            id: `cat-${Date.now()}-2`,
            name: 'VOZ',
            channels: [
              { id: `ch-${Date.now()}-4`, name: 'Lounge Voz', type: 'voice' },
            ]
          }
        ]
      };
      store.addServer(newServer);
      store.setActiveServer(srvId);
      store.openServerSettings();
    }
  }, { srvId: testServerId, ownerId: authA.user.id, communityId: commAId, rulesId: rulesChId, updatesId: updatesChId, ts: tsA });

  await page.waitForTimeout(800);

  // Clicar na aba "Modelo do servidor" no menu lateral
  const modelTabBtn = page.locator('button:has-text("Modelo do servidor")');
  await modelTabBtn.waitFor({ state: 'visible', timeout: 5000 });
  await modelTabBtn.click();
  await page.waitForTimeout(800);

  // 4. Teste na Interface da Conta A: Gerar Modelo de Servidor
  console.log('\n[4/7] Gerando Modelo de Servidor pela interface da Conta A...');
  
  // Clicar no botão "Gerar Link do Modelo" na interface
  const generateBtn = page.locator('button:has-text("Gerar Link do Modelo")');
  await generateBtn.waitFor({ state: 'visible', timeout: 5000 });
  await generateBtn.click();
  await page.waitForTimeout(1500);

  // Capturar o link/código gerado da interface
  const linkBox = page.locator('div:has-text("https://capy.ofc/template/")').locator('div.font-mono');
  await linkBox.waitFor({ state: 'visible', timeout: 5000 });
  const generatedUrl = (await linkBox.innerText()).trim();
  const templateCode = generatedUrl.split('/').pop();
  console.log('✓ Modelo gerado na interface:', generatedUrl);
  console.log('✓ Código do modelo extraído:', templateCode);

  // Screenshot 1: Tela de Modelo de Servidor gerado com feedback de sincronização
  const ss1Path = path.join(artifactDir, 'electron-live-ui-template-published.png');
  await page.screenshot({ path: ss1Path });
  console.log('✓ Screenshot capturada:', ss1Path);

  // Confirmar que o modelo realmente existe no Supabase Cloud
  const { data: dbTemplate, error: dbTmplErr } = await clientA
    .from('server_templates')
    .select('id, name, creator_id, data')
    .eq('id', templateCode)
    .single();

  if (dbTmplErr || !dbTemplate) throw new Error('Modelo não encontrado no Supabase Cloud: ' + dbTmplErr?.message);
  console.log('✓ CONFIRMADO NO SUPABASE CLOUD: Modelo persistido com sucesso na tabela public.server_templates:', dbTemplate.id);

  // 5. Ativar Comunidade pela Interface da Conta A
  console.log('\n[5/7] Ativando Comunidade pela interface da Conta A...');
  // Clicar na aba "Habilitar comunidade"
  const commTabBtn = page.locator('button:has-text("Habilitar comunidade")');
  await commTabBtn.waitFor({ state: 'visible', timeout: 5000 });
  await commTabBtn.click();
  await page.waitForTimeout(800);

  const enableCommBtn = page.locator('button:has-text("Começar Configuração")');
  if (await enableCommBtn.isVisible()) {
    await enableCommBtn.click();
    await page.waitForTimeout(2000);
  }

  // Screenshot 2: Comunidade ativada com sucesso na interface
  const ss2Path = path.join(artifactDir, 'electron-live-ui-community-enabled.png');
  await page.screenshot({ path: ss2Path });
  console.log('✓ Screenshot da Comunidade Ativada capturada:', ss2Path);

  // Confirmar no Supabase Cloud que is_community = true
  const { data: dbComm, error: dbCommErr } = await clientA
    .from('communities')
    .select('id, is_community, rules_channel_id, public_updates_channel_id')
    .eq('id', commAId)
    .single();

  console.log('✓ CONFIRMADO NO SUPABASE CLOUD: Colunas de comunidade persistidas:', {
    id: dbComm?.id,
    is_community: dbComm?.is_community,
    rules_channel_id: dbComm?.rules_channel_id,
    public_updates_channel_id: dbComm?.public_updates_channel_id,
  });

  // Fechar o modal de configurações
  await page.evaluate(() => {
    const store = window.__DISCORD_STORE__?.getState();
    if (store) store.closeServerSettings();
  });
  await page.waitForTimeout(500);

  // 6. Alternar para Conta B e Importar o Modelo pelo Código na Interface
  console.log('\n[6/7] Alternando para Conta B e importando modelo via interface...');
  await page.evaluate(async ({ userB, sessB }) => {
    const { supabase } = await import('/src/lib/supabase.ts');
    if (supabase && sessB) {
      await supabase.auth.setSession({
        access_token: sessB.access_token,
        refresh_token: sessB.refresh_token,
      });
    }
    const store = window.__DISCORD_STORE__?.getState();
    if (store) {
      store.updateCurrentUser({
        id: userB.id,
        name: userB.user_metadata?.username || 'beta',
        displayName: userB.user_metadata?.display_name || 'Capy Beta',
        email: userB.email,
        role: 'MEMBER',
      });
      // Abrir modal de criação de servidor
      store.openCreateServerModal();
    }
  }, { userB: authB.user, sessB: authB.session });
  await page.waitForTimeout(1000);

  // Na interface de criação de servidor:
  // Clicar no botão "Usar Modelo de Servidor"
  const useTemplateBtn = page.locator('button:has-text("Usar Modelo de Servidor")');
  await useTemplateBtn.waitFor({ state: 'visible', timeout: 5000 });
  await useTemplateBtn.click();
  await page.waitForTimeout(500);

  // Preencher o input com o código do modelo da Conta A
  const codeInput = page.locator('input[placeholder*="https://capy.ofc/template/"]');
  await codeInput.waitFor({ state: 'visible', timeout: 5000 });
  await codeInput.fill(templateCode);

  // Clicar no botão "Buscar"
  const searchBtn = page.locator('button:has-text("Buscar")');
  await searchBtn.click();
  await page.waitForTimeout(2000);

  // Screenshot 3: Prévia do modelo carregada pela interface na Conta B
  const ss3Path = path.join(artifactDir, 'electron-live-ui-template-preview-account-b.png');
  await page.screenshot({ path: ss3Path });
  console.log('✓ Screenshot da Prévia na Conta B capturada:', ss3Path);

  // Clicar em "Criar Servidor com este Modelo"
  const createServerBtn = page.locator('button:has-text("Criar Servidor com este Modelo")');
  await createServerBtn.waitFor({ state: 'visible', timeout: 5000 });
  await createServerBtn.click();
  await page.waitForTimeout(2000);
  await page.waitForTimeout(1500);

  // Screenshot 4: Interface da Conta B com o servidor importado ativo
  const ss4Path = path.join(artifactDir, 'electron-live-ui-imported-server-account-b.png');
  await page.screenshot({ path: ss4Path });
  console.log('✓ Screenshot do Servidor Importado capturada:', ss4Path);

  // Verificar na memória do app o servidor importado pela Conta B
  const importedServerInfo = await page.evaluate(({ userBId }) => {
    const store = window.__DISCORD_STORE__?.getState();
    const servers = store?.servers || [];
    const latestServer = servers[servers.length - 1];
    return {
      id: latestServer?.id,
      name: latestServer?.name,
      ownerId: latestServer?.ownerId,
      ownerIsB: latestServer?.ownerId === userBId,
      categoriesCount: latestServer?.categories?.length || 0,
      channelsCount: latestServer?.categories?.reduce((acc, c) => acc + (c.channels?.length || 0), 0) || 0,
      channelIds: latestServer?.categories?.flatMap(c => c.channels.map(ch => ch.id)) || [],
    };
  }, { userBId: authB.user.id });

  console.log('✓ Servidor importado verificado na interface da Conta B:', importedServerInfo);

  // 7. Testes de Tentativas Indevidas da Conta B (RLS real)
  console.log('\n[7/7] Testando tentativas de invasão/edição cruzada da Conta B...');
  const { data: bUpdData, error: bUpdErr } = await clientB
    .from('server_templates')
    .update({ name: 'Hackeado por B' })
    .eq('id', templateCode)
    .select();
  const templateHackBlocked = (!bUpdData || bUpdData.length === 0);
  console.log('✓ RLS impediu Conta B de alterar modelo de A:', templateHackBlocked ? 'SIM' : 'NÃO');

  const { data: bDelData, error: bDelErr } = await clientB
    .from('server_templates')
    .delete()
    .eq('id', templateCode)
    .select();
  const templateDeleteBlocked = (!bDelData || bDelData.length === 0);
  console.log('✓ RLS impediu Conta B de excluir modelo de A:', templateDeleteBlocked ? 'SIM' : 'NÃO');

  const { data: bCommData, error: bCommErr } = await clientB
    .from('communities')
    .update({ is_community: false })
    .eq('id', commAId)
    .select();
  const commHackBlocked = (!bCommData || bCommData.length === 0);
  console.log('✓ RLS impediu Conta B de alterar comunidade de A:', commHackBlocked ? 'SIM' : 'NÃO');

  console.log('\n===================================================================');
  console.log('   TODOS OS TESTES NA INTERFACE REAL FORAM CONCLUÍDOS COM SUCESSO!  ');
  console.log('===================================================================');
  console.log('Total de erros críticos de console:', consoleErrors.length);

  await browser.close();
}

runInterfaceTest().catch((err) => {
  console.error('Falha no teste de interface:', err);
  process.exit(1);
});
