import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const buf = fs.readFileSync('D:/LYC-Arena/.cache/user-data-account2-ZcFVtj/session/Local Storage/leveldb/000004.log', 'utf8');
const regex = /"refresh_token"\s*:\s*"([^"]+)"/g;
let m;
const tokens = [];
while ((m = regex.exec(buf)) !== null) {
  tokens.push(m[1]);
}
console.log('All Naori refresh tokens found:', tokens);

const client = createClient('https://tfjkinffnksmiqatdhnb.supabase.co', 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q');

for (const t of tokens.reverse()) {
  const { data, error } = await client.auth.refreshSession({ refresh_token: t });
  if (data?.session) {
    console.log('SUCCESS! Active session for Naori:', data.user.id, data.user.email);
    console.log('New access token:', data.session.access_token);
    fs.writeFileSync('D:/LYC-Arena/.cache/naori-token.json', JSON.stringify(data.session));
    break;
  } else {
    console.log('Failed for token:', t, error?.message);
  }
}
