import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const levelDbPath = 'D:/LYC-Arena/.cache/user-data/session/Local Storage/leveldb';
let validJwt = null;

const files = fs.readdirSync(levelDbPath);
for (const f of files) {
  if (f.endsWith('.ldb') || f.endsWith('.log')) {
    const buf = fs.readFileSync(levelDbPath + '/' + f, 'utf8');
    const matches = buf.matchAll(/ey[A-Za-z0-9_-]+\.ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g);
    for (const m of matches) {
      try {
        const payload = JSON.parse(Buffer.from(m[0].split('.')[1], 'base64').toString());
        if (payload.exp && Date.now() < payload.exp * 1000) {
          validJwt = m[0];
          console.log(`Found active JWT for ${payload.email} (sub: ${payload.sub}) in ${f}`);
          break;
        }
      } catch (e) {}
    }
    if (validJwt) break;
  }
}

if (!validJwt) {
  console.error('No valid JWT found!');
  process.exit(1);
}

const client = createClient(
  'https://tfjkinffnksmiqatdhnb.supabase.co',
  'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q',
  {
    global: {
      headers: {
        Authorization: `Bearer ${validJwt}`
      }
    }
  }
);

async function main() {
  const { data: profiles, error } = await client
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }

  console.log(`\n======================================================`);
  console.log(`TOTAL PROFILES IN SUPABASE: ${profiles.length}`);
  console.log(`======================================================`);

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    console.log(JSON.stringify({
      index: i + 1,
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      role: p.role,
      avatar_url: p.avatar_url,
      created_at: p.created_at,
      bio: p.bio,
    }, null, 2));
  }

  // Also check communities and community_members
  const { data: coms } = await client.from('communities').select('*');
  console.log('\n=== COMMUNITIES ===', coms);

  const { data: members } = await client.from('community_members').select('*');
  console.log('\n=== COMMUNITY MEMBERS ===', members?.length);
  if (members) {
    console.log(members.map(m => ({ community_id: m.community_id, user_id: m.user_id, role: m.role })));
  }
}

main().catch(console.error);
