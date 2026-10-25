import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  SERVER_TAG_BADGES,
  resolveServerTagBadgeItem,
  resolveServerTagBadgeIcon,
  resolveServerTagBadge,
} from '../src/types/discord';

describe('Server Tag Insignias (Pixel Art)', () => {
  it('contains exactly 15 pixel art insignia options', () => {
    expect(SERVER_TAG_BADGES).toHaveLength(15);
  });

  it('includes all visual references requested', () => {
    const ids = SERVER_TAG_BADGES.map((b) => b.id);
    expect(ids).toContain('broto-verde');
    expect(ids).toContain('caneca-cafe');
    expect(ids).toContain('capy');
    expect(ids).toContain('coracao-rosa');
    expect(ids).toContain('coroa-dourada');
    expect(ids).toContain('fogueira');
    expect(ids).toContain('laranja');
    expect(ids).toContain('estrela-dourada');
    expect(ids).toContain('fones-gamer');
    expect(ids).toContain('gota-dagua');
    expect(ids).toContain('pata-roxa');
    expect(ids).toContain('pata');
    expect(ids).toContain('raio-dourado');
    expect(ids).toContain('folha-verde');
    expect(ids).toContain('lua-crescente');
  });

  it('ensures each insignia file exists on disk in public/assets/insignias/', () => {
    const publicDir = path.resolve(__dirname, '../public');
    for (const badge of SERVER_TAG_BADGES) {
      const filePath = path.join(publicDir, badge.iconUrl);
      expect(fs.existsSync(filePath), `File should exist: ${badge.iconUrl}`).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(1000);
    }
  });

  it('resolves insignia icon correctly with priority for custom upload', () => {
    // Custom upload takes precedence
    const custom = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    expect(resolveServerTagBadgeIcon('capy', custom)).toBe(custom);

    // Predefined insignia returns its iconUrl
    expect(resolveServerTagBadgeIcon('capy', null)).toBe('/assets/insignias/capy.png');
    expect(resolveServerTagBadgeIcon('fogueira')).toBe('/assets/insignias/fogueira.png');
  });

  it('gracefully maps legacy badge IDs to preserve backward compatibility', () => {
    expect(resolveServerTagBadgeItem('gem').id).toBe('coroa-dourada');
    expect(resolveServerTagBadgeItem('leaf').id).toBe('folha-verde');
    expect(resolveServerTagBadgeItem('heart').id).toBe('coracao-rosa');
    expect(resolveServerTagBadgeItem('fire').id).toBe('fogueira');
    expect(resolveServerTagBadgeItem('drop').id).toBe('gota-dagua');
    expect(resolveServerTagBadgeItem('moon').id).toBe('lua-crescente');
    expect(resolveServerTagBadgeItem('zap').id).toBe('raio-dourado');
    expect(resolveServerTagBadgeItem('mushroom').id).toBe('broto-verde');
  });
});
