import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

const env = dotenv.parse(fs.readFileSync('.env'));
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  const { data: profiles, error: pErr } = await client.from('profiles').select('*');
  console.log(`=== PROFILES (${profiles?.length || 0}) ===`);
  if (profiles) {
    for (const p of profiles) {
      console.log(`[PROFILE] ID: ${p.id} | username: ${p.username} | display_name: ${p.display_name} | created: ${p.created_at}`);
    }
  } else {
    console.error('Error fetching profiles:', pErr);
  }

  const { data: comms, error: cErr } = await client.from('communities').select('*');
  console.log(`\n=== COMMUNITIES (${comms?.length || 0}) ===`);
  if (comms) {
    for (const c of comms) {
      console.log(`[COMMUNITY] ID: ${c.id} | name: ${c.name} | owner_id: ${c.owner_id} | is_comm: ${c.is_community} | created: ${c.created_at}`);
    }
  } else {
    console.error('Error fetching communities:', cErr);
  }

  const { data: templates, error: tErr } = await client.from('server_templates').select('*');
  console.log(`\n=== SERVER TEMPLATES (${templates?.length || 0}) ===`);
  if (templates) {
    for (const t of templates) {
      console.log(`[TEMPLATE] code: ${t.code} | name: ${t.name} | creator_id: ${t.creator_id} | uses: ${t.uses_count} | created: ${t.created_at}`);
    }
  } else {
    console.error('Error fetching templates:', tErr);
  }

  const { data: members, error: mErr } = await client.from('community_members').select('*');
  console.log(`\n=== COMMUNITY MEMBERS (${members?.length || 0}) ===`);
  if (members) {
    for (const m of members) {
      console.log(`[MEMBER] community_id: ${m.community_id} | user_id: ${m.user_id} | role: ${m.role}`);
    }
  } else {
    console.error('Error fetching members:', mErr);
  }

  const { data: friendships, error: fErr } = await client.from('friendships').select('*');
  console.log(`\n=== FRIENDSHIPS (${friendships?.length || 0}) ===`);
  if (friendships) {
    for (const f of friendships) {
      console.log(`[FRIENDSHIP] low: ${f.user_low} | high: ${f.user_high} | req: ${f.requester_id} | state: ${f.state}`);
    }
  } else {
    console.error('Error fetching friendships:', fErr);
  }
}

main().catch(console.error);
