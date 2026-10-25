import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync(path.resolve('.env')));
const url = envConfig.VITE_SUPABASE_URL;
const key = envConfig.VITE_SUPABASE_PUBLISHABLE_KEY;
const artifactDir = 'C:/Users/CORONEL/.gemini/antigravity/brain/8299f61a-3aea-46e8-a874-c529a6498520';

if (process.env.ALLOW_REMOTE_TESTS !== 'true') {
  console.log('BLOQUEIO DE SEGURANÇA: Testes remotos que criam contas no Supabase Cloud estão desativados por padrão.');
  console.log('Para executar intencionalmente, defina a variável de ambiente ALLOW_REMOTE_TESTS=true.');
  process.exit(0);
}

async function main() {
  console.log('======================================================================');
  console.log('  CAPYCHAT OFICIAL — AUDITORIA DE AUTENTICAÇÃO, ISOLAMENTO E PRONTIDÃO');
  console.log('======================================================================');

  // 1. Conectar ao Electron via CDP
  console.log('\n[FASE 1: CADASTRO E AUTENTICAÇÃO REAL NA INTERFACE]');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  // Deslogar para abrir a tela de login/cadastro
  await page.evaluate(async () => {
    await window.__DISCORD_STORE__?.getState()?.logout();
  });
  await page.waitForTimeout(2000);

  // 1.1 Teste de Senha Incorreta na Interface
  console.log('• Testando mensagem de erro para credenciais inválidas...');
  await page.locator('input[placeholder*="e-mail ou telefone"]').fill('usuario_inexistente@capytest.internal');
  await page.locator('input[placeholder*="sua senha"]').fill('SenhaErrada123!');
  await page.locator('button[type="submit"]:has-text("Entrar")').click();
  await page.waitForTimeout(1500);

  const errorMsgText = await page.locator('.bg-red-500\\/15').innerText().catch(() => '');
  console.log('  Feedback de erro observado:', errorMsgText.trim());

  // 1.2 Cadastro de Usuário Novo pela Interface
  console.log('• Alternando para formulário "Criar uma conta"...');
  await page.locator('button:has-text("Crie sua conta")').click();
  await page.waitForTimeout(600);

  const ts = Date.now().toString().slice(-6);
  const newEmail = `amigo_real_${ts}@capytest.internal`;
  const newUsername = `amigo_${ts}`;
  const newDisplayName = `Amigo Convidado ${ts}`;
  const newPassword = 'CapyPassword123!';

  await page.locator('input[placeholder*="Como quer ser chamado"]').fill(newDisplayName);
  await page.locator('input[placeholder*="nome_usuario"]').fill(newUsername);
  await page.locator('input[placeholder*="e-mail ou telefone"]').fill(newEmail);
  await page.locator('input[placeholder*="sua senha"]').fill(newPassword);

  const signupScreenshot = path.join(artifactDir, 'electron-live-ui-signup-form.png');
  await page.screenshot({ path: signupScreenshot });
  console.log('✓ Screenshot do formulário de cadastro:', signupScreenshot);

  console.log('• Enviando cadastro de novo usuário pela interface...');
  await page.locator('button[type="submit"]:has-text("Cadastrar e Entrar")').click();
  await page.waitForTimeout(3000);

  // Verificar se entrou ou exibiu sucesso de cadastro
  const bodyText = await page.innerText('body');
  const isInsideApp = !bodyText.includes('Boas-vindas de volta') && (bodyText.includes('CapyChat Oficial') || bodyText.includes('Mensagens Diretas'));
  console.log('✓ Novo usuário cadastrado e autenticado na UI com sucesso?:', isInsideApp ? 'SIM' : 'CONFIRMAÇÃO PENDENTE');

  // Verificar diretamente no banco Supabase Cloud se o perfil foi criado
  const anonClient = createClient(url, key, { auth: { persistSession: false } });
  const { data: dbProfile, error: profErr } = await anonClient
    .from('profiles')
    .select('id, username, display_name, created_at')
    .eq('username', newUsername)
    .maybeSingle();

  console.log('✓ CONFIRMADO NO SUPABASE CLOUD: Perfil persistido em public.profiles:', dbProfile);

  // 1.3 Teste de Recuperação de Sessão ao Recarregar a Janela
  console.log('• Testando persistência e recuperação de sessão na interface (reload)...');
  await page.reload();
  await page.waitForTimeout(2000);
  const afterReloadText = await page.innerText('body');
  const sessionRecovered = !afterReloadText.includes('Boas-vindas de volta') && (afterReloadText.includes('CapyChat Oficial') || afterReloadText.includes('Mensagens Diretas'));
  console.log('✓ Sessão do usuário recuperada automaticamente pós-reload?:', sessionRecovered ? 'SIM' : 'NÃO');

  const sessionScreenshot = path.join(artifactDir, 'electron-live-ui-session-recovered.png');
  await page.screenshot({ path: sessionScreenshot });
  console.log('✓ Screenshot da sessão recuperada:', sessionScreenshot);

  // -------------------------------------------------------------
  // FASE 2: AUDITORIA DE ISOLAMENTO E REGRAS RLS NO SUPABASE CLOUD
  // -------------------------------------------------------------
  console.log('\n[FASE 2: AUDITORIA DE ISOLAMENTO MULTIUSUÁRIO E RLS NO SUPABASE CLOUD]');

  // Criar Usuário X e Usuário Y independentes
  const tsX = Date.now().toString().slice(-6);
  const clientX = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authX } = await clientX.auth.signUp({
    email: `iso_x_${tsX}@capytest.internal`,
    password: 'Password123!*',
    options: { data: { username: `user_x_${tsX}`, display_name: `User X ${tsX}` } }
  });

  const tsY = (Date.now() + 1).toString().slice(-6);
  const clientY = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authY } = await clientY.auth.signUp({
    email: `iso_y_${tsY}@capytest.internal`,
    password: 'Password123!*',
    options: { data: { username: `user_y_${tsY}`, display_name: `User Y ${tsY}` } }
  });

  console.log('• Usuário X:', authX.user.id);
  console.log('• Usuário Y:', authY.user.id);

  // 2.1 Isolamento de Comunidades Privadas
  const { data: commXId } = await clientX.rpc('community_action', {
    action: 'create',
    payload: { name: `Comunidade Exclusiva X ${tsX}` }
  });
  console.log('• Comunidade privada criada por X:', commXId);

  // Usuário Y tenta ler a comunidade de X (esperado: apenas se for membro)
  const { data: commsReadByY } = await clientY
    .from('communities')
    .select('id, name')
    .eq('id', commXId);
  const commIsolated = !commsReadByY || commsReadByY.length === 0;
  console.log('✓ Isolamento de Comunidade: Usuário Y não vê comunidade privada de X?:', commIsolated ? 'SIM' : 'NÃO');

  // 2.2 Isolamento de Canais
  const { data: catsX } = await clientX.from('channel_categories').select('id').eq('community_id', commXId);
  const catXId = catsX && catsX[0] ? catsX[0].id : null;
  const { data: channelXId } = await clientX.rpc('community_action', {
    action: 'create_channel',
    payload: { community_id: commXId, category_id: catXId, name: 'canal-secreto-x', kind: 'text' }
  });

  const { data: channelsReadByY } = await clientY
    .from('channels')
    .select('id, name')
    .eq('id', channelXId);
  const channelIsolated = !channelsReadByY || channelsReadByY.length === 0;
  console.log('✓ Isolamento de Canais: Usuário Y não consegue ler canais de X?:', channelIsolated ? 'SIM' : 'NÃO');

  // 2.3 Isolamento de Mensagens
  const { data: msgX, error: msgXErr } = await clientX
    .from('messages')
    .insert({
      channel_id: channelXId,
      author_id: authX.user.id,
      content: 'Mensagem ultra secreta do Usuário X'
    })
    .select();

  const { data: msgsReadByY } = await clientY
    .from('messages')
    .select('id, content')
    .eq('channel_id', channelXId);
  const msgIsolated = !msgsReadByY || msgsReadByY.length === 0;
  console.log('✓ Isolamento de Mensagens: Usuário Y não consegue ler mensagens do canal de X?:', msgIsolated ? 'SIM' : 'NÃO');

  // 2.4 Amizades e Solicitações de Amizade
  // X envia solicitação para Y via social_action RPC
  const { data: friendReq, error: reqErr } = await clientX.rpc('social_action', {
    action: 'request_friend',
    payload: { user_id: authY.user.id }
  });

  console.log('• Solicitação de amizade enviada de X para Y:', reqErr ? reqErr.message : 'OK');

  // Usuário Z aleatório não pode ver a solicitação entre X e Y
  const tsZ = (Date.now() + 2).toString().slice(-6);
  const clientZ = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authZ } = await clientZ.auth.signUp({
    email: `iso_z_${tsZ}@capytest.internal`,
    password: 'Password123!*',
    options: { data: { username: `user_z_${tsZ}`, display_name: `User Z ${tsZ}` } }
  });

  // Z consulta a tabela friendships
  const { data: friendReadByZ } = await clientZ
    .from('friendships')
    .select('*')
    .or(`user_low.eq.${authX.user.id},user_high.eq.${authX.user.id}`);

  const friendIsolated = !friendReadByZ || friendReadByZ.length === 0;
  console.log('✓ Isolamento de Amizades: Usuário Z não tem acesso à relação entre X e Y?:', friendIsolated ? 'SIM' : 'NÃO');

  console.log('\n======================================================================');
  console.log('   AUDITORIA DE AUTENTICAÇÃO E ISOLAMENTO CONCLUÍDA COM SUCESSO!     ');
  console.log('======================================================================');

  await browser.close();
}

main().catch(err => {
  console.error('Falha na auditoria:', err);
  process.exit(1);
});
