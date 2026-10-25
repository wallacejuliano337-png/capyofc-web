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

  // Reload page to be completely sure it's fresh
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 2000));

  // Find member elements inside the members list
  const domInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const allSpans = Array.from(document.querySelectorAll('span'));
        const samSpan = allSpans.find(s => s.textContent.includes('CyberSamurai'));
        if (samSpan) {
          const row = samSpan.closest('.group');
          const rect = row ? row.getBoundingClientRect() : samSpan.getBoundingClientRect();
          return {
            found: true,
            text: samSpan.textContent,
            rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
          };
        }
        return { found: false, allSpansCount: allSpans.length };
      })()
    `,
    returnByValue: true
  });
  console.log('CyberSamurai element info:', domInfo.result.value);

  const rect = domInfo.result.value.rect;
  const clickX = Math.round(rect.left + rect.width / 2);
  const clickY = Math.round(rect.top + rect.height / 2);

  console.log(`Dispatching right click at (${clickX}, ${clickY})...`);
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: clickX,
    y: clickY,
    button: 'right',
    clickCount: 1
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: clickX,
    y: clickY,
    button: 'right',
    clickCount: 1
  });

  await new Promise(r => setTimeout(r, 800));

  // Inspect opened menu
  const menuEval = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const menu = document.querySelector('.fixed.z-\\\\[9999\\\\]');
        if (!menu) return { found: false };
        const items = Array.from(menu.querySelectorAll('button')).map(b => b.textContent.trim());
        const header = menu.querySelector('.font-bold.text-white')?.textContent;
        return { found: true, header, items };
      })()
    `,
    returnByValue: true
  });
  console.log('Opened context menu:', menuEval.result.value);

  // Take screenshot
  const artifactDir = 'C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520';
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const ssPath = path.join(artifactDir, 'electron-live-member-context-menu-verified.png');
  fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
  console.log('Screenshot saved to:', ssPath);

  ws.close();
}

main().catch(console.error);
