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
  if (!page) throw new Error('No page target found');
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
    setTimeout(() => reject(new Error('WS connection timeout')), 3000);
  });

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      const timer = setTimeout(() => reject(new Error('Timeout on ' + method)), 8000);
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

  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return res.result?.value;
  }

  console.log('Evaluating live state in Electron...');
  
  // 1. Check if user is logged in
  const authState = await evalJs(`(() => {
    return {
      title: document.title,
      url: window.location.href,
      hasServerSidebar: !!document.querySelector('nav, [data-testid="server-sidebar"]'),
      hasChat: !!document.querySelector('textarea, input[placeholder*="Conversar"]'),
    };
  })()`);
  console.log('Auth state:', authState);

  // 2. Test create clean server via store
  const newServerResult = await evalJs(`(() => {
    try {
      const store = window.__DISCORD_STORE__ || (window as any)?.useDiscord?.getState?.();
      return store ? 'Store direct access' : 'No direct global';
    } catch(e) {
      return e.message;
    }
  })()`);

  // Let's inspect badges settings and clean servers
  const badgesTest = await evalJs(`(() => {
    const badgesSection = document.querySelector('[data-testid="badges-settings"]');
    return badgesSection ? 'Badges section in DOM' : 'Not currently in badges settings';
  })()`);

  // Capture screenshot of current view
  await send('Page.enable');
  const res = await send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(res.data, 'base64');
  const outPath = 'C:/Users/CORONEL/.gemini/antigravity/brain/8299f61a-3aea-46e8-a874-c529a6498520/electron-live-clean-verification.png';
  fs.writeFileSync(outPath, buffer);
  console.log('Live screenshot saved to:', outPath);

  ws.close();
}

main().catch(console.error);
