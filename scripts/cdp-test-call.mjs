import fs from 'node:fs';

async function main() {
  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page');
  if (!pageTarget) {
    console.error('No page target found');
    process.exit(1);
  }

  console.log('Connecting to target:', pageTarget.webSocketDebuggerUrl);
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  });

  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  console.log('Connected to CDP');

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async function captureScreenshot(filepath) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot to ${filepath}`);
  }

  // Reload page to load newly built code
  console.log('Reloading page via CDP...');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 2500));

  // 1. Inspect initial state
  const state = await evaluate(`(() => {
    return {
      title: document.title,
      dmItems: Array.from(document.querySelectorAll('.social-dm-item')).map(el => el.textContent.trim()),
      voiceCallBtn: Boolean(document.querySelector('.voice-call-btn')),
      videoCallBtn: Boolean(document.querySelector('.video-call-btn')),
      activeCallStage: Boolean(document.querySelector('.active-call-stage')),
      dmHeader: Boolean(document.querySelector('.dm-header')),
    };
  })()`);
  console.log('Initial page state:', state);

  // 2. If voiceCallBtn not found, click .social-dm-item to open DM
  if (!state.voiceCallBtn) {
    console.log('Opening DM by clicking .social-dm-item...');
    const clicked = await evaluate(`(() => {
      const el = document.querySelector('.social-dm-item');
      if (el) { el.click(); return true; }
      return false;
    })()`);
    console.log('Clicked .social-dm-item:', clicked);
    await new Promise(r => setTimeout(r, 1200));
  }

  // 3. Re-inspect state
  const dmState = await evaluate(`(() => {
    const voiceBtn = document.querySelector('.voice-call-btn');
    const videoBtn = document.querySelector('.video-call-btn');
    return {
      voiceCallBtn: Boolean(voiceBtn),
      voiceDisabled: voiceBtn?.disabled,
      videoCallBtn: Boolean(videoBtn),
      videoDisabled: videoBtn?.disabled,
      peerName: document.querySelector('.dm-peer-name')?.textContent,
      peerUsername: document.querySelector('.dm-peer-username')?.textContent,
      activeCallStage: Boolean(document.querySelector('.active-call-stage')),
    };
  })()`);
  console.log('DM state after opening:', dmState);

  // Take screenshot of opened DM
  await captureScreenshot('D:/LYC-Arena/.cache/app-dm-opened.png');

  // 4. Click the Phone button (.voice-call-btn)
  console.log('Clicking .voice-call-btn...');
  const clickRes = await evaluate(`(() => {
    const btn = document.querySelector('.voice-call-btn');
    if (!btn) return { error: 'Button not found' };
    btn.click();
    return { success: true };
  })()`);
  console.log('Click result:', clickRes);

  // 5. Wait 300ms for optimistic state to render and capture screenshot immediately!
  await new Promise(r => setTimeout(r, 300));
  const callState = await evaluate(`(() => {
    const stage = document.querySelector('.active-call-stage');
    const badge = document.querySelector('.status-badge') || document.querySelector('.pre-call-status-badge');
    const name = document.querySelector('.pre-call-name');
    const controls = Array.from(document.querySelectorAll('.call-ctrl-btn')).map(b => b.getAttribute('title') || b.className);
    return {
      hasActiveCallStage: Boolean(stage),
      stageClasses: stage?.className,
      badgeText: badge?.textContent?.trim(),
      peerName: name?.textContent?.trim(),
      controls,
    };
  })()`);
  console.log('Call state immediately after click:', callState);

  // Take screenshot of call state!
  await captureScreenshot('D:/LYC-Arena/.cache/app-call-calling.png');

  // 6. Wait 1500ms and check error handling / reporting
  await new Promise(r => setTimeout(r, 1500));
  const postCallState = await evaluate(`(() => {
    const stage = document.querySelector('.active-call-stage');
    const badge = document.querySelector('.status-badge') || document.querySelector('.pre-call-status-badge');
    const errorNotice = document.querySelector('.error-notice, .error, [class*="error"]');
    return {
      hasActiveCallStage: Boolean(stage),
      badgeText: badge?.textContent?.trim(),
      errorNoticeText: errorNotice?.textContent?.trim(),
    };
  })()`);
  console.log('Post-call state (error feedback):', postCallState);
  await captureScreenshot('D:/LYC-Arena/.cache/app-call-error.png');

  ws.close();
  console.log('CDP test script finished successfully!');
}

main().catch(console.error);
