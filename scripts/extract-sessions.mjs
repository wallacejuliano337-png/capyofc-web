import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const client = createClient(
  'https://tfjkinffnksmiqatdhnb.supabase.co',
  'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q'
);

function findRefreshTokens(dir) {
  const tokens = [];
  if (!fs.existsSync(dir)) return tokens;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.ldb') || f.endsWith('.log')) {
      const s = fs.readFileSync(path.join(dir, f), 'utf8');
      const regex = /"refresh_token"\s*:\s*"([^"]+)"/g;
      let m;
      while ((m = regex.exec(s)) !== null) {
        tokens.push(m[1]);
      }
    }
  }
  return tokens;
}

async function testDir(name, dir) {
  console.log(`\n=== Testing ${name}: ${dir} ===`);
  const tokens = findRefreshTokens(dir);
  console.log(`Found ${tokens.length} refresh tokens`);
  for (const t of tokens.reverse()) {
    try {
      const { data, error } = await client.auth.refreshSession({ refresh_token: t });
      if (data?.session) {
        console.log(`[SUCCESS] Authenticated as: ${data.user.email} (id: ${data.user.id})`);
        console.log(`Username: ${data.user.user_metadata?.username || data.user.user_metadata?.display_name}`);
        return data.session;
      }
    } catch (e) {
      // ignore
    }
  }
  console.log(`[FAILED] No valid refresh token for ${name}`);
  return null;
}

const appDataDir = path.join(process.env.APPDATA, 'capychat/session/Local Storage/leveldb');
const cacheDir1 = path.resolve('.cache/user-data/session/Local Storage/leveldb');
const cacheDir2 = path.resolve('.cache/user-data-account2-ZcFVtj/session/Local Storage/leveldb');

const coronelSession = await testDir('Coronel (AppData)', appDataDir);
const cache1Session = await testDir('Cache User-Data 1', cacheDir1);
const cache2Session = await testDir('Cache User-Data 2', cacheDir2);

if (coronelSession) {
  fs.writeFileSync('.cache/coronel-session.json', JSON.stringify(coronelSession, null, 2));
}
if (cache2Session) {
  fs.writeFileSync('.cache/naori-session.json', JSON.stringify(cache2Session, null, 2));
}
