import { chromium, devices } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ ...devices['iPhone 15 Pro'], viewport: { width: 393, height: 852 } });
  await page.goto('http://127.0.0.1:5173');
  await page.evaluate(() => {
    window.__DISCORD_STORE__.getState().login({ id: 'user-coronel', name: 'coronel', status: 'online' });
  });
  await page.waitForTimeout(1000);
  const back = page.locator('button[title="Voltar aos canais"]');
  if (await back.count() > 0) await back.click();
  await page.waitForTimeout(500);

  const navStyles = await page.locator('nav').evaluate(el => {
    const s = window.getComputedStyle(el);
    return {
      display: s.display,
      flexDirection: s.flexDirection,
      flexWrap: s.flexWrap,
      gridTemplateColumns: s.gridTemplateColumns,
    };
  });
  console.log('NAV COMPUTED STYLES:', navStyles);
  await browser.close();
}

run();
