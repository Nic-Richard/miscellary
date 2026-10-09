import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEMES, contrast, getTheme } from './themes';

describe('colour themes', () => {
  it('keeps palette 46 as the default and falls back for unknown preferences', () => {
    expect(getTheme().id).toBe(DEFAULT_THEME);
    expect(getTheme('unavailable')).toBe(getTheme());
    expect(getTheme().number).toBe(46);
    expect(getTheme().colors.bg).toBe('#c3c3bb');
    expect(getTheme().colors.sur).toBe('#dfded4');
    expect(THEMES.map((theme) => theme.number).sort((a, b) => a - b)).toEqual([
      2, 4, 7, 9, 24, 28, 29, 31, 39, 45, 46, 48, 50,
    ]);
  });

  it('keeps shared web and mobile tokens readable and consistent', () => {
    for (const theme of THEMES) {
      const c = theme.colors;
      for (const foreground of [c.text, c.muted, c.faint]) {
        expect(contrast(foreground, c.sur)).toBeGreaterThanOrEqual(4.5);
      }
      if (theme.id === 'cream-teal') {
        expect(c.accentText).toBe('#ffffff');
        expect(contrast(c.accentText, c.accent)).toBeGreaterThanOrEqual(3);
      } else {
        expect(contrast(c.accentText, c.accent)).toBeGreaterThanOrEqual(4.5);
      }
      expect(theme.name.split(' / ').every((name) => /^[A-Z]/.test(name))).toBe(true);
      expect(contrast(c.navInk, c.navActive)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.pageText, c.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.pageMuted, c.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.pageAccent, c.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.accentInk, c.sur)).toBeGreaterThanOrEqual(4.5);
      expect(theme.css['--bg']).toBe(c.bg);
      expect(theme.css['--accent']).toBe(c.accent);
    }
  });
});
