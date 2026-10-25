import http from 'http';
import fs from 'fs';
import path from 'path';

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
  });

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      const timer = setTimeout(() => reject(new Error(`Timeout on ${method}`)), 10000);
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

  // Reload page to return to normal active session
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 2000));

  const artifactDir = 'C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520';
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const ssPath = path.join(artifactDir, 'electron-live-final-ready.png');
  fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
  console.log('Final screenshot saved to:', ssPath);

  ws.close();
}

main().catch(console.error);
