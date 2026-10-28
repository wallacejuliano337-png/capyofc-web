import { chromium } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520';

async function run() {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 750 } });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Authenticate as Coronel (Founder)
  await page.evaluate(() => {
    window.__DISCORD_STORE__.getState().login({
      id: 'f8fcd139-cf43-4873-bd7d-a807ecd73567',
      name: 'coronel',
      displayName: 'Coronel Fundador',
      status: 'online',
    });
  });

  await page.waitForTimeout(1500);

  const authorEl = await page.$('span:has-text("Ares")') || await page.$('img[alt="Ares"]') || await page.$('.w-10.h-10.rounded-full');
  if (authorEl) {
    await authorEl.click({ button: 'right' });
    await page.waitForTimeout(700);

    const cargosItem = await page.$('button:has-text("Cargos")');
    if (cargosItem) {
      await cargosItem.click();
      await page.waitForTimeout(700);
    }

    const contextMenuPath = path.join(ARTIFACT_DIR, 'role-attribution-context-menu-verified.png');
    await page.screenshot({ path: contextMenuPath });
    console.log('Captured user context menu with roles submenu:', contextMenuPath);
  }

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
