import { getActiveCdpToken } from './get-active-session.mjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tfjkinffnksmiqatdhnb.supabase.co';
const SUPABASE_ANON = 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q';

async function main() {
  const token = await getActiveCdpToken();
  const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }
  });
  const commId = 'd3f2173f-79f0-4362-b60a-ad079f724b54';

  const { data: members, count, error: mErr } = await client
    .from('community_members')
    .select('user_id, left_at', { count: 'exact' })
    .eq('community_id', commId)
    .is('left_at', null);

  console.log('community_members count:', count, 'error:', mErr);
  console.log('member user_ids:', members?.map(m => m.user_id));

  const userIds = members?.map(m => m.user_id) || [];
  const { data: presence, error: pErr } = await client
    .from('user_presence')
    .select('user_id, status, expires_at')
    .in('user_id', userIds);

  console.log('user_presence rows:', presence, 'error:', pErr);

  const now = Date.now();
  const onlineCount = (presence || []).filter(p => {
    return p.status === 'online' && p.expires_at && Date.parse(p.expires_at) > now;
  }).length;

  console.log('Real calculated onlineCount:', onlineCount);
}

main().catch(console.error);
