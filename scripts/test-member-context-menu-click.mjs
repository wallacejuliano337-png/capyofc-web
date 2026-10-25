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

  // Find member item coordinates in DOM
  const memberInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Members list sidebar is on the right
        const aside = Array.from(document.querySelectorAll('aside')).find(a => a.textContent.includes('ADMIN FUNDADOR') || a.textContent.includes('MODERADOR'));
        if (!aside) return { error: 'No members aside found' };
        
        // Find a member item like CyberSamurai or Valkyrie
        const items = Array.from(aside.querySelectorAll('div')).filter(d => d.textContent.includes('CyberSamurai') || d.textContent.includes('Valkyrie'));
        const target = items[items.length - 1] || items[0];
        if (!target) return { error: 'No member item found' };

        const rect = target.getBoundingClientRect();
        return {
          text: target.textContent.trim(),
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Member item info:', memberInfo.result.value);

  const { x, y } = memberInfo.result.value;

  // Dispatch real mouse right click at coordinates
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'right',
    clickCount: 1
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'right',
    clickCount: 1
  });

  await new Promise(r => setTimeout(r, 600));

  // Check if context menu opened
  const menuInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const menu = document.querySelector('.fixed.z-\\\\[9999\\\\]');
        if (!menu) return { found: false };
        const buttons = Array.from(menu.querySelectorAll('button')).map(b => b.textContent.trim());
        const hasRoles = buttons.some(b => b.includes('Cargos'));
        const hasKick = buttons.some(b => b.includes('Expulsar'));
        const hasBan = buttons.some(b => b.includes('Banir'));
        return { found: true, buttons, hasRoles, hasKick, hasBan };
      })()
    `,
    returnByValue: true
  });
  console.log('Opened Member Context Menu info:', menuInfo.result.value);

  // Capture screenshot of member context menu
  const artifactDir = 'C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520';
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const ssPath = path.join(artifactDir, 'electron-live-member-context-menu-opened.png');
  fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
  console.log('Saved screenshot to:', ssPath);

  ws.close();
}

main().catch(console.error);
