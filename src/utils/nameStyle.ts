import React from 'react';

export type NameEffect = 'solid' | 'gradient' | 'neon' | 'cartoon' | 'pop' | 'gummy' | 'prism';

export const FONT_CLASSES: Record<string, string> = {
  sans: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono tracking-wider',
  gothic: 'font-serif italic font-black tracking-wider',
  cyber: 'font-mono uppercase font-black tracking-widest',
  bubble: 'font-sans font-black tracking-wide',
  display: 'font-sans uppercase font-extrabold tracking-tight',
  retro: 'font-mono font-bold',
  comic: 'font-sans font-black italic',
  script: 'font-serif italic font-bold',
  pixel: 'font-mono font-bold tracking-tighter',
  heavy: 'font-sans uppercase font-black',
};

export function getFontClassName(fontId?: string): string {
  if (!fontId) return '';
  return FONT_CLASSES[fontId] || '';
}

export function getStyledNameCSS(
  fontId?: string,
  effect?: NameEffect,
  color?: string
): React.CSSProperties {
  if (!effect && !color) return {};
  const effectiveColor = color || '#ffffff';
  const base: React.CSSProperties = {};

  switch (effect) {
    case 'solid':
      return { ...base, color: effectiveColor };
    case 'gradient':
      return {
        ...base,
        background: `linear-gradient(90deg, ${effectiveColor}, #ffffff)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      };
    case 'neon':
      return {
        ...base,
        color: '#ffffff',
        textShadow: `0 0 5px ${effectiveColor}, 0 0 10px ${effectiveColor}, 0 0 18px ${effectiveColor}`,
      };
    case 'cartoon':
      return {
        ...base,
        color: effectiveColor,
        WebkitTextStroke: '1px #000000',
        textShadow: '2px 2px 0px #000000',
      };
    case 'pop':
      return {
        ...base,
        color: effectiveColor,
        textShadow: `2px 2px 0px #111214, 3px 3px 0px ${effectiveColor}88`,
      };
    case 'gummy':
      return {
        ...base,
        color: effectiveColor,
        textShadow: '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.8)',
      };
    case 'prism':
      return {
        ...base,
        background: 'linear-gradient(90deg, #ff007a, #9b51e0, #00d2ff, #27ae60, #f2c94c)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      };
    default:
      if (color) return { ...base, color };
      return base;
  }
}
