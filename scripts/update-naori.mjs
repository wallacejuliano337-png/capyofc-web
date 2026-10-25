import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
if (jwt) await client.auth.setSession({ access_token: jwt, refresh_token: refreshToken });
const { data, error } = await client.from('profiles').update({ username: 'naori' }).eq('id', '96dde735-f6d8-4aaf-abd7-0176e44888f2').select();
console.log('Update result:', data, error);
