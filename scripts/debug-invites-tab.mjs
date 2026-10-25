import http from 'http';

async function main() {
  const cdpList = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const page = cdpList.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const evalJs = expr => new Promise(r => {
    const msgId = id++;
    ws.send(JSON.stringify({ id: msgId, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    const h = e => {
      const msg = JSON.parse(e.data);
      if (msg.id === msgId) {
        ws.removeEventListener('message', h);
        r(msg.result?.result?.value);
      }
    };
    ws.addEventListener('message', h);
  });

  const storeStateBefore = await evalJs(`(() => {
    const s = window.__DISCORD_STORE__.getState();
    return {
      isServerSettingsOpen: s.isServerSettingsOpen,
      serverSettingsTab: s.serverSettingsTab,
      activeServerId: s.activeServerId,
      serversCount: s.servers.length,
      currentServer: s.servers.find(srv => srv.id === s.activeServerId)?.name
    };
  })()`);
  console.log('STORE BEFORE:', storeStateBefore);

  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.openServerSettings('invites');
  })()`);

  const storeStateAfter = await evalJs(`(() => {
    const s = window.__DISCORD_STORE__.getState();
    return {
      isServerSettingsOpen: s.isServerSettingsOpen,
      serverSettingsTab: s.serverSettingsTab,
    };
  })()`);
  console.log('STORE AFTER:', storeStateAfter);

  await new Promise(r => setTimeout(r, 600));

  const state = await evalJs(`(() => {
    const modal = document.querySelector('.fixed');
    const h2 = document.querySelector('h2')?.innerText;
    const btns = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
    const text = document.body.innerText.substring(0, 800);
    return { modal: !!modal, h2, btns, textPreview: text };
  })()`);

  console.log('DOM STATE:', JSON.stringify(state, null, 2));
  ws.close();
}

main().catch(console.error);
