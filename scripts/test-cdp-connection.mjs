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

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    console.log('Received message:', JSON.stringify(msg).substring(0, 300));
  };

  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: 'location.href' } }));

  await new Promise(r => setTimeout(r, 2000));
  ws.close();
}

main().catch(console.error);
