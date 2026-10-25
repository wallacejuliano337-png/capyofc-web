import http from 'http';

async function getWsUrl() {
  const cdpList = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
  const page = cdpList.find(t => t.type === 'page');
  return page.webSocketDebuggerUrl;
}

async function main() {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      const timer = setTimeout(() => reject(new Error(`Timeout on ${method}`)), 15000);
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === msgId) {
          clearTimeout(timer);
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  // Clear left_servers and restore mock servers for user manual testing
  await send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.removeItem('lyc_left_servers');
      localStorage.removeItem('lyc_servers_state');
      const store = window.__discordStore;
      if (store) {
        store.getState().closeMemberPopout();
      }
    })()`
  });
  await send('Page.reload');
  console.log('App reloaded and ready for user manual testing!');
  ws.close();
}

main().catch(console.error);
