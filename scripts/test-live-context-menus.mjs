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
  console.log('Connected to Electron CDP!');

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

  const artifactDir = 'C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520';

  // 1. Reload page
  console.log('\n[1/6] Reloading app page...');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 2500));

  // 2. Check avatar image sources
  console.log('\n[2/6] Checking default mascot avatars across the UI...');
  const avatarCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const mascotAvatars = imgs.filter(i => i.src && i.src.includes('logo-circular.png'));
        const legacyRobots = imgs.filter(i => i.src && i.src.includes('mascote-cabeca.png'));
        return {
          totalImgs: imgs.length,
          mascotCount: mascotAvatars.length,
          legacyRobotCount: legacyRobots.length,
          sampleMascotSrc: mascotAvatars[0]?.src
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Avatar check result:', avatarCheck.result.value);

  // 3. Right-click on a member in the member sidebar
  console.log('\n[3/6] Right-clicking on member in member list...');
  const memberMenuOpen = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const memberItems = Array.from(document.querySelectorAll('aside div.group'));
        const target = memberItems.find(el => el.textContent.includes('CyberSamurai') || el.textContent.includes('Valkyrie') || el.textContent.includes('Capy'));
        if (target) {
          const rect = target.getBoundingClientRect();
          const evt = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + 20,
            clientY: rect.top + 15
          });
          target.dispatchEvent(evt);
          return { success: true, targetText: target.textContent.trim(), rect };
        }
        return { success: false, memberCount: memberItems.length };
      })()
    `,
    returnByValue: true
  });
  console.log('Member context menu trigger:', memberMenuOpen.result.value);

  await new Promise(r => setTimeout(r, 600));

  let ss = await send('Page.captureScreenshot', { format: 'png' });
  let ssPath = path.join(artifactDir, 'electron-live-member-context-menu.png');
  fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
  console.log('Saved member context menu screenshot to:', ssPath);

  // Check content of opened user context menu
  const menuContent = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const menu = document.querySelector('.fixed.z-\\\\[9999\\\\]');
        if (!menu) return { found: false };
        const buttons = Array.from(menu.querySelectorAll('button')).map(b => b.textContent.trim());
        const hasVolume = Boolean(menu.querySelector('input[type="range"]'));
        return { found: true, buttons, hasVolume };
      })()
    `,
    returnByValue: true
  });
  console.log('Member Context Menu contents:', menuContent.result.value);

  // 4. Close menu by pressing Escape
  console.log('\n[4/6] Closing menu with Escape...');
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await new Promise(r => setTimeout(r, 400));

  // 5. Right-click on a message in chat
  console.log('\n[5/6] Right-clicking on chat message...');
  const msgMenuOpen = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const msgItems = Array.from(document.querySelectorAll('.group.flex.flex-col.-mx-4'));
        if (msgItems.length > 0) {
          const target = msgItems[0];
          const rect = target.getBoundingClientRect();
          const evt = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + 150,
            clientY: rect.top + 20
          });
          target.dispatchEvent(evt);
          return { success: true, msgFound: true };
        }
        return { success: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Message context menu trigger:', msgMenuOpen.result.value);

  await new Promise(r => setTimeout(r, 600));
  ss = await send('Page.captureScreenshot', { format: 'png' });
  ssPath = path.join(artifactDir, 'electron-live-message-context-menu.png');
  fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
  console.log('Saved message context menu screenshot to:', ssPath);

  // Close message menu
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await new Promise(r => setTimeout(r, 400));

  // 6. Navigate to Amigos and test right-click on friend
  console.log('\n[6/6] Navigating to Amigos and testing friends context menu...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const store = window.__discordStore?.getState();
        if (store) {
          store.setActiveServer('@me');
          store.setActiveChannel('me-friends');
        }
      })()
    `
  });

  await new Promise(r => setTimeout(r, 800));

  const friendMenuOpen = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const friendRows = Array.from(document.querySelectorAll('.flex.items-center.justify-between.p-2\\\\.5'));
        if (friendRows.length > 0) {
          const target = friendRows[0];
          const rect = target.getBoundingClientRect();
          const evt = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + 120,
            clientY: rect.top + 20
          });
          target.dispatchEvent(evt);
          return { success: true, friendText: target.textContent.trim() };
        }
        return { success: false, rows: friendRows.length };
      })()
    `,
    returnByValue: true
  });
  console.log('Friend context menu trigger:', friendMenuOpen.result.value);

  await new Promise(r => setTimeout(r, 600));
  ss = await send('Page.captureScreenshot', { format: 'png' });
  ssPath = path.join(artifactDir, 'electron-live-friend-context-menu.png');
  fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
  console.log('Saved friend context menu screenshot to:', ssPath);

  // Return to server-lyc and chat-geral
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await new Promise(r => setTimeout(r, 300));

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const store = window.__discordStore?.getState();
        if (store) {
          store.setActiveServer('server-lyc');
          store.setActiveChannel('ch-geral');
        }
      })()
    `
  });

  await new Promise(r => setTimeout(r, 800));

  // Final screenshot of clean running app
  ss = await send('Page.captureScreenshot', { format: 'png' });
  ssPath = path.join(artifactDir, 'electron-live-final-ready.png');
  fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
  console.log('Saved final app screenshot to:', ssPath);

  ws.close();
}

main().catch(console.error);
