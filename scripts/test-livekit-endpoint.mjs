async function testLivekitEndpoint() {
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
  console.log('Got Coronel access token. User:', session.user.id);

  // Test 1: Calling with { callId: "a0000000-0000-0000-0000-000000000000" }
  console.log('\n--- TEST 1: { callId } ---');
  const res1 = await fetch('https://tfjkinffnksmiqatdhnb.supabase.co/functions/v1/livekit-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      apikey: 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q',
    },
    body: JSON.stringify({ callId: 'a0000000-0000-0000-0000-000000000000' }),
  });
  console.log('Status 1:', res1.status);
  const body1 = await res1.text();
  console.log('Body 1:', body1);

  // Test 2: Calling with { call_id: "a0000000-0000-0000-0000-000000000000" }
  console.log('\n--- TEST 2: { call_id } ---');
  const res2 = await fetch('https://tfjkinffnksmiqatdhnb.supabase.co/functions/v1/livekit-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      apikey: 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q',
    },
    body: JSON.stringify({ call_id: 'a0000000-0000-0000-0000-000000000000' }),
  });
  console.log('Status 2:', res2.status);
  const body2 = await res2.text();
  console.log('Body 2:', body2);

  // Test 3: Calling with empty body {}
  console.log('\n--- TEST 3: {} ---');
  const res3 = await fetch('https://tfjkinffnksmiqatdhnb.supabase.co/functions/v1/livekit-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      apikey: 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q',
    },
    body: JSON.stringify({}),
  });
  console.log('Status 3:', res3.status);
  const body3 = await res3.text();
  console.log('Body 3:', body3);

  // Test 4: Calling with channelId: "a0000000-0000-0000-0000-000000000000"
  console.log('\n--- TEST 4: { channelId } ---');
  const res4 = await fetch('https://tfjkinffnksmiqatdhnb.supabase.co/functions/v1/livekit-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      apikey: 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q',
    },
    body: JSON.stringify({ channelId: 'a0000000-0000-0000-0000-000000000000' }),
  });
  console.log('Status 4:', res4.status);
  const body4 = await res4.text();
  console.log('Body 4:', body4);
}

testLivekitEndpoint().catch(console.error);
