import { describe, expect, it } from 'vitest';
import { CARD_FIXTURES } from './cardFixtures';
import { paintToCss, resolveCardTokens } from './cardTokens';

describe('resolveCardTokens', () => {
  it('prefers the chosen board over the template board', () => {
    expect(resolveCardTokens('polaroid', {}, 'common').stock).toBe('#fcfaf4');
    expect(resolveCardTokens('polaroid', { stock: 'cream' }, 'common').stock).toBe('#f4ecda');
  });

  it('lightens text on a dark board', () => {
    const t = resolveCardTokens('classic', { stock: 'ink' }, 'common');
    expect(t.ink).toBe('#fffdf7');
    expect(t.inkMuted).toBe('#cdd6d2');
    expect(t.artBg).toBe('rgba(0, 0, 0, 0.24)');
  });

  it('keeps the template text colours on a light board', () => {
    const t = resolveCardTokens('minimal', { stock: 'cream' }, 'common');
    expect(t.ink).toBe('#fdf9ee');
    expect(t.inkMuted).toBe('rgba(253, 249, 238, 0.8)');
  });

  it('gives rarity a metallic edge above common', () => {
    expect(resolveCardTokens('classic', { stock: 'cream' }, 'common').edge).toEqual({
      kind: 'solid',
      color: '#d8cdb4',
    });
    const legendary = resolveCardTokens(
      'classic',
      { stock: 'cream', border: 'rarity' },
      'legendary',
    );
    expect(legendary.edge.kind).toBe('gradient');
    expect(paintToCss(legendary.edge)).toContain('linear-gradient(135deg');
    expect(legendary.edgeWidth).toBe(0.7);
    expect(legendary.core).toBe('#f4e7c4');
    expect(legendary.glow).toBe('rgba(184, 144, 58, 0.38)');
  });

  it('leaves the edge alone for an ink that is not the rarity', () => {
    const t = resolveCardTokens('classic', { stock: 'cream', border: 'gold' }, 'legendary');
    expect(t.edge).toEqual({ kind: 'solid', color: '#7c5f1e' });
    expect(t.edgeWidth).toBe(0.7);
  });

  it('treats an auto border as the board edge, not the rarity edge', () => {
    const t = resolveCardTokens('classic', { stock: 'cream', border: 'auto' }, 'rare');
    expect(t.edge).toEqual({ kind: 'solid', color: '#d8cdb4' });
    expect(t.border).toBe('#7b5fa3');
  });

  it('resolves rarity borders and accents to the rarity colour', () => {
    const t = resolveCardTokens('classic', { border: 'rarity', accent: 'rarity' }, 'epic');
    expect(t.border).toBe('#c0568c');
    expect(t.accent).toBe('#c0568c');
    expect(t.edge.kind).toBe('gradient');
  });

  it('takes the edge width from the choice, or the template', () => {
    expect(resolveCardTokens('classic', { border: 'rarity' }, 'epic').edgeWidth).toBe(0.7);
    expect(resolveCardTokens('classic', {}, 'legendary').edgeWidth).toBe(0.7);
    expect(resolveCardTokens('classic', { border_width: 'hairline' }, 'legendary').edgeWidth).toBe(
      1.2,
    );
    expect(resolveCardTokens('classic', { border_width: 'thick' }, 'common').edgeWidth).toBe(4.4);
  });

  it('softens every untextured dark board, including cocoa and aubergine', () => {
    const softened = { image: null, size: null, opacity: 0.2, blend: 'screen' };
    for (const stock of ['ink', 'slate', 'wine', 'cocoa', 'aubergine']) {
      expect(resolveCardTokens('classic', { stock }, 'common').texture, stock).toEqual(softened);
    }
    expect(resolveCardTokens('classic', { stock: 'cream' }, 'common').texture).toBeNull();
  });
});

describe('paintToCss', () => {
  it('writes solids and gradients as CSS', () => {
    expect(paintToCss({ kind: 'solid', color: '#abc' })).toBe('#abc');
    expect(
      paintToCss({
        kind: 'gradient',
        angle: 160,
        stops: [{ color: '#dcc078' }, { color: '#b48a2c', at: 46 }],
      }),
    ).toBe('linear-gradient(160deg, #dcc078, #b48a2c 46%)');
  });
});

describe('card fixtures', () => {
  it('resolves every fixture to complete tokens', () => {
    expect(CARD_FIXTURES.length).toBeGreaterThan(0);
    for (const fixture of CARD_FIXTURES) {
      const t = resolveCardTokens(fixture.templateKey, fixture.config, fixture.rarity);
      expect(t.stock, fixture.name).toMatch(/^#[0-9a-f]{6}$/);
      expect(t.edgeWidth, fixture.name).toBeGreaterThan(0);
      expect(paintToCss(t.edge), fixture.name).not.toBe('');
    }
  });
});
