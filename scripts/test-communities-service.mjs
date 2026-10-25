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
      const mod = await import('/src/services/communities.ts');
      const { supabase } = await import('/src/lib/supabase.ts');
      const { data: memberRows, error: mErr } = await supabase.from('community_members').select('*').is('left_at', null);
      return {
        memberRows,
        mErr
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Result of community_members query:', JSON.stringify(res.result.value, null, 2));
  ws.close();
}

main().catch(console.error);
