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

  // 1. Open Current User Popout and open "Mudar de conta"
  console.log('--- 1. Testing Multi-Account Switcher in User Popout ---');
  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.closeServerSettings();
    store.closeSettingsModal();
    // Click user avatar / trigger user footer click
    const userFooterBtn = document.querySelector('button[title*="Perfil"], [aria-label*="perfil"]') || document.querySelector('.bg-\\[\\#232428\\]') || Array.from(document.querySelectorAll('div')).find(d => d.textContent && d.textContent.includes('Online no CapyChat Oficial'));
    if (userFooterBtn) {
      userFooterBtn.click();
    }
  })()`);

  await new Promise(r => setTimeout(r, 600));

  // Click "Mudar de conta"
  await evalJs(`(() => {
    const switchBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Mudar de conta'));
    if (switchBtn) switchBtn.click();
  })()`);

  await new Promise(r => setTimeout(r, 500));
  await capture('electron-live-multi-account-switcher.png');

  // 2. Open Server Settings -> Integrations (CapyBot Oficial)
  console.log('--- 2. Testing Server Settings: Integrations (CapyBot Oficial) ---');
  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.setActiveServer('server-lyc');
    store.openServerSettings('integrations');
  })()`);

  await new Promise(r => setTimeout(r, 600));
  await capture('electron-live-integrations-capybot.png');

  // 3. Open Server Settings -> Modelo do Servidor
  console.log('--- 3. Testing Server Settings: Modelo do Servidor ---');
  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.openServerSettings('server-template');
  })()`);

  await new Promise(r => setTimeout(r, 600));
  await capture('electron-live-modelo-capychat.png');

  // Close modals cleanly
  await evalJs(`(() => {
    window.__DISCORD_STORE__.getState().closeServerSettings();
  })()`);

  ws.close();
  console.log('All verification captures completed!');
}

main().catch(console.error);
