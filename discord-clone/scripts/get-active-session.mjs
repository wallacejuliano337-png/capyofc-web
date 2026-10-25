export async function getActiveCdpToken() {
  try {
    const targets = await fetch('http://localhost:9222/json').then(r => r.json());
    const page = targets.find(t => t.url && t.url.includes('5173'));
    if (!page || !page.webSocketDebuggerUrl) return null;

    return new Promise((resolve) => {
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      const timeout = setTimeout(() => {
        try { ws.close(); } catch {}
        resolve(null);
      }, 3000);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: `(() => {
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k.includes('sb-') || k.includes('auth-token') || k.includes('supabase')) {
                  return localStorage.getItem(k);
                }
              }
              return null;
            })()`,
            returnByValue: true
          }
        }));
      };

      ws.onmessage = (msg) => {
        clearTimeout(timeout);
        try {
          const data = JSON.parse(msg.data);
          if (data.id === 1) {
            const raw = data.result?.result?.value;
            ws.close();
            if (!raw) return resolve(null);
            const parsed = JSON.parse(raw);
            const token = parsed.access_token || parsed.currentSession?.access_token || parsed[0]?.access_token;
            resolve(token || null);
          }
        } catch {
          resolve(null);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

if (process.argv[1]?.endsWith('get-active-session.mjs')) {
  getActiveCdpToken().then(t => {
    if (t) {
      const p = JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString());
      console.log('Got active token! User:', p.sub, 'Expires:', new Date(p.exp * 1000).toISOString());
    } else {
      console.log('No active CDP token found.');
    }
  });
}
