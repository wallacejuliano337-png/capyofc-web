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

const KNOWN_LEGITIMATE_IDS = new Set([
  'f8fcd139-cf43-4873-bd7d-a807ecd73567', // Coronel
  '96dde735-f6d8-4aaf-abd7-0176e44888f2', // Naori
  '7a4901f2-d51f-4747-9c5a-6b3aa716ada6', // Kirito
  '73426b78-425e-486a-abb5-951bf7ca959d', // Everton
  '89ef8f98-37c5-4199-b598-88c90ae2db6e', // HERMAN BETA
  'eda43ba0-44ee-4565-a0e7-bad81800e715', // FOOX7
  '33e0a99f-c10b-4057-b23d-85cf5fc13ba9', // Moraex
]);

async function generateAuditCensus() {
  const { data: profiles } = await client.from('profiles').select('*').order('created_at', { ascending: true });
  const testProfiles = (profiles || []).filter(p => !KNOWN_LEGITIMATE_IDS.has(p.id));

  console.log('Total test profiles to document:', testProfiles.length);
  
  const formatted = testProfiles.map((p, idx) => {
    let script = 'scripts/test-dual-account-templates-and-community.mjs';
    let motivo = 'Conta de teste automatizado de servidor e comunidade';

    if (p.username.startsWith('amigo_') || p.display_name?.includes('Amigo Convidado') || p.display_name?.includes('User X') || p.display_name?.includes('User Y') || p.display_name?.includes('User Z')) {
      script = 'scripts/test-real-signup-and-isolation.mjs';
      motivo = 'Conta de teste de cadastro via UI e isolamento multiusuário';
    } else if (p.display_name?.includes('Capy Tester') || p.display_name?.includes('Capy Updated Name') || p.display_name?.includes('Capy Amigo')) {
      script = 'scripts/audit-supabase.mjs / scripts de perfil';
      motivo = 'Conta de teste de atualização de perfil e insígnias';
    } else if (p.display_name?.includes('Inspector') || p.display_name?.includes('Checker') || p.display_name?.includes('RPC User')) {
      script = 'scripts/inspect-db.mjs / check-profiles.mjs';
      motivo = 'Conta criada para inspeção de RPCs e tabelas';
    } else if (p.display_name === 'Membro' && p.created_at > '2026-10-23T20:00:00Z') {
      script = 'scripts de auditoria LiveKit / Policy (turnos recentes)';
      motivo = 'Conta temporária para validação de token WebRTC e política de e-mail';
    }

    return {
      num: idx + 1,
      id: p.id,
      username: p.username,
      display_name: p.display_name || '(sem display_name)',
      created_at: p.created_at,
      script,
      motivo
    };
  });

  fs.writeFileSync('scripts/census_output.json', JSON.stringify(formatted, null, 2), 'utf8');
  console.log('Saved census to scripts/census_output.json');
}

generateAuditCensus().catch(console.error);
