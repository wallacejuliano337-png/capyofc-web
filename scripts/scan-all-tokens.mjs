import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const client = createClient(
  'https://tfjkinffnksmiqatdhnb.supabase.co',
  'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q'
);

const dirs = [
  path.join(process.env.APPDATA, 'capychat/session/Local Storage/leveldb'),
  path.resolve('.cache/user-data/session/Local Storage/leveldb'),
  path.resolve('.cache/user-data-account2-ZcFVtj/session/Local Storage/leveldb'),
  path.resolve('.cache/packaged-user-data/session/Local Storage/leveldb'),
  path.resolve('.cache/packaged-test-user-data/session/Local Storage/leveldb')
];

const foundSessions = new Map();

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.ldb') || f.endsWith('.log')) {
      const s = fs.readFileSync(path.join(dir, f), 'utf8');
      const regex = /"refresh_token"\s*:\s*"([^"]+)"/g;
      let m;
      while ((m = regex.exec(s)) !== null) {
        const token = m[1];
        if (!foundSessions.has(token)) {
          try {
            const { data, error } = await client.auth.refreshSession({ refresh_token: token });
            if (data?.session) {
              console.log(`[VALID SESSION] Email: ${data.user.email} | ID: ${data.user.id} | Metadata:`, data.user.user_metadata);
              foundSessions.set(data.user.id, data.session);
            }
          } catch (e) {}
        }
      }
    }
  }
}

console.log(`\nTotal unique active accounts found: ${foundSessions.size}`);
for (const [id, sess] of foundSessions.entries()) {
  console.log(`- ${sess.user.email} (${id})`);
}
