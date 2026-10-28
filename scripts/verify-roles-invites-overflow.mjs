import { chromium } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\CORONEL\\.gemini\\antigravity\\brain\\8299f61a-3aea-46e8-a874-c529a6498520';

async function run() {
  console.log('Verifying roles, invites and text overflow in CapyChat...');
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
      displayName: 'Coronel Fundador ComNomeExtremamenteLongoParaTestarOverflowDeTextoSemQuebrarLayout',
      aboutMe: 'Biografia extremamente detalhada e longa contendo palavras-chave-sem-espaco-para-garantir-que-o-overflow-wrap-anywhere-e-min-width-0-funcionem-perfeitamente-em-todas-as-telas-desktop-e-mobile.',
      customStatus: 'Desenvolvendo o CapyChat Oficial com maestria ✨',
      status: 'online',
    });
  });

  await page.waitForTimeout(1500);

  // 1. Open User Profile Popout to verify text overflow resilience & badge tooltip
  await page.evaluate(() => {
    const store = window.__DISCORD_STORE__.getState();
    store.openMemberPopout(store.currentUser, { top: 60, right: 360 });
  });
  await page.waitForTimeout(1000);

  // Hover over the first badge to trigger adaptive explanatory tooltip
  const badgeEl = await page.$('.relative.inline-flex.items-center.justify-center.group');
  if (badgeEl) {
    await badgeEl.hover();
    await page.waitForTimeout(500);
  }

  const popoutPath = path.join(ARTIFACT_DIR, 'profile-popout-overflow-verified.png');
  await page.screenshot({ path: popoutPath });
  console.log('Captured profile popout screenshot:', popoutPath);

  // Close popout
  await page.evaluate(() => {
    window.__DISCORD_STORE__.getState().closeMemberPopout();
  });
  await page.waitForTimeout(500);

  // 2. Open Server Dropdown and click "Convidar Pessoas"
  const serverHeaderBtn = await page.$('button:has-text("CapyChat")');
  if (serverHeaderBtn) {
    await serverHeaderBtn.click();
    await page.waitForTimeout(500);

    const inviteBtn = await page.$('button:has-text("Convidar Pessoas")');
    if (inviteBtn) {
      await inviteBtn.click();
      await page.waitForTimeout(800);
      const inviteModalPath = path.join(ARTIFACT_DIR, 'server-invite-modal-verified.png');
      await page.screenshot({ path: inviteModalPath });
      console.log('Captured server invite modal screenshot:', inviteModalPath);
    }
  }

  // Close invite modal by pressing ESC
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 3. Right click on a member in the member list to show moderation roles menu
  const memberItem = await page.$('[data-member-id], .group.relative.flex.items-center.gap-3');
  if (memberItem) {
    await memberItem.click({ button: 'right' });
    await page.waitForTimeout(600);

    // Hover on "Cargos" submenu
    const rolesMenuItem = await page.$('button:has-text("Cargos"), div:has-text("Cargos")');
    if (rolesMenuItem) {
      await rolesMenuItem.hover();
      await page.waitForTimeout(500);
    }

    const contextMenuPath = path.join(ARTIFACT_DIR, 'role-attribution-context-menu-verified.png');
    await page.screenshot({ path: contextMenuPath });
    console.log('Captured role context menu screenshot:', contextMenuPath);
  }

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
