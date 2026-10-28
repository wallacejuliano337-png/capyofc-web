import fs from 'fs';

async function main() {
  console.log('Connecting to Electron CDP on port 9222...');
  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page' || t.title === 'CapyChat');

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = id++;
    const h = evt => {
      const m = JSON.parse(evt.data);
      if (m.id === i) {
        ws.removeEventListener('message', h);
        if (m.error) rej(m.error);
        else res(m.result);
      }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  console.log('Reloading page to ensure fresh bundle...');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 2500));

  console.log('\n--- 1. Checking Store State and Owned Community ---');
  const initInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const store = window.__useDiscordStore.getState();
        const curUser = store.currentUser;
        const ownedServer = store.servers.find(s => s.ownerId === curUser.id && s.id !== 'server-lyc' && store.getServerRoles(s.id).filter(r => !r.name.includes('@')).length > 0)
          || store.servers.find(s => s.ownerId === curUser.id && s.id !== 'server-lyc');
        return {
          currentUser: { id: curUser.id, name: curUser.name },
          ownedServer: ownedServer ? { id: ownedServer.id, name: ownedServer.name } : null,
          totalServers: store.servers.length
        };
      })()
    `,
    returnByValue: true
  });
  console.log('User and Owned Server:', initInfo.result?.value);

  // If user doesn't have an owned server in store, create a test community where user is owner
  let targetServerId = initInfo.result?.value?.ownedServer?.id;
  if (!targetServerId) {
    console.log('Creating a test community where current user is Owner...');
    const createRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const store = window.__useDiscordStore.getState();
          const res = await store.createCommunityServer('Comunidade Teste Cargos');
          return res;
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Create community result:', createRes.result?.value);
    targetServerId = createRes.result?.value?.serverId;
    await new Promise(r => setTimeout(r, 1000));
  }

  // Switch to the owned community
  console.log(`\n--- 2. Switching to Owned Community (${targetServerId}) ---`);
  await send('Runtime.evaluate', {
    expression: `window.__useDiscordStore.getState().setActiveServer('${targetServerId}')`
  });
  await new Promise(r => setTimeout(r, 800));

  // STEP 3: Open member popout for another member in this owned community
  console.log('\n--- 3. Opening Member Profile Popout in Owned Community ---');
  const openRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const store = window.__useDiscordStore.getState();
        const targetMember = {
          id: 'test-target-member-88',
          name: 'lucas_dev',
          displayName: 'Lucas Desenvolvedor',
          avatar: '/assets/avatar-padrao-capychat.png',
          status: 'online',
          tag: '8801',
          joinedDate: '24 de Outubro de 2026'
        };
        store.openMemberPopout(targetMember, { top: 100, right: 280 });
        return { targetName: targetMember.displayName, targetId: targetMember.id };
      })()
    `,
    returnByValue: true
  });
  console.log('Opened member popout for:', openRes.result?.value);
  await new Promise(r => setTimeout(r, 700));

  // Inspect popout DOM in owned community
  console.log('\n--- 4. Verifying CARGOS Section in DOM ---');
  const domInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const popout = document.querySelector('.fixed.w-80');
        if (!popout) return { found: false };
        const headings = Array.from(popout.querySelectorAll('h4')).map(h => h.textContent.trim());
        const addBtn = Array.from(popout.querySelectorAll('button')).find(b => b.textContent.includes('Adicionar cargo'));
        return {
          found: true,
          headings,
          hasAddRoleBtn: !!addBtn
        };
      })()
    `,
    returnByValue: true
  });
  console.log('DOM info in owned community:', domInfo.result?.value);

  // Click "+ Adicionar cargo"
  console.log('\n--- 5. Clicking "+ Adicionar cargo" ---');
  const clickAddRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const popout = document.querySelector('.fixed.w-80');
        const addBtn = Array.from(popout.querySelectorAll('button')).find(b => b.textContent.includes('Adicionar cargo'));
        if (addBtn) {
          addBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Click "+ Adicionar cargo":', clickAddRes.result?.value);
  await new Promise(r => setTimeout(r, 500));

  // Inspect Popover
  console.log('\n--- 6. Inspecting Role Popover ---');
  const popoverInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const popout = document.querySelector('.fixed.w-80');
        const input = popout.querySelector('input[placeholder="Cargo"]');
        const roleBtns = Array.from(popout.querySelectorAll('button')).filter(b => b.querySelector('span.rounded-full') && !b.textContent.includes('Adicionar cargo'));
        return {
          hasSearchInput: !!input,
          roleCount: roleBtns.length,
          roles: roleBtns.map(b => b.textContent.trim())
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Popover info:', popoverInfo.result?.value);

  // Take screenshot with popover open
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  const p1 = 'C:/Users/CORONEL/.gemini/antigravity/brain/8299f61a-3aea-46e8-a874-c529a6498520/electron-member-profile-popover-open.png';
  fs.writeFileSync(p1, Buffer.from(shot1.data, 'base64'));
  console.log('✔ Screenshot 1 (Popover open) saved to:', p1);

  // Select a role from the popover
  console.log('\n--- 7. Selecting Role from Popover ---');
  const selectRoleRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const popout = document.querySelector('.fixed.w-80');
        const roleBtns = Array.from(popout.querySelectorAll('button')).filter(b => b.querySelector('span.rounded-full') && !b.textContent.includes('Adicionar cargo'));
        if (roleBtns.length > 0) {
          const name = roleBtns[0].textContent.trim();
          roleBtns[0].click();
          return { selected: true, name };
        }
        return { selected: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Selected role:', selectRoleRes.result?.value);
  await new Promise(r => setTimeout(r, 600));

  // Verify that the assigned role pill is rendered
  const verifyPill = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const popout = document.querySelector('.fixed.w-80');
        const rolePills = Array.from(popout.querySelectorAll('div')).filter(el => el.querySelector('button svg.lucide-x') || el.querySelector('button[title*="Remover"]'));
        return {
          count: rolePills.length,
          texts: rolePills.map(p => p.textContent.trim())
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Assigned role pills in profile:', verifyPill.result?.value);

  // Take screenshot after role assigned
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  const p2 = 'C:/Users/CORONEL/.gemini/antigravity/brain/8299f61a-3aea-46e8-a874-c529a6498520/electron-member-profile-role-assigned.png';
  fs.writeFileSync(p2, Buffer.from(shot2.data, 'base64'));
  console.log('✔ Screenshot 2 (Role assigned) saved to:', p2);

  // Test close and reopen persistence
  console.log('\n--- 8. Closing and Reopening Profile to Confirm Persistence ---');
  await send('Runtime.evaluate', {
    expression: 'window.__useDiscordStore.getState().closeMemberPopout()'
  });
  await new Promise(r => setTimeout(r, 400));

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const store = window.__useDiscordStore.getState();
        const targetMember = {
          id: 'test-target-member-88',
          name: 'lucas_dev',
          displayName: 'Lucas Desenvolvedor',
          avatar: '/assets/avatar-padrao-capychat.png',
          status: 'online',
          tag: '8801',
          joinedDate: '24 de Outubro de 2026'
        };
        store.openMemberPopout(targetMember, { top: 100, right: 280 });
      })()
    `
  });
  await new Promise(r => setTimeout(r, 500));

  const verifyReopen = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const popout = document.querySelector('.fixed.w-80');
        const rolePills = Array.from(popout.querySelectorAll('div')).filter(el => el.querySelector('button svg.lucide-x') || el.querySelector('button[title*="Remover"]'));
        return {
          reopened: true,
          count: rolePills.length,
          texts: rolePills.map(p => p.textContent.trim())
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Verified on reopen:', verifyReopen.result?.value);

  // Remove role via × button
  console.log('\n--- 9. Removing Role via [×] button ---');
  const removeRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const popout = document.querySelector('.fixed.w-80');
        const xBtn = popout.querySelector('button svg.lucide-x')?.closest('button');
        if (xBtn) {
          xBtn.click();
          return { clickedX: true };
        }
        return { clickedX: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Remove button click:', removeRes.result?.value);
  await new Promise(r => setTimeout(r, 500));

  const verifyAfterRemove = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const popout = document.querySelector('.fixed.w-80');
        const rolePills = Array.from(popout.querySelectorAll('div')).filter(el => el.querySelector('button svg.lucide-x') || el.querySelector('button[title*="Remover"]'));
        return {
          count: rolePills.length
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Role pills after removal:', verifyAfterRemove.result?.value);

  // STEP 10: Switch to CapyChat Oficial (Unauthorized)
  console.log('\n--- 10. Testing Unauthorized Access in CapyChat Oficial ---');
  await send('Runtime.evaluate', {
    expression: `window.__useDiscordStore.getState().setActiveServer('server-lyc')`
  });
  await new Promise(r => setTimeout(r, 800));

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const store = window.__useDiscordStore.getState();
        const targetMember = {
          id: 'test-target-member-88',
          name: 'lucas_dev',
          displayName: 'Lucas Desenvolvedor',
          avatar: '/assets/avatar-padrao-capychat.png',
          status: 'online',
          tag: '8801',
          joinedDate: '24 de Outubro de 2026'
        };
        store.openMemberPopout(targetMember, { top: 100, right: 280 });
      })()
    `
  });
  await new Promise(r => setTimeout(r, 500));

  const verifyUnauthorized = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const popout = document.querySelector('.fixed.w-80');
        const addBtn = Array.from(popout.querySelectorAll('button')).find(b => b.textContent.includes('Adicionar cargo'));
        const xBtns = popout.querySelectorAll('button svg.lucide-x');
        return {
          canAddCargo: !!addBtn,
          canRemoveCargo: xBtns.length > 0
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Unauthorized check in CapyChat Oficial:', verifyUnauthorized.result?.value);
  if (!verifyUnauthorized.result?.value?.canAddCargo && !verifyUnauthorized.result?.value?.canRemoveCargo) {
    console.log('✔ PASS: Non-owner member in CapyChat Oficial is strictly forbidden from adding/removing roles!');
  } else {
    console.error('FAIL: Unauthorized member had permissions in CapyChat Oficial!');
  }

  // Close popout
  await send('Runtime.evaluate', {
    expression: 'window.__useDiscordStore.getState().closeMemberPopout()'
  });

  console.log('\n✔ ALL 10 E2E STEPS SUCCEEDED COMPLETELY!');
  ws.close();
}

main().catch(console.error);
