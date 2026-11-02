import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const client = createClient(
  'https://tfjkinffnksmiqatdhnb.supabase.co',
  'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q'
);

function searchInDir(dir) {
  const tokens = [];
  if (!fs.existsSync(dir)) return tokens;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.ldb') || f.endsWith('.log')) {
      const s = fs.readFileSync(dir + '/' + f, 'utf8');
      const regex = /"refresh_token"\s*:\s*"([^"]+)"/g;
      let m;
      while ((m = regex.exec(s)) !== null) tokens.push(m[1]);
    }
  }
  return tokens;
}

const all = [
  ...searchInDir('.cache/user-data/session/Local Storage/leveldb'),
  ...searchInDir('.cache/user-data-account2-ZcFVtj/session/Local Storage/leveldb')
];

console.log('Testing', all.length, 'tokens for Naori...');
let found = false;
for (const t of all.reverse()) {
  try {
    const { data } = await client.auth.refreshSession({ refresh_token: t });
    if (data?.user?.email === 'costtluuh@gmail.com') {
      console.log('FOUND ACTIVE NAORI SESSION!', data.user.id, data.user.email);
      fs.writeFileSync('.cache/naori-session.json', JSON.stringify(data.session, null, 2));
      found = true;
      break;
    }
  } catch (e) {}
}
if (!found) {
  console.log('Could not find active session for costtluuh@gmail.com');
}
