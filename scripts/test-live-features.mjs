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

  // 1. Open server header dropdown
  console.log('Opening server dropdown...');
  const openRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const allBtns = Array.from(document.querySelectorAll('button, div[role="button"]'));
      const srvBtn = allBtns.find(b => b.textContent && b.textContent.includes('CapyChat Oficial'));
      if (srvBtn) {
        srvBtn.click();
        return true;
      }
      return false;
    })()`,
    returnByValue: true
  });
  console.log('Opened server menu:', openRes.result.value);
  await new Promise(r => setTimeout(r, 600));

  await screenshot('electron-server-dropdown-open.png');

  // 2. Click "Sair do Servidor" in dropdown
  console.log('Clicking "Sair do Servidor"...');
  const clickedLeave = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const leaveBtn = btns.find(b => b.textContent && b.textContent.includes('Sair do Servidor'));
      if (leaveBtn) {
        leaveBtn.click();
        return true;
      }
      return false;
    })()`,
    returnByValue: true
  });
  console.log('Clicked leave button:', clickedLeave.result.value);
  await new Promise(r => setTimeout(r, 600));

  // 3. Capture screenshot of Leave Server Modal
  await screenshot('electron-leave-server-modal.png');

  // 4. Close modal by clicking Cancelar
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cancelBtn = btns.find(b => b.textContent && (b.textContent.trim() === 'Cancelar' || b.textContent.trim() === 'Entendido'));
      if (cancelBtn) cancelBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 600));

  // 5. Open Settings Modal and navigate to "insignias"
  console.log('Opening settings modal to "insignias"...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__discordStore;
      if (store) {
        store.getState().openSettingsModal();
        store.getState().setActiveSettingsTab('insignias');
      }
    })()`
  });
  await new Promise(r => setTimeout(r, 800));

  // 6. Capture screenshot of Badges settings section
  await screenshot('electron-settings-insignias-tab.png');

  // 7. Close settings modal and click user profile popout
  console.log('Closing settings and opening user popout...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__discordStore;
      if (store) {
        store.getState().closeSettingsModal();
      }
    })()`
  });
  await new Promise(r => setTimeout(r, 600));

  // Open member popout for current user
  await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__discordStore;
      if (store) {
        const cur = store.getState().currentUser;
        store.getState().openMemberPopout(cur, { top: 120, right: 300 });
      }
    })()`
  });
  await new Promise(r => setTimeout(r, 800));

  // 8. Capture screenshot of Member Popout with dynamic CapyChat Badges
  await screenshot('electron-member-popout-badges.png');

  console.log('All tests completed successfully!');
  ws.close();
}

main().catch(console.error);
