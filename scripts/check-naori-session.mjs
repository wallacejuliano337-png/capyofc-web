import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const levelDbPath = 'D:/LYC-Arena/.cache/user-data-account2-ZcFVtj/session/Local Storage/leveldb';
let jwt = null;
let refreshToken = null;

if (fs.existsSync(levelDbPath)) {
  const files = fs.readdirSync(levelDbPath);
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
          console.log('Found Naori JWT in', f);
          const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
          console.log('User id:', payload.sub);
          console.log('User email:', payload.email);
          console.log('Expiration:', new Date(payload.exp * 1000).toISOString());
          console.log('Expired?', Date.now() > payload.exp * 1000);
          if (refMatch) {
            refreshToken = refMatch[1];
            console.log('Found refresh token:', refMatch[1].slice(0, 15) + '...');
          }
          break;
        }
      }
    }
  }
}

if (jwt) {
  const client = createClient('https://tfjkinffnksmiqatdhnb.supabase.co', 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q');
  const res = await client.auth.setSession({ access_token: jwt, refresh_token: refreshToken });
  console.log('Logged in as Naori:', res.data?.user?.id, res.data?.user?.email);
  if (res.data?.session) {
    console.log('Session refreshed successfully! Updating Naori username to naori...');
    const { data: updateData, error: updateError } = await client.from('profiles').update({ username: 'naori' }).eq('id', res.data.user.id).select();
    console.log('Naori username update result:', updateData, updateError);
  }
}
