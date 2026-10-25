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

  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise(resolve => ws.onopen = resolve);
  console.log('Connected to CDP');

  const artifactDir = 'C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520';

  // 1. Switch to Login View by setting isAuthenticated: false in store
  console.log('\n[1/5] Setting isAuthenticated: false in store...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        if (window.__discordStore) {
          window.__discordStore.setState({ isAuthenticated: false });
        }
      })()
    `
  });

  await new Promise(r => setTimeout(r, 600));

  // Capture Login view
  let ss = await send('Page.captureScreenshot', { format: 'png' });
  let loginPath = path.join(artifactDir, 'electron-live-login-screen.png');
  fs.writeFileSync(loginPath, Buffer.from(ss.data, 'base64'));
  console.log('Saved Login view screenshot to:', loginPath);

  // 2. Click "Registre-se"
  console.log('\n[2/5] Clicking "Registre-se"...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const regBtn = buttons.find(b => b.textContent && b.textContent.includes('Registre-se'));
        if (regBtn) regBtn.click();
      })()
    `
  });

  await new Promise(r => setTimeout(r, 600));

  // Capture Register view
  ss = await send('Page.captureScreenshot', { format: 'png' });
  let regPath = path.join(artifactDir, 'electron-live-register-screen.png');
  fs.writeFileSync(regPath, Buffer.from(ss.data, 'base64'));
  console.log('Saved Register view screenshot to:', regPath);

  // 3. Fill in registration form
  const timestamp = Date.now().toString().slice(-5);
  const testEmail = `capy.novo.${timestamp}@gmail.com`;
  const testPass = 'NovoCapy123!';
  const testUser = `novouser_${timestamp}`;
  const testDisplay = `Capy Membro ${timestamp}`;

  console.log('\n[3/5] Filling in registration form for:', testEmail);
  const fillRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        function setNativeValue(element, value) {
          const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
          const prototype = Object.getPrototypeOf(element);
          const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
          } else if (valueSetter) {
            valueSetter.call(element, value);
          } else {
            element.value = value;
          }
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (inputs[0]) setNativeValue(inputs[0], "${testDisplay}");
        if (inputs[1]) setNativeValue(inputs[1], "${testUser}");
        if (inputs[2]) setNativeValue(inputs[2], "${testEmail}");
        if (inputs[3]) setNativeValue(inputs[3], "${testPass}");

        return {
          inputsFound: inputs.length,
          values: inputs.map(i => i.value)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Fill form result:', fillRes.result.value);

  await new Promise(r => setTimeout(r, 500));

  // 4. Click Submit
  console.log('\n[4/5] Clicking "Continuar" to submit registration to Supabase...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const submitBtn = buttons.find(b => b.type === 'submit' || (b.textContent && b.textContent.includes('Continuar')));
        if (submitBtn) submitBtn.click();
      })()
    `
  });

  console.log('Waiting 4s for Supabase response & auto-login...');
  await new Promise(r => setTimeout(r, 4000));

  // 5. Inspect post-registration state
  console.log('\n[5/5] Checking post-registration status in App...');
  const postState = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const store = window.__discordStore?.getState();
        const errorAlert = document.querySelector('.bg-\\\\[\\\\#f23f43\\\\]');
        const successAlert = document.querySelector('.bg-\\\\[\\\\#23a55a\\\\]');
        return {
          isAuthenticated: store?.isAuthenticated,
          currentUserId: store?.currentUser?.id,
          currentUserName: store?.currentUser?.name,
          currentUserDisplayName: store?.currentUser?.displayName,
          error: errorAlert ? errorAlert.textContent.trim() : null,
          success: successAlert ? successAlert.textContent.trim() : null,
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Post-Registration State:', JSON.stringify(postState.result.value, null, 2));

  // Capture final logged-in screenshot
  ss = await send('Page.captureScreenshot', { format: 'png' });
  let finalPath = path.join(artifactDir, 'electron-live-registered-and-logged-in.png');
  fs.writeFileSync(finalPath, Buffer.from(ss.data, 'base64'));
  console.log('Saved post-registration logged-in screenshot to:', finalPath);

  ws.close();
}

main().catch(console.error);
