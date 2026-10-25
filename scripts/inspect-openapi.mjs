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
  const evalToken = await send('Runtime.evaluate', {
    expression: 'localStorage.getItem("sb-tfjkinffnksmiqatdhnb-auth-token")',
    returnByValue: true,
  });
  ws.close();
  const session = JSON.parse(evalToken.result.value);
  const token = session.access_token;
  const res = await fetch('https://tfjkinffnksmiqatdhnb.supabase.co/rest/v1/?apikey=sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const json = await res.json();
  console.log('Definitions (tables/views):', Object.keys(json.definitions || {}));
  console.log('RPC Paths:', Object.keys(json.paths || {}).filter(p => p.startsWith('/rpc/')));
}
run().catch(console.error);
