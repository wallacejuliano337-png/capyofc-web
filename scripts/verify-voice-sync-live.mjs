import { createClient } from '@supabase/supabase-js';

const url = 'https://tfjkinffnksmiqatdhnb.supabase.co';
const key = 'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q';

async function verifyVoiceAndPresenceSync() {
  console.log('=== VERIFICAÇÃO DE SINCRONIZAÇÃO EM TEMPO REAL: DUAS CONTAS ===');

  const coronelId = 'f8fcd139-cf43-4873-bd7d-a807ecd73567';
  const kiritoId = '96dde735-f6d8-4aaf-abd7-0176e44888f2';
  const channelId = 'ch-voice-1';
  const communityId = 'd3f2173f-79f0-4362-b60a-ad079f724b54';

  const clientCoronel = createClient(url, key);
  const clientKirito = createClient(url, key);

  console.log('\n[1/4] Testando presença da comunidade (Online/Offline)...');
  const commChannelCoronel = clientCoronel.channel(`capychat-presence-${communityId}`, {
    config: { presence: { key: coronelId } }
  });
  const commChannelKirito = clientKirito.channel(`capychat-presence-${communityId}`, {
    config: { presence: { key: kiritoId } }
  });

  let coronelSawKiritoOnline = false;
  let kiritoSawCoronelOnline = false;

  commChannelCoronel.on('presence', { event: 'sync' }, () => {
    const state = commChannelCoronel.presenceState();
    if (state[kiritoId]) {
      coronelSawKiritoOnline = true;
      console.log('  -> Coronel detectou Kirito ONLINE via Realtime Presence!');
    }
  });

  commChannelKirito.on('presence', { event: 'sync' }, () => {
    const state = commChannelKirito.presenceState();
    if (state[coronelId]) {
      kiritoSawCoronelOnline = true;
      console.log('  -> Kirito detectou Coronel ONLINE via Realtime Presence!');
    }
  });

  await new Promise(r => commChannelCoronel.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      commChannelCoronel.track({ userId: coronelId, status: 'online' });
      r();
    }
  }));

  await new Promise(r => commChannelKirito.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      commChannelKirito.track({ userId: kiritoId, status: 'online' });
      r();
    }
  }));

  await new Promise(r => setTimeout(r, 1500));

  console.log('\n[2/4] Testando entrada na chamada de voz (Lobby de Voz #1)...');
  const voiceChannelCoronel = clientCoronel.channel(`capy-voice-room-${channelId}`, {
    config: { presence: { key: coronelId } }
  });
  const voiceChannelKirito = clientKirito.channel(`capy-voice-room-${channelId}`, {
    config: { presence: { key: kiritoId } }
  });

  let coronelParticipants = [];
  let kiritoParticipants = [];

  voiceChannelCoronel.on('presence', { event: 'sync' }, () => {
    const state = voiceChannelCoronel.presenceState();
    coronelParticipants = Object.keys(state);
    console.log('  -> [Tela Coronel] Participantes na sala de voz:', coronelParticipants);
  });

  voiceChannelKirito.on('presence', { event: 'sync' }, () => {
    const state = voiceChannelKirito.presenceState();
    kiritoParticipants = Object.keys(state);
    console.log('  -> [Tela Kirito] Participantes na sala de voz:', kiritoParticipants);
  });

  // Coronel joins voice channel
  await new Promise(r => voiceChannelCoronel.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      voiceChannelCoronel.track({
        user: { id: coronelId, name: 'coronel', displayName: 'Coronel' },
        isMuted: false,
        isSpeaking: false,
      });
      r();
    }
  }));

  // Kirito joins voice channel
  await new Promise(r => voiceChannelKirito.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      voiceChannelKirito.track({
        user: { id: kiritoId, name: 'kirito', displayName: 'Kirito' },
        isMuted: false,
        isSpeaking: false,
      });
      r();
    }
  }));

  await new Promise(r => setTimeout(r, 1500));

  console.log('\n[3/4] Testando sinalização e feedback de fala (VAD / Contorno Verde)...');
  let receivedSpeakingSignal = false;
  voiceChannelCoronel.on('broadcast', { event: 'voice_signal' }, ({ payload }) => {
    if (payload.senderId === kiritoId && payload.type === 'state' && payload.state.isSpeaking) {
      receivedSpeakingSignal = true;
      console.log('  -> Coronel recebeu sinal de que Kirito ESTÁ FALANDO (contorno verde ativado)!');
    }
    if (payload.type === 'leave') {
      coronelParticipants = coronelParticipants.filter(id => id !== payload.senderId);
      console.log('  -> Coronel recebeu sinal de saída imediata de:', payload.senderId);
    }
  });

  await voiceChannelKirito.send({
    type: 'broadcast',
    event: 'voice_signal',
    payload: {
      senderId: kiritoId,
      type: 'state',
      state: { isSpeaking: true }
    }
  });

  await new Promise(r => setTimeout(r, 1000));

  console.log('\n[4/4] Testando saída limpa da chamada (sem fantasmas)...');
  // Broadcast immediate leave signal and untrack
  await voiceChannelKirito.send({
    type: 'broadcast',
    event: 'voice_signal',
    payload: {
      senderId: kiritoId,
      type: 'leave',
    }
  });
  await voiceChannelKirito.untrack();
  await new Promise(r => setTimeout(r, 200));
  await clientKirito.removeChannel(voiceChannelKirito);

  await new Promise(r => setTimeout(r, 1500));

  console.log('  -> [Tela Coronel após Kirito sair] Participantes:', coronelParticipants);

  // Results evaluation
  console.log('\n=== RESULTADOS DA VALIDAÇÃO ===');
  console.log('✓ Presença Bidirecional Coronel <-> Kirito:', coronelSawKiritoOnline && kiritoSawCoronelOnline);
  console.log('✓ Sincronização de Participantes na Voz:', coronelParticipants.length >= 1 && kiritoParticipants.includes(coronelId));
  console.log('✓ Sinalização de Voz / Falando (VAD):', receivedSpeakingSignal);
  console.log('✓ Remoção sem fantasmas na saída:', !coronelParticipants.includes(kiritoId));

  const allPassed =
    coronelSawKiritoOnline &&
    kiritoSawCoronelOnline &&
    kiritoParticipants.includes(coronelId) &&
    receivedSpeakingSignal &&
    !coronelParticipants.includes(kiritoId);

  if (allPassed) {
    console.log('\n🎉 TODOS OS REQUISITOS DE SINCRONIZAÇÃO EM TEMPO REAL FORAM VALIDADOS COM SUCESSO!');
  } else {
    console.error('\n❌ Falha na validação de algum requisito.');
    process.exit(1);
  }

  await clientCoronel.removeChannel(commChannelCoronel);
  await clientKirito.removeChannel(commChannelKirito);
  await clientCoronel.removeChannel(voiceChannelCoronel);
  process.exit(0);
}

verifyVoiceAndPresenceSync().catch(console.error);
