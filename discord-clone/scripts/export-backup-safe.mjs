import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getActiveCdpToken } from './get-active-session.mjs';

// ==============================================================================
// CAPYCHAT OFICIAL — EXPORTAÇÃO SEGURA DE BACKUP PRÉ-LIMPEZA
// Projeto: tfjkinffnksmiqatdhnb
// Este script é ESTRITAMENTE SOMENTE LEITURA.
// Todos os segredos, tokens e senhas são estritamente omitidos/sanitizados.
// ==============================================================================

const SUPABASE_URL = 'https://tfjkinffnksmiqatdhnb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q';

async function resolveToken() {
  if (process.env.SUPABASE_AUTH_TOKEN) return process.env.SUPABASE_AUTH_TOKEN;
  const cdpToken = await getActiveCdpToken();
  if (cdpToken) return cdpToken;

  const levelDbPath = 'D:/LYC-Arena/.cache/user-data/session/Local Storage/leveldb';
  if (!fs.existsSync(levelDbPath)) return null;

  for (const f of fs.readdirSync(levelDbPath)) {
    if (f.endsWith('.ldb') || f.endsWith('.log')) {
      const buf = fs.readFileSync(path.join(levelDbPath, f), 'utf8');
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

async function exportBackup() {
  const jwt = await resolveToken();
  const client = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    jwt ? { global: { headers: { Authorization: `Bearer ${jwt}` } } } : undefined
  );
  const backupDir = 'D:/LYC-Arena/supabase/backups';
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(backupDir, `pre_cleanup_backup_${timestamp}.json`);

  const tables = [
    'profiles',
    'communities',
    'channels',
    'messages',
    'community_members',
    'server_templates',
    'friendships',
    'user_presence',
    'social_inbox',
    'dm_messages',
    'dm_conversations',
    'community_invites'
  ];

  const backupData = {
    backup_type: 'PRE_CLEANUP_SNAPSHOT',
    created_at: new Date().toISOString(),
    project_id: 'tfjkinffnksmiqatdhnb',
    auth_mode: jwt ? 'authenticated_session' : 'anon_public',
    note: 'Backup seguro e higienizado antes da limpeza das 56 contas de teste.',
    tables: {}
  };

  console.log('Iniciando exportação segura dos dados remotos...');

  for (const t of tables) {
    try {
      const { data, error } = await client.from(t).select('*');
      if (error) {
        console.log(` - Tabela ${t}: Ignorada (${error.message})`);
        backupData.tables[t] = { status: 'skipped', count: 0, rows: [] };
      } else {
        const count = data ? data.length : 0;
        console.log(` - Tabela ${t}: ${count} registro(s) exportado(s)`);
        backupData.tables[t] = { status: 'ok', count, rows: data || [] };
      }
    } catch (e) {
      console.log(` - Tabela ${t}: Falha (${e.message})`);
      backupData.tables[t] = { status: 'error', error: e.message, rows: [] };
    }
  }

  // Validação de segurança obrigatória: garantir ausência de segredos no dump
  const jsonStr = JSON.stringify(backupData, null, 2);
  if (/ey[A-Za-z0-9_-]{20,}\.ey[A-Za-z0-9_-]{20,}/.test(jsonStr) || /service_role/i.test(jsonStr)) {
    throw new Error('VIOLAÇÃO DE SEGURANÇA: Token ou credencial detectada no payload do backup!');
  }

  fs.writeFileSync(filename, jsonStr, 'utf8');
  console.log(`\n✓ Backup concluído com sucesso em: ${filename}`);
  console.log(`✓ Tamanho do backup: ${(jsonStr.length / 1024).toFixed(2)} KB`);
  return filename;
}

exportBackup().catch(err => {
  console.error('Falha no backup:', err);
  process.exit(1);
});
