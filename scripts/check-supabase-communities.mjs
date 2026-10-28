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

const client = createClient(
  'https://tfjkinffnksmiqatdhnb.supabase.co',
  'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q',
  { global: { headers: { Authorization: `Bearer ${validJwt}` } } }
);

async function testCommunityCreate() {
  console.log('\n--- TESTING COMMUNITY CREATE WITH USER JWT ---');
  const { data: newCommId, error: createErr } = await client.rpc('community_action', {
    action: 'create',
    payload: { name: 'Comunidade Teste Supabase' }
  });

  if (createErr) {
    console.error('Error creating community:', createErr);
    return;
  }
  console.log('Created community ID:', newCommId);

  // Check roles created by trigger
  const { data: roles, error: rErr } = await client
    .from('community_roles')
    .select('*')
    .eq('community_id', newCommId);
  console.log('Roles created in new community:', roles?.length, roles?.map(r => ({ id: r.id, name: r.name, base: r.base_role, pos: r.position })));

  // Check membership
  const { data: members, error: mErr } = await client
    .from('community_members')
    .select('*')
    .eq('community_id', newCommId);
  console.log('Membership in new community:', members);

  // Check user permissions in new community
  const { data: perms, error: pErr } = await client.rpc('my_community_permissions', { community_id: newCommId });
  console.log('My permissions in new community:', perms);

  // Test creating an invite
  const { data: inviteRes, error: invErr } = await client.rpc('community_action', {
    action: 'create_invite',
    payload: { community_id: newCommId }
  });
  console.log('Create invite result:', inviteRes, invErr);

  // Delete test community to keep DB clean
  console.log('Cleaning up test community...');
  const { data: delRes, error: delErr } = await client.rpc('community_action', {
    action: 'delete',
    payload: { community_id: newCommId }
  });
  console.log('Delete result:', delRes, delErr);
}

testCommunityCreate().catch(console.error);
