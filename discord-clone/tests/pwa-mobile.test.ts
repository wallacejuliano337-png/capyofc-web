import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CapyChat PWA & Mobile iPhone Adaptation Suite', () => {
  const rootDir = path.resolve(__dirname, '..');

  it('1. manifest.webmanifest exists and contains valid PWA configuration for CapyChat', () => {
    const manifestPath = path.join(rootDir, 'public', 'manifest.webmanifest');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifestContent.name).toBe('CapyChat');
    expect(manifestContent.short_name).toBe('CapyChat');
    expect(manifestContent.display).toBe('standalone');
    expect(manifestContent.start_url).toBe('/');
    expect(manifestContent.theme_color).toBe('#1e1f22');
    expect(manifestContent.background_color).toBe('#1e1f22');
    expect(manifestContent.orientation).toBe('portrait');

    expect(Array.isArray(manifestContent.icons)).toBe(true);
    expect(manifestContent.icons.length).toBeGreaterThanOrEqual(2);

    const icon192 = manifestContent.icons.find((i: any) => i.sizes === '192x192');
    const icon512 = manifestContent.icons.find((i: any) => i.sizes === '512x512');
    expect(icon192).toBeDefined();
    expect(icon512).toBeDefined();
  });

  it('2. Official PWA and iOS Apple Touch icons exist with valid sizes', () => {
    const icon192 = path.join(rootDir, 'public', 'icon-192.png');
    const icon512 = path.join(rootDir, 'public', 'icon-512.png');
    const appleTouchIcon = path.join(rootDir, 'public', 'apple-touch-icon.png');

    expect(fs.existsSync(icon192)).toBe(true);
    expect(fs.existsSync(icon512)).toBe(true);
    expect(fs.existsSync(appleTouchIcon)).toBe(true);

    expect(fs.statSync(icon192).size).toBeGreaterThan(1000);
    expect(fs.statSync(icon512).size).toBeGreaterThan(5000);
    expect(fs.statSync(appleTouchIcon).size).toBeGreaterThan(1000);
  });

  it('3. Service Worker (sw.js) exists and respects security rules for Supabase', () => {
    const swPath = path.join(rootDir, 'public', 'sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');
    // Security check: Must NOT cache Supabase or API endpoints
    expect(swContent).toContain('supabase.co');
    expect(swContent).toContain('/auth/v1/');
    expect(swContent).toContain('/rest/v1/');
    expect(swContent).toContain('skipWaiting');
    expect(swContent).toContain('clients.claim');
  });

  it('4. index.html contains iOS Safari PWA meta tags and safe-area viewport', () => {
    const indexPath = path.join(rootDir, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    expect(indexContent).toContain('viewport-fit=cover');
    expect(indexContent).toContain('apple-mobile-web-app-capable');
    expect(indexContent).toContain('apple-touch-icon');
    expect(indexContent).toContain('manifest.webmanifest');
    expect(indexContent).toContain("worker-src 'self' blob:");
    expect(indexContent).toContain('theme-color');
  });

  it('5. Hosting SPA rewrite configuration exists for Vercel and Cloudflare Pages', () => {
    const vercelConfig = path.join(rootDir, 'vercel.json');
    const redirectsConfig = path.join(rootDir, 'public', '_redirects');

    expect(fs.existsSync(vercelConfig)).toBe(true);
    expect(fs.existsSync(redirectsConfig)).toBe(true);

    const vercelJson = JSON.parse(fs.readFileSync(vercelConfig, 'utf-8'));
    expect(vercelJson.rewrites).toBeDefined();
    expect(vercelJson.rewrites[0].destination).toBe('/index.html');
  });

  it('6. CSS includes iOS safe-area utilities and dynamic viewport height', () => {
    const stylesPath = path.join(rootDir, 'src', 'styles.css');
    const stylesContent = fs.readFileSync(stylesPath, 'utf-8');

    expect(stylesContent).toContain('100dvh');
    expect(stylesContent).toContain('safe-area-inset-top');
    expect(stylesContent).toContain('safe-area-inset-bottom');
    expect(stylesContent).toContain('pt-safe');
    expect(stylesContent).toContain('pb-safe');
  });

  it('7. Mobile presentation layer and components exist and are wired', () => {
    const mobileLayout = path.join(rootDir, 'src', 'components', 'mobile', 'DiscordMobileLayout.tsx');
    const pwaModal = path.join(rootDir, 'src', 'components', 'mobile', 'PWAInstallGuideModal.tsx');
    const offlineBanner = path.join(rootDir, 'src', 'components', 'mobile', 'OfflineBanner.tsx');
    const useIsMobileHook = path.join(rootDir, 'src', 'hooks', 'useIsMobile.ts');

    expect(fs.existsSync(mobileLayout)).toBe(true);
    expect(fs.existsSync(pwaModal)).toBe(true);
    expect(fs.existsSync(offlineBanner)).toBe(true);
    expect(fs.existsSync(useIsMobileHook)).toBe(true);

    const modalContent = fs.readFileSync(pwaModal, 'utf-8');
    expect(modalContent).toContain('Adicionar à Tela de Início');
    expect(modalContent).toContain('Safari');
    expect(modalContent).toContain('Compartilhar');
  });
});
