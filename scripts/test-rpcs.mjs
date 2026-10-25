import { createClient } from '@supabase/supabase-js';

async function testRPCs() {
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
  const evalToken = await send('Runtime.evaluate', {
    expression: 'localStorage.getItem("sb-tfjkinffnksmiqatdhnb-auth-token")',
    returnByValue: true,
  });
  ws.close();
  const session = JSON.parse(evalToken.result.value);
  const token = session.access_token;
  const client = createClient('https://tfjkinffnksmiqatdhnb.supabase.co', 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q', {
    global: { headers: { Authorization: 'Bearer ' + token } }
  });

  for (const name of ['social_action', 'presence_action', 'dm_inbox', 'community_action', 'community_admin_action', 'call_action', 'can_join_dm_call']) {
    const res = await client.rpc(name, {});
    console.log(name, '-> code:', res.error?.code, '| msg:', res.error?.message?.slice(0, 100));
  }
}
testRPCs().catch(console.error);
