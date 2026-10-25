async function main() {
  const targets = await fetch('http://localhost:9222/json').then(r => r.json());
  const page = targets.find(t => t.url && t.url.includes('5173'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onopen = () => {
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `Array.from(document.querySelectorAll('aside h3')).map(el => el.innerText.trim())`,
        returnByValue: true
      }
    }));
  };
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    console.log('Aside H3 headers:', data.result?.result?.value);
    ws.close();
  };
}
main().catch(console.error);
