import { createClient } from '@supabase/supabase-js';

async function test() {
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
  const client = createClient('https://tfjkinffnksmiqatdhnb.supabase.co', 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q', {
    global: { headers: { Authorization: 'Bearer ' + token } }
  });

  console.log('Querying dm_calls in DB...');
  const { data: calls, error: callsErr } = await client.from('dm_calls').select('*');
  console.log('Calls count:', calls?.length, callsErr);
  if (calls && calls.length > 0) {
    for (const call of calls) {
      console.log('Call row:', {
        id: call.id,
        conversation_id: call.conversation_id,
        caller_id: call.caller_id,
        receiver_id: call.receiver_id,
        status: call.status,
        call_type: call.call_type,
        room_name: call.room_name,
      });

      console.log('Testing can_join_dm_call for Coronel...');
      const { data: allowed, error: permErr } = await client.rpc('can_join_dm_call', { call_id: call.id });
      console.log('can_join_dm_call result:', allowed, permErr);
    }
  } else {
    console.log('No calls in dm_calls yet.');
  }
}

test().catch(console.error);
