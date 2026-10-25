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
          console.log('Found JWT in', f);
          const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
          console.log('User id:', payload.sub);
          console.log('User email:', payload.email);
          console.log('Expiration:', new Date(payload.exp * 1000).toISOString());
          console.log('Expired?', Date.now() > payload.exp * 1000);
          if (refMatch) {
            refreshToken = refMatch[1];
            console.log('Found refresh token:', refMatch[1].slice(0, 15) + '...');
          }
          if (Date.now() < payload.exp * 1000) break;
        }
      }
    }
  }
}

if (!jwt) {
  console.log('No JWT found in leveldb.');
} else {
  const client = createClient('https://tfjkinffnksmiqatdhnb.supabase.co', 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q');
  if (refreshToken) {
    console.log('Attempting refreshSession...');
    const { data: refData, error: refErr } = await client.auth.refreshSession({ refresh_token: refreshToken });
    console.log('refreshSession result:', refData?.session ? 'SUCCESS' : 'FAILED', refErr);
    if (refData?.session) {
      jwt = refData.session.access_token;
    }
  }

  const authClient = createClient('https://tfjkinffnksmiqatdhnb.supabase.co', 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q', {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    }
  });

  console.log('Testing realtime channel with private: true...');
  const ch = authClient.channel('dm-chat:f63d00cf-c70a-4a77-bd0b-912d0cb8cef5', {
    config: { private: true }
  });
  ch.subscribe((status, err) => {
    console.log('Realtime subscribe status:', status, 'err:', err);
  });
  await new Promise(r => setTimeout(r, 2000));
  const { data: profile, error: pErr } = await authClient.from('profiles').select('*').limit(3);
  console.log('Profiles:', profile?.map(p => ({ id: p.id, name: p.display_name, username: p.username })), pErr);

  const { data: convs, error: cErr } = await authClient.from('dm_conversations').select('*');
  console.log('Conversations:', convs, cErr);

  if (convs && convs.length > 0) {
    for (const c of convs) {
      console.log('Testing dmHistory on conversation', c.id);
      try {
        const rows = [];
        let before;
        for (let page = 0; page < 1; page++) {
          let q = authClient
            .from("dm_messages")
            .select("*")
            .eq("conversation_id", c.id)
            .order("seq", { ascending: false })
            .limit(40);
          if (before !== undefined) q = q.lt("seq", before);
          const { data, error } = await q;
          if (error) throw error;
          rows.push(...data);
          if (data.length < 40) break;
          before = data[data.length - 1].seq;
        }
        console.log('dm_messages fetched successfully, count:', rows.length);

        const replyIds = [
          ...new Set(rows.flatMap((row) => (row.reply_to ? [row.reply_to] : []))),
        ];
        console.log('replyIds:', replyIds);
        const replies = new Map();
        for (let offset = 0; offset < replyIds.length; offset += 100) {
          const { data, error } = await authClient
            .from("dm_messages")
            .select("id,content,deleted_at,author_id")
            .eq("conversation_id", c.id)
            .in("id", replyIds.slice(offset, offset + 100));
          if (error) throw error;
          for (const row of data || []) replies.set(row.id, row);
        }
        console.log('replies fetched successfully, count:', replies.size);

        const messageIds = rows.map((r) => r.id);
        if (messageIds.length > 0) {
          console.log('Checking dm_message_reactions...');
          const rxRes = await authClient
            .from("dm_message_reactions")
            .select("message_id,user_id,emoji")
            .eq("conversation_id", c.id)
            .in("message_id", messageIds);
          console.log('reactions result error:', rxRes.error?.message, 'data:', rxRes.data);
        }

        console.log('dmHistory executed with 0 errors!');
      } catch (err) {
        console.error('dmHistory FAILED with error:', err);
      }
    }
  }
}
