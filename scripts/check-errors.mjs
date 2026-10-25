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

  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Runtime.consoleAPICalled' || msg.method === 'Log.entryAdded' || msg.method === 'Runtime.exceptionThrown') {
      console.log('EVENT:', JSON.stringify(msg, null, 2));
    }
  });

  ws.send(JSON.stringify({ id: 1, method: 'Log.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
  
  // Trigger openServerSettings
  ws.send(JSON.stringify({
    id: 3,
    method: 'Runtime.evaluate',
    params: {
      expression: 'window.__DISCORD_STORE__.getState().openServerSettings("invites")',
      returnByValue: true
    }
  }));

  await new Promise(r => setTimeout(r, 2000));
  ws.close();
}

main().catch(console.error);
