import fs from 'fs';

async function main() {
  const targets = await fetch('http://localhost:9222/json').then(r => r.json());
  const page = targets.find(t => t.url && t.url.includes('5173'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise(r => { ws.onopen = r; });

  const callbacks = new Map();
  ws.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data);
      if (callbacks.has(d.id)) {
        const cb = callbacks.get(d.id);
        callbacks.delete(d.id);
        cb(d.result);
      }
    } catch {}
  };

  function sendCmd(method, params = {}) {
    return new Promise(resolve => {
      const id = Math.floor(Math.random() * 100000);
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const res = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      return {
        text: document.body.innerText.slice(0, 500),
        activeServer: window.__discordStore ? window.__discordStore.getState().activeServerId : 'no store',
        serversCount: window.__discordStore ? window.__discordStore.getState().servers.length : 0,
        currentUser: window.__discordStore ? window.__discordStore.getState().currentUser.name : 'no user'
      };
    })()`,
    returnByValue: true
  });

  console.log('App state:', JSON.stringify(res?.result?.value, null, 2));

  // Take fresh screenshot
  const shot = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (shot?.data) {
    fs.writeFileSync('C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520\\electron-app-open.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved screenshot to electron-app-open.png, size:', shot.data.length);
  }

  ws.close();
  process.exit(0);
}
main().catch(console.error);
