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

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
    setTimeout(() => reject(new Error('WS connection timeout')), 3000);
  });

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      const timer = setTimeout(() => reject(new Error('Timeout on ' + method)), 10000);
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

  async function capture(fileName) {
    await send('Page.enable');
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = `C:/Users/CORONEL/.gemini/antigravity/brain/8299f61a-3aea-46e8-a874-c529a6498520/${fileName}`;
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${fileName} (${buffer.length} bytes)`);
  }

  console.log('--- 1. Testing User Settings: Minha Conta (No HypeSquad, Compact Badges) ---');
  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.closeServerSettings();
    store.closeMemberPopout();
    store.openSettingsModal();
    store.setActiveSettingsTab('account');
  })()`);
  await new Promise(r => setTimeout(r, 600));
  await capture('electron-live-minha-conta-no-hypesquad.png');

  console.log('--- 2. Testing User Settings: Insígnias ---');
  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.setActiveSettingsTab('insignias');
  })()`);
  await new Promise(r => setTimeout(r, 600));
  await capture('electron-live-insignias-settings-compact.png');

  console.log('--- 3. Testing Server Settings: Modern Invites ---');
  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.closeSettingsModal();
    store.setActiveServer('server-lyc');
    store.openServerSettings('invites');
  })()`);
  await new Promise(r => setTimeout(r, 600));
  await capture('electron-live-invites-modern-cards.png');

  console.log('--- 3b. Testing Copy Invite Button Visual Feedback ---');
  const copySuccess = await evalJs(`(() => {
    const copyBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent && b.textContent.includes('Copiar Link'));
    if (copyBtns.length > 0) {
      copyBtns[0].click();
      return true;
    }
    return false;
  })()`);
  console.log('Copy button clicked:', copySuccess);
  await new Promise(r => setTimeout(r, 300));
  await capture('electron-live-invites-copied-feedback.png');

  console.log('--- 3c. Testing Create Invite Modal ---');
  const openCreateModalSuccess = await evalJs(`(() => {
    const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Criar Link de Convite'));
    if (createBtn) {
      createBtn.click();
      return true;
    }
    return false;
  })()`);
  console.log('Create invite modal opened:', openCreateModalSuccess);
  await new Promise(r => setTimeout(r, 600));
  await capture('electron-live-invites-create-modal.png');

  // Close create modal
  await evalJs(`(() => {
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Cancelar');
    if (cancelBtn) cancelBtn.click();
  })()`);
  await new Promise(r => setTimeout(r, 400));

  console.log('--- 3d. Testing Revoke Confirmation Modal ---');
  const openRevokeModalSuccess = await evalJs(`(() => {
    const revokeBtns = Array.from(document.querySelectorAll('button')).filter(b => b.title === 'Revogar convite' || (b.textContent && b.textContent.includes('Revogar')));
    if (revokeBtns.length > 0) {
      revokeBtns[0].click();
      return true;
    }
    return false;
  })()`);
  console.log('Revoke modal opened:', openRevokeModalSuccess);
  await new Promise(r => setTimeout(r, 600));
  await capture('electron-live-invites-revoke-modal.png');

  // Cancel revoke modal
  await evalJs(`(() => {
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Cancelar');
    if (cancelBtn) cancelBtn.click();
  })()`);
  await new Promise(r => setTimeout(r, 400));

  console.log('--- 4. Testing Member Popout Double-Click & Compact Badges ---');
  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.closeServerSettings();
  })()`);
  await new Promise(r => setTimeout(r, 600));

  // Trigger double click or openMemberPopout
  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    const members = store.getServerMembers(store.activeServerId);
    const targetMember = members.find(m => m.name.includes('Ares') || m.id === 'user-ares') || members[0] || store.currentUser;
    store.openMemberPopout(targetMember, { top: 120, right: 280 });
  })()`);
  await new Promise(r => setTimeout(r, 600));
  await capture('electron-live-member-popout-compact-badges.png');

  // Close popout with ESC
  await evalJs(`(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.closeMemberPopout();
  })()`);
  await new Promise(r => setTimeout(r, 400));

  ws.close();
  console.log('Verification completed successfully!');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
