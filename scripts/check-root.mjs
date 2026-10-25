async function main() {
  const targets = await fetch('http://localhost:9222/json').then(r => r.json());
  const page = targets.find(t => t.url && t.url.includes('5173'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onopen = () => {
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => {
          const root = document.getElementById('root');
          return {
            hasRoot: !!root,
            rootChildren: root ? root.children.length : 0,
            textSample: document.body.innerText.slice(0, 200),
            htmlSample: root ? root.innerHTML.slice(0, 200) : ''
          };
        })()`,
        returnByValue: true
      }
    }));
  };
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    console.log('DOM check:', data.result?.result?.value);
    ws.close();
  };
}
main().catch(console.error);
