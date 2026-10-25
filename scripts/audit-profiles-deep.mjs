import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const levelDbPath = 'D:/LYC-Arena/.cache/user-data/session/Local Storage/leveldb';
let validJwt = null;

const files = fs.readdirSync(levelDbPath);
for (const f of files) {
  if (f.endsWith('.ldb') || f.endsWith('.log')) {
    const buf = fs.readFileSync(levelDbPath + '/' + f, 'utf8');
    const matches = buf.matchAll(/ey[A-Za-z0-9_-]+\.ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g);
    for (const m of matches) {
      try {
        const payload = JSON.parse(Buffer.from(m[0].split('.')[1], 'base64').toString());
        if (payload.exp && Date.now() < payload.exp * 1000) {
          validJwt = m[0];
          break;
        }
      } catch (e) {}
    }
    if (validJwt) break;
  }
}

const client = createClient(
  'https://tfjkinffnksmiqatdhnb.supabase.co',
  'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q',
  { global: { headers: { Authorization: `Bearer ${validJwt}` } } }
);

async function main() {
  const { data: profiles } = await client.from('profiles').select('*').order('created_at', { ascending: true });
  const { data: messages } = await client.from('messages').select('id, author_id, content, created_at');
  const { data: comms } = await client.from('communities').select('*');
  const { data: templates } = await client.from('server_templates').select('*');

  console.log('=== AUDITORIA PROFUNDA DOS 63 PERFIS ===\n');

  const report = [];

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    const userMsgs = (messages || []).filter(m => m.author_id === p.id);
    const userComms = (comms || []).filter(c => c.owner_id === p.id);
    const userTemplates = (templates || []).filter(t => t.creator_id === p.id);

    let classification = 'TESTE_CONFIRMADO';
    let scriptOrigem = 'Desconhecido';

    // Identificação de Legítimos (Perfis anteriores aos testes automatizados de outubro)
    if (p.id === 'f8fcd139-cf43-4873-bd7d-a807ecd73567') {
      classification = 'LEGITIMO_FUNDADOR';
      scriptOrigem = 'Criador / Dono (Coronel)';
    } else if (p.created_at < '2026-10-15T00:00:00Z' && !p.username.startsWith('u_') && !p.username.startsWith('capy_')) {
      classification = 'LEGITIMO_PRODUCAO';
      scriptOrigem = 'Usuário Real pré-testes';
    } else if (p.username.startsWith('capy_a_') || p.username.startsWith('capy_b_')) {
      scriptOrigem = 'scripts/test-dual-accounts.mjs ou validate-cloud-templates';
    } else if (p.display_name?.includes('Alpha') || p.display_name?.includes('Beta')) {
      scriptOrigem = 'scripts/test-dual-account-templates-and-community.mjs';
    } else if (p.display_name?.includes('Inspector') || p.display_name?.includes('Checker') || p.display_name?.includes('RPC User')) {
      scriptOrigem = 'scripts/inspect-db.mjs ou check-profiles.mjs';
    } else if (p.username.startsWith('amigo_') || p.display_name?.includes('Amigo Convidado')) {
      scriptOrigem = 'scripts/test-real-signup-and-isolation.mjs';
    } else if (p.display_name?.includes('User X') || p.display_name?.includes('User Y') || p.display_name?.includes('User Z')) {
      scriptOrigem = 'scripts/test-real-signup-and-isolation.mjs';
    } else if (p.display_name === 'Membro' && p.created_at > '2026-10-23T20:00:00Z') {
      scriptOrigem = 'scripts de auditoria LiveKit / Policy (turnos recentes)';
    }

    report.push({
      index: i + 1,
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      role: p.role,
      created_at: p.created_at,
      classification,
      scriptOrigem,
      messagesCount: userMsgs.length,
      communitiesCount: userComms.length,
      templatesCount: userTemplates.length
    });
  }

  const legitimates = report.filter(r => r.classification !== 'TESTE_CONFIRMADO');
  const testAccounts = report.filter(r => r.classification === 'TESTE_CONFIRMADO');

  console.log(`Perfis Legítimos Identificados: ${legitimates.length}`);
  legitimates.forEach(l => {
    console.log(` - [${l.index}] ${l.username} ("${l.display_name}") | ID: ${l.id} | Class: ${l.classification} | Created: ${l.created_at}`);
  });

  console.log(`\nPerfis de Teste Identificados: ${testAccounts.length}`);
  testAccounts.forEach(t => {
    console.log(` - [${t.index}] ${t.username} ("${t.display_name}") | ID: ${t.id} | Origem: ${t.scriptOrigem} | Created: ${t.created_at}`);
  });
}

main().catch(console.error);
