async function run() {
  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 1;
  function send(method, params = {}) {
    return new Promise(resolve => {
      const curId = id++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === curId) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }
  const evalRes = await send('Runtime.evaluate', {
    expression: '({ title: document.title, location: window.location.href, peerName: document.querySelector(".dm-peer-name")?.textContent, voiceBtn: Boolean(document.querySelector(".voice-call-btn")) })',
    returnByValue: true
  });
  console.log('App state:', evalRes.result?.value);
  ws.close();
}
run().catch(console.error);
