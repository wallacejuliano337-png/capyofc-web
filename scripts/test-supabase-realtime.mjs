import { createClient } from '@supabase/supabase-js';

const url = 'https://tfjkinffnksmiqatdhnb.supabase.co';
const key = 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q';

async function testRealtime() {
  console.log('Testing Supabase Realtime presence and broadcast...');
  
  const clientA = createClient(url, key);
  const clientB = createClient(url, key);

  const channelA = clientA.channel('test-room-1', {
    config: { presence: { key: 'user-a' } }
  });

  const channelB = clientB.channel('test-room-1', {
    config: { presence: { key: 'user-b' } }
  });

  let receivedSyncA = false;
  let receivedSyncB = false;
  let receivedBroadcastB = false;

  channelA.on('presence', { event: 'sync' }, () => {
    const state = channelA.presenceState();
    console.log('[Client A] Presence sync:', Object.keys(state));
    if (state['user-b']) receivedSyncA = true;
  });

  channelB.on('presence', { event: 'sync' }, () => {
    const state = channelB.presenceState();
    console.log('[Client B] Presence sync:', Object.keys(state));
    if (state['user-a']) receivedSyncB = true;
  });

  channelB.on('broadcast', { event: 'test-message' }, ({ payload }) => {
    console.log('[Client B] Received broadcast from A:', payload);
    receivedBroadcastB = true;
  });

  await new Promise(resolve => channelA.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Client A SUBSCRIBED');
      channelA.track({ name: 'User A', isMuted: false });
      resolve();
    }
  }));

  await new Promise(resolve => channelB.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Client B SUBSCRIBED');
      channelB.track({ name: 'User B', isMuted: true });
      resolve();
    }
  }));

  // Wait 1.5 seconds for presence sync
  await new Promise(r => setTimeout(r, 1500));

  // Send broadcast from A to B
  await channelA.send({
    type: 'broadcast',
    event: 'test-message',
    payload: { hello: 'from client A' }
  });

  // Wait 1 second
  await new Promise(r => setTimeout(r, 1000));

  console.log('Results:');
  console.log('A received B presence:', receivedSyncA);
  console.log('B received A presence:', receivedSyncB);
  console.log('B received broadcast from A:', receivedBroadcastB);

  await clientA.removeChannel(channelA);
  await clientB.removeChannel(channelB);
  process.exit(0);
}

testRealtime().catch(console.error);
