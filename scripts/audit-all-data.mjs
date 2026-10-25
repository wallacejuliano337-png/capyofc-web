import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { getActiveCdpToken } from './get-active-session.mjs';

// ==============================================================================
// CAPYCHAT OFICIAL — AUDITORIA DE DADOS E INTEGRIDADE PÓS-LIMPEZA
// Supabase Cloud: tfjkinffnksmiqatdhnb
// Este script é ESTRITAMENTE SOMENTE LEITURA. Nenhuma mutação é realizada.
// Nenhum token, senha ou chave secreta é impressa ou registrada.
// ==============================================================================

const SUPABASE_URL = 'https://tfjkinffnksmiqatdhnb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q';

// 1. Registro das 7 contas legítimas protegidas
const LEGITIMATE_ACCOUNTS = [
  { id: 'f8fcd139-cf43-4873-bd7d-a807ecd73567', username: 'lycdev', expectedDisplay: 'Coronel (Fundador)', role: 'owner' },
  { id: '96dde735-f6d8-4aaf-abd7-0176e44888f2', username: 'naori', expectedDisplay: 'Naori', role: 'member' },
  { id: '7a4901f2-d51f-4747-9c5a-6b3aa716ada6', username: 'david', expectedDisplay: 'Kirito', role: 'member' },
  { id: '73426b78-425e-486a-abb5-951bf7ca959d', username: 'everton', expectedDisplay: 'Everton', role: 'member' },
  { id: '89ef8f98-37c5-4199-b598-88c90ae2db6e', username: 'hermanbeta', expectedDisplay: 'HERMAN BETA', role: 'member' },
  { id: 'eda43ba0-44ee-4565-a0e7-bad81800e715', username: 'foox7', expectedDisplay: 'FOOX7', role: 'member' },
  { id: '33e0a99f-c10b-4057-b23d-85cf5fc13ba9', username: 'moraex', expectedDisplay: 'Moraex', role: 'member' },
];

// 2. Os 56 UUIDs candidatos de teste auditados
const CANDIDATE_TEST_IDS = [
  'f724e836-be35-4d53-9fd9-4dc97ba1acb9', '52f38d7d-666e-4f0f-99c2-7d150659bb39',
  '95dbc856-1489-40f5-914d-3cbc90cbb4e6', 'a05e5ba0-f76a-4059-8d84-3721761ddd00',
  '929794e5-2a05-4fd3-a72d-618e59d7dc25', '53f5007d-a0ba-4cac-92ee-cf57992168f9',
  'f44e2be3-03cd-43e7-995a-719a49f9b012', '7b477a9a-8ab1-4ea5-9461-12efe1f67365',
  'd77517df-6a3c-401d-ad3b-6922faa5992f', 'ed69d1a7-b06c-41f6-8c55-835a7ab28b0b',
  'c542a680-42b2-413a-bf9c-83f967493cac', '8a0274f6-731a-4da9-a97d-06343229dbf7',
  '39d81d53-8d89-4f57-a65d-442a72d5e4ad', 'dc9adf11-5776-40f1-878e-abf05f472f06',
  '6c0f8eef-3549-4efe-9004-c7e321784383', '3cb43393-4cdc-4313-9ad5-79cb7605df2c',
  '610a5033-2d02-48c0-8477-e45fba6c4a84', '9b13a11b-0180-4f26-b665-23a28d58e387',
  '91738f64-fb1e-464b-abac-a9d0bf45bf33', '4cffba8e-9053-4147-8dde-05856a07c37f',
  '3e014270-244b-499b-aa6d-1607fcba4519', '2a4ae293-bb97-4e95-9f02-a44551f78fc4',
  'cae45643-956a-4f75-a8fa-d7c279cebf5f', 'a58a003b-6df2-4dda-90f5-3f9c4dcd0043',
  '06f17e89-d088-46ed-a254-cfc79217480c', '3a607ed3-ec3c-49f4-89cd-2e37fc566bb9',
  '811408b4-31cf-4b76-ad0b-d800acc9f157', 'caa4962e-b170-42ed-aafa-fa11544163de',
  '857daae0-274a-46b3-86b5-86ccb5590d1f', 'd5f11ad9-d964-4ec7-9bc6-f38a3c9d5477',
  'cb149b42-f4ff-450e-854b-5ee6bb72a161', 'ad9ffc6e-38a5-4ed3-a486-b6f6febd7a20',
  '88b43829-8bdb-4594-b52e-25d14c6d4754', '31022437-2bd6-43ec-9928-9c036d4c196d',
  '40982cea-dd0f-47d7-8a86-963bac7d4f09', '000fd306-9ad4-40dc-a04e-8e31dcdc77c2',
  '1f3fdac8-67b6-4661-8ffc-5cdd5db73cb0', '4ae28e23-67b8-4d11-8f73-bd6da4dd2c10',
  '9a01d454-06df-48fc-8b2d-614af3778d98', '5f9bbc35-e688-4e1f-b6c2-813dc3c4d14a',
  'b230b2b6-f2b2-44af-810d-2a8aa44142d6', '6df208d7-2872-434d-92c5-87124302269d',
  'e6bdce18-9987-483a-9168-3fdfd0f64942', '989cef9a-0649-4b21-b429-62d0c1716500',
  '0d080b14-b714-4193-abbe-4ea3fd8c0b52', 'ff8fea75-591b-4b5b-ac5a-69990f4e07f4',
  'd9bb15ae-30fa-4922-8ee7-0dca01b84a34', '05063ba9-db4a-423e-8329-81701e8966ce',
  '583edf45-058f-4292-b93e-d7ae4a07805d', '4e0d30c0-bc2d-401f-8bbe-3f4bf1a66c7a',
  'ff997b21-8be6-4acb-a980-ac28d8f8bb3b', '82668c61-d66c-4160-84cf-6f59236a77b5',
  'f2e463e2-a983-4511-bd16-397af49462cd', 'a8879b28-cca6-4a7b-b5c4-8e2741a0716a',
  'be75df30-9abd-45d9-91b9-f13524b4919d', '791164b0-1ca9-4e6b-9fa1-12040b1be515'
];

// 3. Recuperação segura de sessão (sem expor token)
async function resolveJwt() {
  if (process.env.SUPABASE_AUTH_TOKEN) return process.env.SUPABASE_AUTH_TOKEN;
  const cdpToken = await getActiveCdpToken();
  if (cdpToken) return cdpToken;

  const levelDbPath = 'D:/LYC-Arena/.cache/user-data/session/Local Storage/leveldb';
  if (!fs.existsSync(levelDbPath)) return null;

  const files = fs.readdirSync(levelDbPath);
  for (const f of files) {
    if (f.endsWith('.ldb') || f.endsWith('.log')) {
      const buf = fs.readFileSync(levelDbPath + '/' + f, 'utf8');
      const matches = buf.matchAll(/ey[A-Za-z0-9_-]+\.ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g);
      for (const m of matches) {
        try {
          const payload = JSON.parse(Buffer.from(m[0].split('.')[1], 'base64').toString());
          if (payload.exp && Date.now() < payload.exp * 1000) {
            return m[0];
          }
        } catch {}
      }
    }
  }
  return null;
}

async function main() {
  const jwt = await resolveJwt();
  const client = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    jwt ? { global: { headers: { Authorization: `Bearer ${jwt}` } } } : undefined
  );
  console.log('================================================================');
  console.log('   CAPYCHAT OFICIAL — AUDITORIA DE SEGURANÇA E DADOS REMOTOS   ');
  console.log('================================================================');
  console.log(`Projeto Supabase: ${SUPABASE_URL}`);
  console.log(`Autenticação: ${jwt ? 'Sessão ativa detectada (JWT válido ocultado)' : 'Anônima / Pública'}`);
  console.log('Nenhum dado é modificado neste procedimento.\n');

  // 1. Consulta dos perfis
  const { data: profiles, error: pErr } = await client
    .from('profiles')
    .select('id, username, display_name, role, created_at')
    .order('created_at', { ascending: true });

  if (pErr) {
    console.error('Erro ao consultar public.profiles:', pErr.message);
    process.exit(1);
  }

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
  console.log(`[1] Total de perfis em public.profiles: ${profiles.length}`);

  // 2. Verificação das 7 contas legítimas
  console.log('\n[2] Verificação das 7 Contas Legítimas Protegidas:');
  let legitFoundCount = 0;
  for (const acc of LEGITIMATE_ACCOUNTS) {
    const found = profileMap.get(acc.id);
    if (found) {
      legitFoundCount++;
      console.log(`  ✓ PRESERVADO: ${acc.id} | @${found.username} ("${found.display_name}") | role: ${found.role}`);
    } else {
      console.log(`  ✗ AUSENTE: ${acc.id} | esperado: @${acc.username}`);
    }
  }
  console.log(`  Status Contas Legítimas: ${legitFoundCount}/7 encontradas.`);

  // 3. Verificação de contas de teste remanescentes
  console.log('\n[3] Verificação de IDs de Teste Candidatos:');
  const remainingTestProfiles = profiles.filter(p => CANDIDATE_TEST_IDS.includes(p.id));
  if (remainingTestProfiles.length === 0) {
    console.log('  ✓ NENHUMA das 56 contas de teste encontradas em public.profiles. (0 remanescentes)');
  } else {
    console.log(`  ! ATENÇÃO: ${remainingTestProfiles.length} conta(s) de teste ainda constam na base:`);
    for (const tp of remainingTestProfiles) {
      console.log(`    - ID: ${tp.id} | @${tp.username} ("${tp.display_name}")`);
    }
  }

  // 4. Verificação da Comunidade Oficial
  console.log('\n[4] Integridade dos Registros Oficiais (Comunidade & Canais):');
  const { data: coms } = await client.from('communities').select('*').order('created_at', { ascending: true });
  console.log(`  Total de Comunidades: ${coms?.length || 0}`);
  for (const c of (coms || [])) {
    const isFounder = c.owner_id === LEGITIMATE_ACCOUNTS[0].id;
    console.log(`  - Comunidade: "${c.name}" (ID: ${c.id})`);
    console.log(`    Oficial: ${c.is_official} | is_community: ${c.is_community}`);
    console.log(`    Proprietário: ${c.owner_id} (${isFounder ? 'Coronel / Fundador ✓' : 'Outro'})`);
  }

  const { data: channels } = await client.from('channels').select('id, community_id, name, kind, created_at');
  console.log(`  Total de Canais Públicos: ${channels?.length || 0}`);

  // 5. Modelos de Servidor (server_templates)
  const { data: templates } = await client.from('server_templates').select('id, name, code, creator_id');
  console.log(`\n[5] Modelos de Servidor em public.server_templates: ${templates?.length || 0}`);
  const testTemplates = (templates || []).filter(t => CANDIDATE_TEST_IDS.includes(t.creator_id));
  if (testTemplates.length === 0) {
    console.log('  ✓ Nenhum modelo vinculado a contas de teste.');
  } else {
    console.log(`  ! ${testTemplates.length} modelo(s) pertencente(s) a contas de teste presentes.`);
  }

  // 6. Resumo Final
  console.log('\n================================================================');
  console.log('                        RESUMO DA AUDITORIA                     ');
  console.log('================================================================');
  console.log(`• Perfis Totais: ${profiles.length}`);
  console.log(`• Contas Legítimas Protegidas: ${legitFoundCount}/7 intactas`);
  console.log(`• Contas de Teste Remanescentes: ${remainingTestProfiles.length}`);
  console.log(`• Modelos de Servidor de Teste: ${testTemplates.length}`);
  if (legitFoundCount === 7 && remainingTestProfiles.length === 0) {
    console.log('• ESTADO DO BANCO: TOTALMENTE HIGIENIZADO E PRONTO PARA DISTRIBUIÇÃO.');
  } else if (remainingTestProfiles.length > 0) {
    console.log('• ESTADO DO BANCO: CONTAS DE TESTE AINDA PRESENTES (LIMPEZA PENDENTE DE EXECUÇÃO).');
  } else {
    console.log('• ESTADO DO BANCO: ALERTA DE DIVERGÊNCIA.');
  }
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Falha na execução da auditoria:', err);
  process.exit(1);
});
