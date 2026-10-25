import { chromium } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520';

async function run() {
  console.log('Verifying Windows desktop layout (1280x720)...');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Authenticate
  await page.evaluate(() => {
    window.__DISCORD_STORE__.getState().login({
      id: 'user-coronel',
      name: 'coronel',
      displayName: 'Coronel Capy',
      status: 'online',
    });
  });

  await page.waitForTimeout(1500);

  const desktopPath = path.join(ARTIFACT_DIR, 'windows-desktop-verified-layout.png');
  await page.screenshot({ path: desktopPath });
  console.log('Captured desktop screenshot:', desktopPath);

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
