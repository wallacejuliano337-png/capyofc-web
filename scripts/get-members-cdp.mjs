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
      const timer = setTimeout(() => reject(new Error('Timeout on ' + method)), 8000);
      const handler = (evt) => {
        const msg = JSON.parse(evt.data.toString());
        if (msg.id === msgId) {
          clearTimeout(timer);
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  // Evaluate the store's communityMembers and query supabase profiles directly
  const evalRes = await send('Runtime.evaluate', {
    expression: `(async () => {
      // 1. Get from window or store
      const state = window.__DISCORD_STORE__ ? window.__DISCORD_STORE__.getState() : null;
      // Or query via localStorage token
      let authKey = null;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.includes('auth-token') || k.includes('supabase')) {
          authKey = k;
          break;
        }
      }
      const rawSession = authKey ? localStorage.getItem(authKey) : null;
      const session = rawSession ? JSON.parse(rawSession) : null;

      // Fetch profiles directly using the fetch API with session access_token
      let profiles = null;
      let profilesError = null;
      if (session?.access_token) {
        try {
          const res = await fetch('https://tfjkinffnksmiqatdhnb.supabase.co/rest/v1/profiles?select=*', {
            headers: {
              'apikey': 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q',
              'Authorization': 'Bearer ' + session.access_token
            }
          });
          profiles = await res.json();
        } catch (e) {
          profilesError = e.message;
        }
      }

      return {
        sessionUser: session?.user ? { id: session.user.id, email: session.user.email } : null,
        profilesCount: profiles ? profiles.length : null,
        profiles,
        profilesError,
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  console.log('Result from renderer:', JSON.stringify(evalRes.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
