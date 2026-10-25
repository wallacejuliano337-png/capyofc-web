import fs from 'fs';

async function main() {
  const targets = await fetch('http://localhost:9222/json').then(r => r.json());
  const page = targets.find(t => t.url && t.url.includes('5173'));
  if (!page || !page.webSocketDebuggerUrl) return;

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => { ws.onopen = resolve; });

  const callbacks = new Map();
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (callbacks.has(data.id)) {
        const cb = callbacks.get(data.id);
        callbacks.delete(data.id);
        cb(data);
      }
    } catch {}
  };

  function sendCmd(method, params = {}) {
    return new Promise((resolve) => {
      const id = Math.floor(Math.random() * 100000);
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Click the server menu header button
  await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const srvBtn = buttons.find(b => b.innerText && b.innerText.includes('CapyChat Oficial'));
      if (srvBtn) srvBtn.click();
    })()`
  });

  await new Promise((r) => setTimeout(r, 400));

  // Now click 'Configurações do Servidor'
  await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const cfgBtn = buttons.find(b => b.innerText && b.innerText.includes('Configurações do Servidor'));
      if (cfgBtn) cfgBtn.click();
    })()`
  });

  await new Promise((r) => setTimeout(r, 1000));

  const modalEval = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      return {
        has1250: text.includes('1.250') || text.includes('1250'),
        has225: text.includes('225 online') || text.includes('225'),
        has7: text.includes('7 membros') || text.includes('7 atuais'),
        previewOnline: Array.from(document.querySelectorAll('span')).map(s => s.innerText.trim()).filter(t => t.includes('online') || t.includes('membro') || t.includes('atuais'))
      };
    })()`,
    returnByValue: true
  });

  console.log('Modal Eval:', JSON.stringify(modalEval?.result?.result?.value, null, 2));

  const screenshotRes = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (screenshotRes?.result?.data) {
    fs.writeFileSync('C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520\\electron-live-ui-modal-counters.png', Buffer.from(screenshotRes.result.data, 'base64'));
    console.log('Modal Screenshot saved successfully!');
  }

  ws.close();
}

main().catch(console.error);
