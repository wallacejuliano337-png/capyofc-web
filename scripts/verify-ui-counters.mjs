import fs from 'fs';

async function main() {
  const targets = await fetch('http://localhost:9222/json').then(r => r.json());
  const page = targets.find(t => t.url && t.url.includes('5173'));
  if (!page || !page.webSocketDebuggerUrl) {
    console.log('No page found on 9222');
    return;
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  const callbacks = new Map();
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (callbacks.has(data.id)) {
        const cb = callbacks.get(data.id);
        callbacks.delete(data.id);
        cb(data);
      }
    } catch {}
  };

  function sendCmd(method, params = {}) {
    return new Promise((resolve) => {
      const id = Math.floor(Math.random() * 100000);
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const storeRes = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const serversStr = localStorage.getItem('lyc_servers_state');
      const servers = serversStr ? JSON.parse(serversStr) : [];
      const lyc = servers.find(s => s.id === 'server-lyc');
      const text = document.body.innerText;

      return {
        lycServer: lyc ? { id: lyc.id, name: lyc.name, memberCount: lyc.memberCount, onlineCount: lyc.onlineCount } : null,
        has1250: text.includes('1.250') || text.includes('1250'),
        has225: text.includes('225 online') || text.includes('225'),
        bodyLength: text.length
      };
    })()`,
    returnByValue: true
  });

  console.log('Runtime eval full response:', JSON.stringify(storeRes, null, 2));

  const screenshotRes = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (screenshotRes?.result?.data) {
    fs.writeFileSync('C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520\\electron-live-ui-counters-fixed.png', Buffer.from(screenshotRes.result.data, 'base64'));
    console.log('Screenshot saved successfully!');
  }

  ws.close();
}

main().catch(console.error);
