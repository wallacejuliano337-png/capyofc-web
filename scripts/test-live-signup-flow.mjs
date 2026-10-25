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

  // 1. Click "Crie sua conta"
  console.log('\n[1/4] Clicking "Crie sua conta"...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const regBtn = buttons.find(b => b.textContent && b.textContent.includes('Crie sua conta'));
        if (regBtn) {
          regBtn.click();
          return { clicked: true, text: regBtn.textContent };
        }
        return { clicked: false, all: buttons.map(b => b.textContent) };
      })()
    `,
    returnByValue: true
  });
  console.log('Click result:', clickRes.result.value);

  await new Promise(r => setTimeout(r, 600));

  // Capture registration form screen
  let ss = await send('Page.captureScreenshot', { format: 'png' });
  let regScreenPath = path.join(artifactDir, 'electron-live-register-screen.png');
  fs.writeFileSync(regScreenPath, Buffer.from(ss.data, 'base64'));
  console.log('Saved register form screenshot to:', regScreenPath);

  // 2. Fill in registration form
  const timestamp = Date.now().toString().slice(-5);
  const testEmail = `capy.amigo.${timestamp}@gmail.com`;
  const testPass = 'AmigoCapy123!';
  const testUser = `capyamigo_${timestamp}`;
  const testDisplay = `Capy Amigo ${timestamp}`;

  console.log('\n[2/4] Filling registration form for:', testEmail);
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

        // Input order in registration:
        // 0: Nome de exibição
        // 1: Nome de usuário
        // 2: E-mail
        // 3: Senha
        if (inputs[0]) setNativeValue(inputs[0], "${testDisplay}");
        if (inputs[1]) setNativeValue(inputs[1], "${testUser}");
        if (inputs[2]) setNativeValue(inputs[2], "${testEmail}");
        if (inputs[3]) setNativeValue(inputs[3], "${testPass}");

        return {
          count: inputs.length,
          values: inputs.map(i => i.value)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Form inputs filled:', fillRes.result.value);

  await new Promise(r => setTimeout(r, 500));

  // 3. Click "Continuar"
  console.log('\n[3/4] Clicking "Continuar" to register with Supabase...');
  const submitRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const submitBtn = buttons.find(b => b.type === 'submit' || (b.textContent && b.textContent.includes('Continuar')));
        if (submitBtn) {
          submitBtn.click();
          return { clicked: true, text: submitBtn.textContent.trim() };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Submit clicked:', submitRes.result.value);

  console.log('Waiting 5s for Supabase registration & auto-login...');
  await new Promise(r => setTimeout(r, 5000));

  // 4. Verify post-registration status
  console.log('\n[4/4] Verifying post-registration state in App...');
  const postStatus = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const store = window.__discordStore?.getState();
        const errorAlert = document.querySelector('.bg-\\\\[\\\\#f23f43\\\\]');
        const successAlert = document.querySelector('.bg-\\\\[\\\\#23a55a\\\\]');
        return {
          isAuthenticated: store?.isAuthenticated,
          userId: store?.currentUser?.id,
          userName: store?.currentUser?.name,
          displayName: store?.currentUser?.displayName,
          errorText: errorAlert ? errorAlert.textContent.trim() : null,
          successText: successAlert ? successAlert.textContent.trim() : null,
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Post-registration state:', JSON.stringify(postStatus.result.value, null, 2));

  // Capture final screen
  ss = await send('Page.captureScreenshot', { format: 'png' });
  let finalScreenPath = path.join(artifactDir, 'electron-live-registered-and-logged-in.png');
  fs.writeFileSync(finalScreenPath, Buffer.from(ss.data, 'base64'));
  console.log('Saved final screenshot to:', finalScreenPath);

  ws.close();
}

main().catch(console.error);
