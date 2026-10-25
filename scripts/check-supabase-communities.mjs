import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const levelDbPath = 'D:/LYC-Arena/.cache/user-data/session/Local Storage/leveldb';
let validJwt = null;

const files = fs.readdirSync(levelDbPath);
for (const f of files.reverse()) {
  if (f.endsWith('.ldb') || f.endsWith('.log')) {
    const buf = fs.readFileSync(levelDbPath + '/' + f, 'utf8');
    const matches = buf.matchAll(/ey[A-Za-z0-9_-]+\.ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g);
    for (const m of matches) {
      try {
        const payload = JSON.parse(Buffer.from(m[0].split('.')[1], 'base64').toString());
        if (payload.exp && Date.now() < payload.exp * 1000) {
          validJwt = m[0];
          console.log(`Found active JWT for ${payload.email} (sub: ${payload.sub})`);
          break;
        }
      } catch (e) {}
    }
    if (validJwt) break;
  }
}

if (!validJwt) {
  console.log('No valid JWT found in leveldb.');
  process.exit(0);
}

const client = createClient(
  'https://tfjkinffnksmiqatdhnb.supabase.co',
  'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q',
  { global: { headers: { Authorization: `Bearer ${validJwt}` } } }
);

async function main() {
  const { data: coms, error: cErr } = await client.from('communities').select('*');
  console.log('Communities in Supabase count:', coms?.length);
  if (coms) console.log(JSON.stringify(coms, null, 2));

  const { data: cm, error: cmErr } = await client.from('community_members').select('*');
  console.log('Community members in Supabase count:', cm?.length);
  if (cm) {
    console.log(JSON.stringify(cm.map(m => ({ community_id: m.community_id, user_id: m.user_id, role_id: m.role_id, left_at: m.left_at })), null, 2));
  }
}

main().catch(console.error);
