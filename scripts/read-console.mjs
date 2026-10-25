async function main() {
  const targets = await fetch('http://localhost:9222/json').then(r => r.json());
  const page = targets.find(t => t.url && t.url.includes('5173'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ id: 1, method: 'Console.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: {
        expression: 'console.error.toString()',
      }
    }));
  };

  ws.onmessage = (e) => {
    console.log('MSG:', e.data);
  };

  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 2000);
}
main().catch(console.error);
