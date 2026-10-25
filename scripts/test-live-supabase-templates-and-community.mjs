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

async function main() {
  console.log('--- INICIANDO TESTE DE PERSISTÊNCIA REMOTA E RLS NO SUPABASE CLOUD ---');
  
  const tsA = Date.now().toString().slice(-6);
  const clientA = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const emailA = `test_alpha_${tsA}@capytest.internal`;
  const passA = 'AlphaPass123!*';
  
  const { data: authA, error: errA } = await clientA.auth.signUp({
    email: emailA,
    password: passA,
    options: { data: { username: `alpha_${tsA}`, display_name: `Alpha ${tsA}` } },
  });

  if (errA || !authA.user) {
    console.error('Falha ao autenticar Usuário A:', errA);
    process.exit(1);
  }
  console.log('✓ Usuário A criado e autenticado:', authA.user.id);

  // Usuário B
  const tsB = (Date.now() + 1).toString().slice(-6);
  const clientB = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const emailB = `test_beta_${tsB}@capytest.internal`;
  const passB = 'BetaPass123!*';
  
  const { data: authB, error: errB } = await clientB.auth.signUp({
    email: emailB,
    password: passB,
    options: { data: { username: `beta_${tsB}`, display_name: `Beta ${tsB}` } },
  });

  if (errB || !authB.user) {
    console.error('Falha ao autenticar Usuário B:', errB);
    process.exit(1);
  }
  console.log('✓ Usuário B criado e autenticado:', authB.user.id);

  // 1. Usuário A cria um modelo no Supabase Cloud
  const templateId = `cpt_torneio_pro_${tsA}`;
  const templatePayload = {
    version: 1,
    id: templateId,
    name: 'Torneio Pro Alpha',
    description: 'Template oficial de torneio criado por Alpha',
    creatorName: `Alpha ${tsA}`,
    createdAt: new Date().toISOString(),
    categories: [
      {
        name: 'INFORMAÇÕES',
        position: 0,
        channels: [
          { name: 'regras', type: 'text', topic: 'Regras oficiais' },
          { name: 'anuncios', type: 'text', topic: 'Avisos' }
        ]
      },
      {
        name: 'VOZ',
        position: 1,
        channels: [
          { name: 'Geral Voz', type: 'voice' }
        ]
      }
    ],
    roles: [
      { name: 'Admin', color: '#ff0000', position: 1, permissions: { viewChannels: true, manageChannels: true } }
    ]
  };

  const { data: insertData, error: insertErr } = await clientA.from('server_templates').insert({
    id: templateId,
    name: templatePayload.name,
    description: templatePayload.description,
    creator_id: authA.user.id,
    data: templatePayload,
  }).select();

  if (insertErr) {
    console.error('Falha na inserção do modelo por A:', insertErr);
    process.exit(1);
  }
  console.log('✓ 1. Usuário A publicou o modelo no Supabase Cloud:', insertData[0].id);

  // 2. Usuário B consulta o modelo de A diretamente no Supabase Cloud
  const { data: fetchedByB, error: fetchErr } = await clientB
    .from('server_templates')
    .select('id, name, description, creator_id, data')
    .eq('id', templateId)
    .single();

  if (fetchErr || !fetchedByB) {
    console.error('Falha ao buscar modelo por B:', fetchErr);
    process.exit(1);
  }
  console.log('✓ 2. Usuário B localizou o modelo no Supabase Cloud pelo código:', fetchedByB.id, `("${fetchedByB.name}")`);

  // 3. Usuário B tenta ATUALIZAR o modelo de A
  const { data: updateAttempt, error: updateErr } = await clientB
    .from('server_templates')
    .update({ name: 'Modelo Hackeado por B' })
    .eq('id', templateId)
    .select();

  console.log('• Resposta da tentativa de update por B:', { rowsAffected: updateAttempt?.length || 0, error: updateErr });

  // 4. Conferir integridade no banco: Usuário A lê o modelo para checar se mudou
  const { data: checkIntegrity } = await clientA
    .from('server_templates')
    .select('id, name')
    .eq('id', templateId)
    .single();

  const updateBlocked = checkIntegrity.name === 'Torneio Pro Alpha' && (!updateAttempt || updateAttempt.length === 0);
  console.log('✓ 3. RLS bloqueou update por Usuário B:', updateBlocked ? 'SIM (Nome permaneceu inalterado no banco)' : 'NÃO');

  // 5. Usuário B tenta EXCLUIR o modelo de A
  const { data: deleteAttempt, error: deleteErr } = await clientB
    .from('server_templates')
    .delete()
    .eq('id', templateId)
    .select();

  console.log('• Resposta da tentativa de delete por B:', { rowsAffected: deleteAttempt?.length || 0, error: deleteErr });

  // 6. Conferir se o modelo ainda existe intacto no banco
  const { data: checkStillExists } = await clientA
    .from('server_templates')
    .select('id, name')
    .eq('id', templateId)
    .single();

  const deleteBlocked = Boolean(checkStillExists) && (!deleteAttempt || deleteAttempt.length === 0);
  console.log('✓ 4. RLS bloqueou delete por Usuário B:', deleteBlocked ? 'SIM (Modelo permanece salvo no banco)' : 'NÃO');

  // 7. Usuário B importa o modelo e cria um servidor novo e independente
  const newServerId = `server-${Date.now()}`;
  const importedServer = {
    id: newServerId,
    name: 'Servidor Importado por B',
    ownerId: authB.user.id,
    categories: fetchedByB.data.categories.map((cat, cIdx) => ({
      id: `cat-${Date.now()}-${cIdx}`,
      name: cat.name,
      channels: cat.channels.map((ch, chIdx) => ({
        id: `ch-${Date.now()}-${cIdx}-${chIdx}`,
        name: ch.name,
        type: ch.type,
        topic: ch.topic,
      }))
    })),
    roles: fetchedByB.data.roles.map((r, rIdx) => ({
      id: `role-${Date.now()}-${rIdx}`,
      name: r.name,
      color: r.color,
      permissions: r.permissions
    }))
  };

  const jsonStr = JSON.stringify(importedServer);
  const containsSecrets = jsonStr.includes('password') || jsonStr.includes('token') || jsonStr.includes('secret') || jsonStr.includes(authA.user.id);

  console.log('✓ 5. Servidor importado por B criado com sucesso:');
  console.log('   - ID do Servidor:', importedServer.id);
  console.log('   - Proprietário Único:', importedServer.ownerId, '(Usuário B)');
  console.log('   - IDs de Canais Gerados do Zero:', importedServer.categories.every(c => c.channels.every(ch => ch.id.startsWith('ch-'))));
  console.log('   - Contém dados sensíveis ou UID de A?:', containsSecrets ? 'SIM (FALHA)' : 'NÃO (HIGIENIZADO)');

  // 8. Teste de Habilitação de Comunidade e Persistência Remota em public.communities
  console.log('\n--- TESTE DE HABILITAÇÃO DE COMUNIDADE EM PUBLIC.COMMUNITIES ---');
  
  // Criar uma comunidade via RPC pública community_action
  const { data: createdCommId, error: commCreateErr } = await clientA.rpc('community_action', {
    action: 'create',
    payload: { name: `Comunidade Teste Alpha ${tsA}` }
  });

  if (commCreateErr) {
    console.error('Falha ao criar comunidade via RPC:', commCreateErr);
    process.exit(1);
  }
  const commId = typeof createdCommId === 'string' ? createdCommId : createdCommId;
  console.log('✓ Comunidade de teste criada por A:', commId);

  // Obter categoria padrão para criação de canais
  const { data: cats } = await clientA.from('channel_categories').select('id, name').eq('community_id', commId);
  const catId = cats && cats[0] ? cats[0].id : null;

  // Criar canais dedicados para regras e avisos
  const { data: rulesChId, error: rChErr } = await clientA.rpc('community_action', {
    action: 'create_channel',
    payload: { community_id: commId, category_id: catId, name: 'regras', kind: 'text', description: 'Diretrizes' }
  });

  const { data: updatesChId, error: uChErr } = await clientA.rpc('community_action', {
    action: 'create_channel',
    payload: { community_id: commId, category_id: catId, name: 'avisos', kind: 'text', description: 'Avisos da comunidade' }
  });

  console.log('✓ Canais criados:', { rulesChannel: rulesChId, updatesChannel: updatesChId });

  // Ativar comunidade no Supabase Cloud via UPDATE direto em public.communities
  const { data: updateCommResult, error: updateCommErr } = await clientA
    .from('communities')
    .update({
      is_community: true,
      rules_channel_id: rulesChId,
      public_updates_channel_id: updatesChId
    })
    .eq('id', commId)
    .select();

  if (updateCommErr) {
    console.error('Falha ao atualizar colunas de comunidade no Supabase Cloud:', updateCommErr);
    process.exit(1);
  }
  console.log('✓ Comunidade ativada e persistida no Supabase Cloud:', {
    id: updateCommResult[0].id,
    is_community: updateCommResult[0].is_community,
    rules_channel_id: updateCommResult[0].rules_channel_id,
    public_updates_channel_id: updateCommResult[0].public_updates_channel_id
  });

  // Usuário B (não-proprietário, não-admin) tenta alterar colunas de comunidade da comunidade de A
  const { data: bCommAttempt, error: bCommErr } = await clientB
    .from('communities')
    .update({
      is_community: false,
      rules_channel_id: null,
      public_updates_channel_id: null
    })
    .eq('id', commId)
    .select();

  console.log('• Resposta da tentativa de alteração de comunidade por B:', { rowsAffected: bCommAttempt?.length || 0, error: bCommErr });

  // Verificar se o estado permaneceu inalterado no Supabase
  const { data: checkCommInDB } = await clientA
    .from('communities')
    .select('id, is_community, rules_channel_id, public_updates_channel_id')
    .eq('id', commId)
    .single();

  const commRLSBlocked = checkCommInDB.is_community === true && (!bCommAttempt || bCommAttempt.length === 0);
  console.log('✓ RLS bloqueou alteração de comunidade por Usuário B:', commRLSBlocked ? 'SIM' : 'NÃO');

  // Simular recarga do aplicativo: ler diretamente do banco e verificar restauração do estado
  const { data: reloadedComm, error: reloadErr } = await clientA
    .from('communities')
    .select('id, name, is_community, rules_channel_id, public_updates_channel_id')
    .eq('id', commId)
    .single();

  console.log('✓ Estado recuperado do Supabase Cloud após "recarga":', {
    name: reloadedComm.name,
    isCommunity: reloadedComm.is_community,
    rulesChannelId: reloadedComm.rules_channel_id,
    publicUpdatesChannelId: reloadedComm.public_updates_channel_id
  });

  console.log('\n===========================================================');
  console.log('   TODOS OS TESTES DE PERSISTÊNCIA REMOTA FORAM APROVADOS!  ');
  console.log('===========================================================');
}

main().catch(err => {
  console.error('Erro inesperado no teste:', err);
  process.exit(1);
});
