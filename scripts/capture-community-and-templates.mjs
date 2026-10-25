import http from 'http';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/CORONEL/.gemini/antigravity/brain/8299f61a-3aea-46e8-a874-c529a6498520';

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

  await send('Page.enable');
  await send('Runtime.enable');

  console.log('[1/4] Recarregando página para carregar bundles atualizados...');
  await send('Page.reload');
  await new Promise((r) => setTimeout(r, 2500));

  console.log('[2/4] Abrindo configurações do servidor...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const settingsBtn = btns.find(b => b.getAttribute('title')?.includes('Configurações') || b.getAttribute('aria-label')?.includes('Configurações') || b.querySelector('svg.lucide-settings'));
      if (settingsBtn) {
        settingsBtn.click();
      } else {
        const header = document.querySelector('header');
        if (header) header.click();
      }
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1200));

  // Find and click 'Modelo do Servidor' tab
  console.log('[2b] Selecionando aba Modelo do Servidor...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tabs = Array.from(document.querySelectorAll('button, div, span'));
      const templateTab = tabs.find(el => el.textContent && el.textContent.trim() === 'Modelo do Servidor');
      if (templateTab) templateTab.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1000));

  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'electron-live-server-template-real.png'), Buffer.from(snap1.data, 'base64'));
  console.log('✓ Salvo electron-live-server-template-real.png');

  // Switch to 'Habilitar Comunidade' tab
  console.log('[3/4] Alternando para aba Habilitar Comunidade...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tabs = Array.from(document.querySelectorAll('button, div, span'));
      const commTab = tabs.find(el => el.textContent && el.textContent.trim() === 'Habilitar comunidade');
      if (commTab) commTab.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1000));

  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'electron-live-enable-community-real.png'), Buffer.from(snap2.data, 'base64'));
  console.log('✓ Salvo electron-live-enable-community-real.png');

  // Close server settings modal (ESC)
  console.log('[4/4] Abrindo modal de criar servidor...');
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', windowsVirtualKeyCode: 27 });
  await new Promise((r) => setTimeout(r, 800));

  // Click "+" button on server rail
  await send('Runtime.evaluate', {
    expression: `(() => {
      const addBtns = Array.from(document.querySelectorAll('button'));
      const addBtn = addBtns.find(b => b.querySelector('svg.lucide-plus') || b.textContent.includes('Adicionar um servidor') || b.getAttribute('aria-label')?.includes('Adicionar'));
      if (addBtn) addBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Click "Usar Modelo de Servidor" button
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const tmplBtn = btns.find(b => b.textContent && b.textContent.includes('Usar Modelo de Servidor'));
      if (tmplBtn) tmplBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1000));

  const snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'electron-live-import-template-view.png'), Buffer.from(snap3.data, 'base64'));
  console.log('✓ Salvo electron-live-import-template-view.png');

  // Close modal with ESC
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', windowsVirtualKeyCode: 27 });

  ws.close();
  console.log('Finalizado com sucesso!');
}

main().catch(console.error);
