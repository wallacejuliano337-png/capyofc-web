import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('D:/LYC-Arena/.env', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
});

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

const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q';
const client = createClient(env.VITE_SUPABASE_URL || 'https://tfjkinffnksmiqatdhnb.supabase.co', supabaseKey);

if (jwt) {
  const res = await client.auth.setSession({ access_token: jwt, refresh_token: refreshToken });
  console.log('Logged in as user:', res.data?.user?.id, res.data?.user?.email);
}
const { data, error } = await client.from('profiles').select('id, username, display_name, avatar_url');
console.log('Profiles:', data);
if (error) console.error('Error:', error);

const { data: friendships, error: fErr } = await client.from('friendships').select('*');
console.log('Friendships:', friendships, fErr);

const { data: blocks, error: bErr } = await client.from('user_blocks').select('*');
console.log('Blocks:', blocks, bErr);
