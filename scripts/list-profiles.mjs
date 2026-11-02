import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const coronelSession = JSON.parse(fs.readFileSync('.cache/coronel-session.json', 'utf8'));

const client = createClient(
  'https://tfjkinffnksmiqatdhnb.supabase.co',
  'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q',
  {
    global: {
      headers: {
        Authorization: `Bearer ${coronelSession.access_token}`
      }
    }
  }
);

const { data: profiles, error } = await client.from('profiles').select('*');
if (error) {
  console.error('Error:', error);
} else {
  console.log('Total profiles:', profiles.length);
  for (const p of profiles) {
    console.log(`- ${p.id} | ${p.username} | ${p.display_name}`);
  }
}
