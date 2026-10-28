async function test() {
  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page' || t.title === 'CapyChat');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (method, params = {}) => new Promise(res => {
    const i = id++;
    const h = evt => {
      const m = JSON.parse(evt.data);
      if (m.id === i) { ws.removeEventListener('message', h); res(m.result); }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const res = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
  console.log('Location:', res.result?.value);
  const titles = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
  console.log('Title:', titles.result?.value);
  const root = await send('Runtime.evaluate', { expression: 'document.getElementById("root") ? document.getElementById("root").innerHTML.substring(0, 300) : "no root"', returnByValue: true });
  console.log('Root:', root.result?.value);
  ws.close();
}
test();
