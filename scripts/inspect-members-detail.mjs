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
          const items = Array.from(document.querySelectorAll('aside [role="button"], aside div.group'));
          return items.map(el => {
            const nameEl = el.querySelector('span.font-semibold, span.font-medium');
            const subEl = el.querySelector('span.text-xs, p.text-xs');
            return {
              name: nameEl ? nameEl.innerText : el.innerText.split('\\n')[0],
              sub: subEl ? subEl.innerText : null
            };
          }).filter(x => x.name);
        })()`,
        returnByValue: true
      }
    }));
  };
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    console.log('Members in sidebar:', JSON.stringify(data.result?.result?.value, null, 2));
    ws.close();
  };
}
main().catch(console.error);
