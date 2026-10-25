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

  // Close any existing menus with Escape
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await new Promise(r => setTimeout(r, 400));

  // Find member inside the right sidebar (left > 1000)
  const memberInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const allSpans = Array.from(document.querySelectorAll('aside span, aside div'));
        // Find span on the right side
        const rightSpans = Array.from(document.querySelectorAll('span')).filter(s => {
          const r = s.getBoundingClientRect();
          return r.left > 1000 && (s.textContent.includes('CyberSamurai') || s.textContent.includes('Valkyrie') || s.textContent.includes('Capy Amigo'));
        });

        if (rightSpans.length > 0) {
          const s = rightSpans[0];
          const rect = s.getBoundingClientRect();
          return {
            found: true,
            text: s.textContent.trim(),
            rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
          };
        }
        return { found: false, count: rightSpans.length };
      })()
    `,
    returnByValue: true
  });
  console.log('Member in right sidebar:', memberInfo.result.value);

  const rect = memberInfo.result.value.rect;
  const clickX = Math.round(rect.left + 20);
  const clickY = Math.round(rect.top + 10);

  console.log(`Right clicking at (${clickX}, ${clickY})...`);
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

  await new Promise(r => setTimeout(r, 600));

  // Inspect opened menu
  const menuEval = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const menu = document.querySelector('.fixed.z-\\\\[9999\\\\]');
        if (!menu) return { found: false };
        const items = Array.from(menu.querySelectorAll('button')).map(b => b.textContent.trim());
        const header = menu.querySelector('.font-bold.text-white')?.textContent;
        const hasKick = items.some(i => i.includes('Expulsar'));
        const hasBan = items.some(i => i.includes('Banir'));
        const hasRoles = items.some(i => i.includes('Cargos'));
        return { found: true, header, items, hasKick, hasBan, hasRoles };
      })()
    `,
    returnByValue: true
  });
  console.log('Member context menu from right sidebar:', menuEval.result.value);

  // Take screenshot
  const artifactDir = 'C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520';
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const ssPath = path.join(artifactDir, 'electron-live-member-sidebar-context-menu.png');
  fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
  console.log('Screenshot saved to:', ssPath);

  ws.close();
}

main().catch(console.error);
