import { createClient } from '@supabase/supabase-js';

const client = createClient(
  'https://tfjkinffnksmiqatdhnb.supabase.co',
  'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q'
);

async function check() {
  console.log('Checking for public.call_action on tfjkinffnksmiqatdhnb.supabase.co...');
  const res = await client.rpc('call_action', {
    action: 'get_active_call',
    payload: {}
  });

  if (res.error?.code === 'PGRST202') {
    return false;
  }

  console.log('FOUND! Response:', res);
  return true;
}

async function loop() {
  for (let i = 0; i < 60; i++) {
    const ok = await check();
    if (ok) {
      console.log('SUCCESS: public.call_action is available in schema cache!');
      process.exit(0);
    }
    console.log(`Waiting... attempt ${i + 1}/60 (checking again in 3s)`);
    await new Promise(r => setTimeout(r, 3000));
  }
  console.error('TIMED OUT: call_action was not detected within 3 minutes.');
  process.exit(1);
}

loop().catch(console.error);
