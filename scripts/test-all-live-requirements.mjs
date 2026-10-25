import http from 'http';
import fs from 'fs';

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

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
    setTimeout(() => reject(new Error('WS connection timeout')), 3000);
  });

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      const timer = setTimeout(() => reject(new Error('Timeout on ' + method)), 10000);
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === msgId) {
          clearTimeout(timer);
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return res.result?.value;
  }

  async function capture(fileName) {
    await send('Page.enable');
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = `C:/Users/CORONEL/.gemini/antigravity/brain/8299f61a-3aea-46e8-a874-c529a6498520/${fileName}`;
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${fileName} (${buffer.length} bytes)`);
  }

  // 1. Check store access and list servers
  const serverInfo = await evalJs(`(() => {
    const store = window.__DISCORD_STORE__?.getState?.();
    if (!store) return null;
    return {
      servers: store.servers.map(s => ({ id: s.id, name: s.name, ownerId: s.ownerId })),
      activeServerId: store.activeServerId,
    };
  })()`);
  console.log('Server info from live store:', serverInfo);

  // 2. Select custom server or create one
  const targetServerId = serverInfo.servers.find(s => s.id !== 'server-lyc')?.id;
  console.log('Target custom server:', targetServerId);

  // Switch to custom server and open server settings to 'roles'
  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.setActiveServer('${targetServerId}');
    store.openServerSettings('roles');
  })()`);

  await new Promise(r => setTimeout(r, 600));
  await capture('electron-live-custom-server-roles.png');

  // 3. Switch to 'audit-log' tab
  console.log('Switching to audit-log tab...');
  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.setServerSettingsTab('audit-log');
  })()`);

  await new Promise(r => setTimeout(r, 600));
  await capture('electron-live-custom-server-audit-clean.png');

  // 4. Close server settings and open User Settings -> Insígnias
  console.log('Opening User Settings -> Insígnias...');
  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.closeServerSettings();
    store.openSettingsModal();
    store.setActiveSettingsTab('insignias');
  })()`);

  await new Promise(r => setTimeout(r, 600));
  await capture('electron-live-settings-badges-requirements.png');

  // 5. Close settings and test compact profile popout via double click
  console.log('Opening Compact Profile Popout...');
  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.closeSettingsModal();
    const members = store.communityMembers;
    const targetUser = members[0] || store.currentUser;
    store.openMemberPopout(targetUser, { top: 120, right: 300 });
  })()`);

  await new Promise(r => setTimeout(r, 600));
  await capture('electron-live-member-popout-doubleclick.png');

  // 6. Test ESC key closes popout
  console.log('Testing ESC key on popout...');
  await evalJs(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  })()`);

  await new Promise(r => setTimeout(r, 400));
  await capture('electron-live-after-esc-popout-closed.png');

  ws.close();
  console.log('All live tests and captures complete!');
}

main().catch(console.error);
