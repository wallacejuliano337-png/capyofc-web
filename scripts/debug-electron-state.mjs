const tokenRes = await fetch('http://127.0.0.1:9222/json');
const targets = await tokenRes.json();
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
const res = await send('Runtime.evaluate', {
  expression: 'localStorage.getItem("capychat_saved_accounts")',
  returnByValue: true
});
console.log('Saved accounts:', JSON.parse(res.result.value || '[]'));
ws.close();
