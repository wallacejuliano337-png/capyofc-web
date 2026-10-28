import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const levelDbPath = 'D:/LYC-Arena/.cache/user-data/session/Local Storage/leveldb';
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
          if (refMatch) refreshToken = refMatch[1];
          break;
        }
      }
    }
  }
}

async function test() {
  const client = createClient('https://tfjkinffnksmiqatdhnb.supabase.co', 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q');
  if (refreshToken) {
    const { data: refData } = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (refData?.session) jwt = refData.session.access_token;
  }
  
  const authClient = createClient('https://tfjkinffnksmiqatdhnb.supabase.co', 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q', {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });

  const { data: userData } = await authClient.auth.getUser();
  console.log('Logged in user:', userData?.user?.id, userData?.user?.email);

  // Test 1: presence_action heartbeat
  const sessionId = '11111111-1111-1111-1111-111111111111';
  const { data: presRes, error: presErr } = await authClient.rpc('presence_action', {
    action: 'heartbeat',
    session_id: sessionId
  });
  console.log('presence_action heartbeat result:', presRes, presErr);

  // Check user_presence table
  const { data: checkPres } = await authClient.from('user_presence').select('*').eq('user_id', userData?.user?.id);
  console.log('user_presence row after heartbeat:', checkPres);

  // Query channels
  const { data: channels, error: chErr } = await authClient.from('channels').select('id, name, kind, category');
  console.log('Channels with auth:', channels, chErr);

  if (channels && channels.length > 0) {
    const voiceCh = channels.find(c => c.kind === 'voice') || channels[0];
    console.log('Testing Livekit for channel:', voiceCh);
    const lkRes = await fetch('https://tfjkinffnksmiqatdhnb.supabase.co/functions/v1/livekit-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        apikey: 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q',
      },
      body: JSON.stringify({ channelId: voiceCh.id }),
    });
    console.log('Livekit endpoint status:', lkRes.status);
    const lkText = await lkRes.text();
    console.log('Livekit endpoint body:', lkText);
  }
}

test().catch(console.error);
