import { createClient } from '@supabase/supabase-js';

async function main() {
  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page');
  if (!pageTarget) {
    console.error('No page target');
    return;
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

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
    expression: `(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.includes('auth-token') || k.includes('supabase')) {
          return { key: k, value: localStorage.getItem(k) };
        }
      }
      return null;
    })()`,
    returnByValue: true,
  });

  console.log('LocalStorage auth item:', evalToken.result?.value?.key);
  let session = null;
  if (evalToken.result?.value?.value) {
    try {
      session = JSON.parse(evalToken.result.value.value);
    } catch (e) {
      console.error(e);
    }
  }

  if (!session) {
    console.log('No session in localStorage');
  } else {
    console.log('Session user:', session?.user?.id, session?.user?.email);
    const token = session?.access_token;
    
    // Now let's test calling supabase rpc
    const supabase = createClient('https://tfjkinffnksmiqatdhnb.supabase.co', 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q', {
      global: {
        headers: { Authorization: `Bearer ${token}` }
      }
    });

    const { data: profileData, error: profileErr } = await supabase.from('profiles').select('*');
    console.log('Profiles in DB:', profileData, profileErr);

    const { data: myUser, error: myUserErr } = await supabase.auth.getUser();
    console.log('My Auth User:', myUser?.user?.id, myUser?.user?.email, myUserErr);

    console.log('Testing call_action RPC...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('call_action', {
      action: 'get_active_call',
      payload: {}
    });
    console.log('RPC call_action result:', { rpcData, rpcError });

    console.log('Testing dm_calls table select...');
    const { data: tableData, error: tableError } = await supabase.from('dm_calls').select('*').limit(1);
    console.log('dm_calls select result:', { tableData, tableError });
  }

  ws.close();
}

main().catch(console.error);
