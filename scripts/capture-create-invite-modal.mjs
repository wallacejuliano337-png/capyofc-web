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
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = id++;
    const timer = setTimeout(() => reject(new Error('Timeout ' + method)), 10000);
    const h = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id === msgId) {
        clearTimeout(timer);
        ws.removeEventListener('message', h);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  const evalJs = async (expr) => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return res.result?.value;
  };

  const capture = async (fileName) => {
    await send('Page.enable');
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = `C:/Users/CORONEL/.gemini/antigravity/brain/8299f61a-3aea-46e8-a874-c529a6498520/${fileName}`;
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${fileName} (${buffer.length} bytes)`);
  };

  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.closeSettingsModal();
    store.closeMemberPopout();
    store.setActiveServer('server-lyc');
    store.openServerSettings('invites');
  })()`);
  await new Promise(r => setTimeout(r, 600));

  const clickCreate = await evalJs(`(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    const btn = allButtons.find(b => b.innerText.includes('Criar Convite'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  })()`);
  console.log('Clicked "Criar Convite":', clickCreate);

  await new Promise(r => setTimeout(r, 600));
  await capture('electron-live-invites-create-modal.png');

  // Also close modal cleanly
  await evalJs(`(() => {
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Cancelar');
    if (cancelBtn) cancelBtn.click();
    window.__DISCORD_STORE__.getState().closeServerSettings();
  })()`);

  ws.close();
}

main().catch(console.error);
