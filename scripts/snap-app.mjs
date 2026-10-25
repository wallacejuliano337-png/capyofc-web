import fs from 'fs';

async function main() {
  const targets = await fetch('http://localhost:9222/json').then(r => r.json());
  console.log('Targets:', targets.map(t => ({ id: t.id, title: t.title, url: t.url })));
  const page = targets.find(t => t.url && t.url.includes('5173'));
  if (!page) {
    console.log('No page on 5173');
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });

  function sendCmd(method, params = {}) {
    return new Promise(resolve => {
      const id = Math.floor(Math.random() * 100000);
      const onMsg = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.id === id) {
            ws.removeEventListener('message', onMsg);
            resolve(d.result);
          }
        } catch {}
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Reload page
  console.log('Reloading page...');
  await sendCmd('Page.reload');
  await new Promise(r => setTimeout(r, 2000));

  // Get text sample
  const evalRes = await sendCmd('Runtime.evaluate', {
    expression: 'document.body.innerText.slice(0, 300)',
    returnByValue: true
  });
  console.log('Body text sample:', evalRes?.result?.value);

  // Capture screenshot
  const shot = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (shot?.data) {
    fs.writeFileSync('C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520\\electron-app-open.png', Buffer.from(shot.data, 'base64'));
    console.log('Screenshot saved to electron-app-open.png');
  }

  ws.close();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
