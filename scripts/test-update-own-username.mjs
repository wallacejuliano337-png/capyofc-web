import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const levelDbPath = 'D:/LYC-Arena/.cache/user-data/session/Local Storage/leveldb';
let jwt = null;
let refreshToken = null;
if (fs.existsSync(levelDbPath)) {
  const files = ['000008.log', ...fs.readdirSync(levelDbPath)];
  for (const f of files) {
    if (f.endsWith('.ldb') || f.endsWith('.log')) {
      const buf = fs.readFileSync(levelDbPath + '/' + f, 'utf8');
      const idx = buf.lastIndexOf('access_token');
      if (idx !== -1) {
        const slice = buf.slice(idx, idx + 3000);
        const match = slice.match(/ey[A-Za-z0-9_-]+\.ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
        const refMatch = slice.match(/"refresh_token"\s*:\s*"([^"]+)"/) || slice.match(/refresh_token[^\w]+([A-Za-z0-9_-]{20,})/);
        if (match) {
          jwt = match[0];
          if (refMatch) refreshToken = refMatch[1];
          break;
        }
      }
    }
  }
}

const client = createClient('https://tfjkinffnksmiqatdhnb.supabase.co', 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q');
if (jwt) await client.auth.setSession({ access_token: jwt, refresh_token: refreshToken });

const { data, error } = await client.from('profiles').update({ username: 'lycdev' }).eq('id', 'f8fcd139-cf43-4873-bd7d-a807ecd73567').select();
console.log('Update own profile result:', data, error);
