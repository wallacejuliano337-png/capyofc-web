async function main() {
  const targets = await fetch('http://localhost:9222/json').then(r => r.json());
  const page = targets.find(t => t.url && t.url.includes('5173'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  const errors = [];
  ws.onopen = () => {
    ws.send(JSON.stringify({ id: 1, method: 'Log.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 3,
        method: 'Page.navigate',
        params: { url: 'http://127.0.0.1:5173/' }
      }));
    }, 200);
  };

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.method === 'Runtime.exceptionThrown') {
      console.log('Exception:', JSON.stringify(data.params.exceptionDetails, null, 2));
    }
    if (data.method === 'Log.entryAdded') {
      console.log('Log:', data.params.entry);
    }
  };

  setTimeout(() => {
    ws.close();
  }, 3000);
}
main().catch(console.error);
