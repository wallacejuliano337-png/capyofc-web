import http from 'http';
import fs from 'fs';

async function getWsUrl() {
  const cdpList = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
  const page = cdpList.find(t => t.type === 'page');
  return page.webSocketDebuggerUrl;
}

async function main() {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      const timer = setTimeout(() => reject(new Error(`Timeout on ${method}`)), 15000);
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

  async function screenshot(filename) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(`C:/Users/CORONEL/.gemini/antigravity/brain/8299f61a-3aea-46e8-a874-c529a6498520/${filename}`, buffer);
    console.log(`Saved screenshot: ${filename}`);
  }

  // 1. Switch to 'server-testes'
  console.log('Switching to Servidor de Testes...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__discordStore;
      if (store) {
        store.getState().setActiveServer('server-testes');
      }
    })()`
  });
  await new Promise(r => setTimeout(r, 600));

  // 2. Open server menu in sidebar
  console.log('Opening server menu for Servidor de Testes...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const allBtns = Array.from(document.querySelectorAll('button, div[role="button"]'));
      const srvBtn = allBtns.find(b => b.textContent && b.textContent.includes('Servidor de Testes'));
      if (srvBtn) srvBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 600));

  // 3. Click "Sair do Servidor"
  console.log('Clicking "Sair do Servidor"...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const leaveBtn = btns.find(b => b.textContent && b.textContent.includes('Sair do Servidor'));
      if (leaveBtn) leaveBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 600));

  await screenshot('electron-leave-test-server-modal.png');

  // 4. Confirm leave by clicking the red button "Sair do Servidor"
  console.log('Confirming leave...');
  const confirmResult = await send('Runtime.evaluate', {
    expression: `(async () => {
      const btns = Array.from(document.querySelectorAll('button'));
      // Find the confirm button in the modal
      const confirmBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Sair do Servidor' && b.className.includes('bg-[#f23f43]'));
      if (confirmBtn) {
        confirmBtn.click();
        return true;
      }
      return false;
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Clicked confirm leave:', confirmResult.result.value);
  await new Promise(r => setTimeout(r, 1200));

  // 5. Check state of servers
  const remainingServers = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__discordStore;
      return {
        servers: store ? store.getState().servers.map(s => s.id) : [],
        activeServerId: store ? store.getState().activeServerId : null,
        leftServers: JSON.parse(localStorage.getItem('lyc_left_servers') || '[]')
      };
    })()`,
    returnByValue: true
  });
  console.log('Remaining servers state:', remainingServers.result.value);

  // 6. Capture screenshot after leaving test server
  await screenshot('electron-after-leave-test-server.png');

  console.log('Leave test server completed!');
  ws.close();
}

main().catch(console.error);
