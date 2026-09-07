import { describe, expect, it } from 'vitest';
import { CARD_FIXTURES } from './cardFixtures';
import { paintToCss, resolveCardTokens } from './cardTokens';

describe('resolveCardTokens', () => {
  it('falls back to the base board when no stock is chosen', () => {
    const t = resolveCardTokens('classic', {}, 'common');
    expect(t.stock).toBe('#f8f2e6');
    expect(t.edge).toEqual({ kind: 'solid', color: '#cdbfa6' });
    expect(t.edgeWidth).toBe(0.7);
    expect(t.corner).toBe(3);
    expect(t.ink).toBe('#3a2f26');
  });

  it('takes the stock and its edge from the chosen board', () => {
    const t = resolveCardTokens('classic', { frame: 'sand' }, 'common');
    expect(t.stock).toBe('#e8dcc2');
    expect(t.edge).toEqual({ kind: 'solid', color: '#c8b898' });
  });

  it('prefers the chosen board over the template board', () => {
    expect(resolveCardTokens('polaroid', {}, 'common').stock).toBe('#fcfaf4');
    expect(resolveCardTokens('polaroid', { frame: 'cream' }, 'common').stock).toBe('#f4ecda');
  });

  it('lightens text on a dark board', () => {
    const t = resolveCardTokens('classic', { frame: 'ink' }, 'common');
    expect(t.ink).toBe('#f3ecdd');
    expect(t.inkMuted).toBe('#b9c9c4');
    expect(t.artBg).toBe('rgba(0, 0, 0, 0.24)');
  });

  it('keeps the template text colours on a light board', () => {
    const t = resolveCardTokens('minimal', { frame: 'cream' }, 'common');
    expect(t.ink).toBe('#fdf9ee');
    expect(t.inkMuted).toBe('rgba(253, 249, 238, 0.8)');
  });

  it('gives rarity a metallic edge above common', () => {
    expect(resolveCardTokens('classic', { frame: 'cream' }, 'common').edge).toEqual({
      kind: 'solid',
      color: '#d8cdb4',
    });
    const legendary = resolveCardTokens('classic', { frame: 'cream' }, 'legendary');
    expect(legendary.edge.kind).toBe('gradient');
    expect(paintToCss(legendary.edge)).toContain('linear-gradient(135deg');
    expect(legendary.edgeWidth).toBe(2.2);
    expect(legendary.core).toBe('#f4e7c4');
    expect(legendary.glow).toBe('rgba(184, 144, 58, 0.38)');
  });

  it('lets an explicit border ink outrank the rarity edge', () => {
    const t = resolveCardTokens('classic', { frame: 'cream', border: 'gold' }, 'legendary');
    expect(t.edge).toEqual({ kind: 'solid', color: '#b8903a' });
    expect(t.edgeWidth).toBe(2.2);
  });

  it('treats an auto border as no border choice', () => {
    const t = resolveCardTokens('classic', { frame: 'cream', border: 'auto' }, 'rare');
    expect(t.edge.kind).toBe('gradient');
    expect(t.border).toBe('#7b5fa3');
  });

  it('resolves rarity borders and accents to the rarity colour', () => {
    const t = resolveCardTokens('classic', { border: 'rarity', accent: 'rarity' }, 'epic');
    expect(t.border).toBe('#c66a3c');
    expect(t.accent).toBe('#c66a3c');
    expect(t.edge).toEqual({ kind: 'solid', color: '#c66a3c' });
  });

  it('lets a chosen thickness outrank the rarity thickness', () => {
    expect(resolveCardTokens('classic', {}, 'epic').edgeWidth).toBe(1.4);
    expect(resolveCardTokens('classic', { weight: 'fine' }, 'epic').edgeWidth).toBe(1.2);
    expect(resolveCardTokens('classic', { weight: 'auto' }, 'epic').edgeWidth).toBe(1.4);
  });

  it('keeps the bold template heavy and round by default', () => {
    const t = resolveCardTokens('bold', {}, 'common');
    expect(t.edgeWidth).toBe(3);
    expect(t.corner).toBe(5);
    expect(resolveCardTokens('bold', { corners: 'sharp' }, 'common').corner).toBe(0.4);
  });

  it('reads texture size and blend from the chosen stock texture', () => {
    expect(resolveCardTokens('classic', { texture: 'felt' }, 'common').texture).toEqual({
      image: 'felt',
      size: 150,
      opacity: 0.6,
      blend: 'overlay',
    });
    expect(resolveCardTokens('classic', { texture: 'smooth' }, 'common').texture).toEqual({
      image: 'none',
      size: null,
      opacity: null,
      blend: null,
    });
  });

  it('softens every untextured dark board, including cocoa and aubergine', () => {
    const softened = { image: null, size: null, opacity: 0.2, blend: 'screen' };
    for (const frame of ['ink', 'slate', 'wine', 'cocoa', 'aubergine']) {
      expect(resolveCardTokens('classic', { frame }, 'common').texture, frame).toEqual(softened);
    }
    expect(resolveCardTokens('classic', { frame: 'cream' }, 'common').texture).toBeNull();
  });

  it('falls back to the dossier board only when it is left untextured', () => {
    expect(resolveCardTokens('dossier', {}, 'common').texture).toEqual({
      image: null,
      size: null,
      opacity: 0.16,
      blend: 'screen',
    });
    expect(resolveCardTokens('dossier', { frame: 'ink' }, 'common').texture?.opacity).toBe(0.2);
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

  it('names each fixture once', () => {
    const names = CARD_FIXTURES.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
