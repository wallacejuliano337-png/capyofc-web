import http from 'http';

async function main() {
  const cdpList = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const page = cdpList.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === msgId) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      const { supabase } = await import('/src/lib/supabase.ts');
      const { data: sess } = await supabase.auth.getSession();
      const { data: comms, error: cErr } = await supabase.from('communities').select('*');
      const { data: members, error: mErr } = await supabase.from('community_members').select('*');
      const { data: profile, error: pErr } = await supabase.from('profiles').select('*').eq('id', sess?.session?.user?.id).single();
      return {
        hasUser: !!sess?.session?.user,
        userId: sess?.session?.user?.id,
        userEmail: sess?.session?.user?.email,
        comms,
        cErr,
        membersCount: members ? members.length : 0,
        mErr,
        profile,
        pErr
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Result from Electron Supabase query:', JSON.stringify(res.result.value, null, 2));
  ws.close();
}

main().catch(console.error);
