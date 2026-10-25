import http from 'http';

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

  const res = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const imgs = Array.from(document.querySelectorAll('img')).filter(i => i.src && i.src.includes('avatar-padrao'));
        return imgs.map(i => ({
          src: i.src,
          naturalWidth: i.naturalWidth,
          naturalHeight: i.naturalHeight,
          width: i.width,
          height: i.height,
          complete: i.complete,
          currentSrc: i.currentSrc
        }));
      })()
    `,
    returnByValue: true
  });

  console.log('Images info:', res.result.value);
  ws.close();
}

main().catch(console.error);
