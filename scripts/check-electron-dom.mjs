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
  await new Promise(r => ws.onopen = r);

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  // Reload page to ensure clean render
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 3000));

  const dom = await send('Runtime.evaluate', {
    expression: 'document.body ? document.body.innerHTML.substring(0, 300) : "empty"',
    returnByValue: true
  });
  console.log('DOM preview:', dom.result.value);

  const res = await send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(res.data, 'base64');
  fs.writeFileSync('C:/Users/CORONEL/.gemini/antigravity/brain/8299f61a-3aea-46e8-a874-c529a6498520/electron-live-open-now.png', buffer);
  console.log('Saved electron-live-open-now.png');
  ws.close();
}

main().catch(console.error);
