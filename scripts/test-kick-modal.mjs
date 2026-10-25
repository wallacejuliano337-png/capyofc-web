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

  // Click on "Expulsar Valkyrie" button
  console.log('Clicking "Expulsar Valkyrie"...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const kickBtn = buttons.find(b => b.textContent.includes('Expulsar'));
        if (kickBtn) {
          kickBtn.click();
          return { clicked: true, text: kickBtn.textContent.trim() };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Kick button click:', clickRes.result.value);

  await new Promise(r => setTimeout(r, 600));

  // Inspect confirmation modal
  const modalInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const modal = document.querySelector('.fixed.z-\\\\[10001\\\\]');
        if (!modal) return { found: false };
        const title = modal.querySelector('h2')?.textContent.trim();
        const desc = modal.querySelector('p')?.textContent.trim();
        const actionBtn = modal.querySelector('button.bg-\\\\[\\\\#f23f43\\\\]')?.textContent.trim();
        return { found: true, title, desc, actionBtn };
      })()
    `,
    returnByValue: true
  });
  console.log('Confirmation Modal info:', modalInfo.result.value);

  // Take screenshot of confirmation modal
  const artifactDir = 'C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520';
  let ss = await send('Page.captureScreenshot', { format: 'png' });
  let ssPath = path.join(artifactDir, 'electron-live-kick-confirm-modal.png');
  fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
  console.log('Confirmation modal screenshot saved to:', ssPath);

  // Click Cancelar to test cancel
  console.log('Clicking "Cancelar" on confirmation modal...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancelar');
        if (cancelBtn) cancelBtn.click();
      })()
    `
  });

  await new Promise(r => setTimeout(r, 400));

  // Verify modal closed
  const closedCheck = await send('Runtime.evaluate', {
    expression: `Boolean(document.querySelector('.fixed.z-\\\\[10001\\\\]'))`,
    returnByValue: true
  });
  console.log('Modal closed after clicking Cancelar:', !closedCheck.result.value);

  ws.close();
}

main().catch(console.error);
