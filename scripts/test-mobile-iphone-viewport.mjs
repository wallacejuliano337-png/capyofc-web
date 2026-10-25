import { chromium, devices } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520';

async function run() {
  console.log('Capturing complete iPhone 15 Pro mobile walkthrough...');
  const iPhone = devices['iPhone 15 Pro'] || {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  };

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  }

  const context = await browser.newContext({
    ...iPhone,
    viewport: { width: 393, height: 852 },
    colorScheme: 'dark',
  });

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Autenticar via store
  await page.evaluate(() => {
    const store = window.__DISCORD_STORE__;
    if (store) {
      store.getState().login({
        id: 'user-coronel',
        name: 'coronel',
        displayName: 'Coronel Capy',
        avatar: '/assets/avatar-padrao-capychat.png',
        tag: '#0001',
        status: 'online',
      });
    }
  });

  await page.waitForTimeout(1500);

  // 1. Screenshot Chat View em tela cheia no iPhone
  const chatPath = path.join(ARTIFACT_DIR, 'iphone-mobile-chat-view.png');
  await page.screenshot({ path: chatPath });
  console.log('Captured chat view screenshot:', chatPath);

  // 2. Voltar para a lista de canais usando o botão de voltar
  const backBtn = page.locator('button[title="Voltar aos canais"]').first();
  if (await backBtn.count() > 0) {
    await backBtn.click();
    await page.waitForTimeout(800);
  }

  // 3. Screenshot Canais / Servidores (com pílula ∞ e lista de canais)
  const channelsPath = path.join(ARTIFACT_DIR, 'iphone-mobile-channels-tab.png');
  await page.screenshot({ path: channelsPath });
  console.log('Captured channels list screenshot:', channelsPath);

  // 4. Aba Mensagens Diretas (DMs)
  const dmsBtn = page.locator('button:has-text("Mensagens")').first();
  if (await dmsBtn.count() > 0) {
    await dmsBtn.click();
    await page.waitForTimeout(800);
    const dmsPath = path.join(ARTIFACT_DIR, 'iphone-mobile-dms-tab.png');
    await page.screenshot({ path: dmsPath });
    console.log('Captured DMs tab screenshot:', dmsPath);
  }

  // 5. Aba Você (Perfil e Opções)
  const youBtn = page.locator('button:has-text("Você")').first();
  if (await youBtn.count() > 0) {
    await youBtn.click();
    await page.waitForTimeout(800);
    const youPath = path.join(ARTIFACT_DIR, 'iphone-mobile-you-tab.png');
    await page.screenshot({ path: youPath });
    console.log('Captured You tab screenshot:', youPath);

    // 6. Abrir o modal PWA de instalação no iPhone
    const installBtn = page.locator('button:has-text("Instalar CapyChat no iPhone")').first();
    if (await installBtn.count() > 0) {
      await installBtn.click();
      await page.waitForTimeout(800);
      const modalPath = path.join(ARTIFACT_DIR, 'iphone-mobile-pwa-modal.png');
      await page.screenshot({ path: modalPath });
      console.log('Captured PWA install modal screenshot:', modalPath);
    }
  }

  await browser.close();
  console.log('All mobile walkthrough screenshots captured successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
