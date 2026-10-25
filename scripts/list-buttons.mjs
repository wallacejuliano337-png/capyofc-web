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
  const evalJs = (expr) => new Promise((resolve) => {
    const msgId = id++;
    ws.send(JSON.stringify({ id: msgId, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    const h = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === msgId) {
        console.log('DEBUG MSG:', JSON.stringify(msg));
        ws.removeEventListener('message', h);
        resolve(msg.result?.result?.value);
      }
    };
    ws.addEventListener('message', h);
  });

  await evalJs('window.__DISCORD_STORE__.getState().openServerSettings("invites")');
  await new Promise(r => setTimeout(r, 600));

  const info = await evalJs(`(() => {
    return {
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.replace(/\\s+/g, ' ').trim()),
      h1_h2: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim()),
    };
  })()`);

  console.log('INFO:', JSON.stringify(info, null, 2));
  ws.close();
}

main().catch(console.error);
