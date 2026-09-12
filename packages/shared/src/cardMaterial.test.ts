import { describe, expect, it } from 'vitest';
import { expandRepeating, resolveCardMaterial, resolveCardSpot } from './cardMaterial';

describe('resolveCardMaterial', () => {
  it('defaults to a matte coat', () => {
    const m = resolveCardMaterial('classic', {}, 'common');
    expect(m.grain).toBe(0.56);
    expect(m.sheen).toBe(0.5);
    expect(m.coatBlend).toBe('soft-light');
    expect(m.coat.stops[1]?.color).toBe('rgba(255, 252, 244, 0.07)');
  });

  it('takes grain and sheen from the chosen finish', () => {
    expect(resolveCardMaterial('classic', { finish: 'gloss' }, 'common').sheen).toBe(0.92);
    expect(resolveCardMaterial('classic', { finish: 'metallic' }, 'common').grain).toBe(0.1);
  });

  it('takes the coat from the card and never from its tier', () => {
    expect(resolveCardMaterial('classic', {}, 'rare').sheen).toBe(0.5);
    expect(resolveCardMaterial('classic', {}, 'epic').sheen).toBe(0.5);
    expect(resolveCardMaterial('classic', { finish: 'matte' }, 'epic').sheen).toBe(0.5);
    expect(resolveCardMaterial('classic', { finish: 'pearl' }, 'common').sheen).toBe(0.84);
  });

  it('gives dark boards a colder pearl', () => {
    const light = resolveCardMaterial('classic', { finish: 'pearl', stock: 'cream' }, 'common');
    const dark = resolveCardMaterial('classic', { finish: 'pearl', stock: 'ink' }, 'common');
    expect(light.coat.stops[1]?.color).toBe('rgba(196, 172, 255, 0.34)');
    expect(dark.coat.stops[1]?.color).toBe('rgba(206, 226, 255, 0.3)');
  });

  it('strikes the rim from rare up, and ignores any stored relief', () => {
    expect(resolveCardMaterial('classic', {}, 'common').relief).toBeNull();
    expect(resolveCardMaterial('classic', {}, 'uncommon').relief).toBeNull();
    expect(resolveCardMaterial('classic', {}, 'rare').relief).toHaveLength(2);
    expect(resolveCardMaterial('classic', {}, 'legendary').relief?.[0]?.color).toBe(
      'rgba(255, 248, 226, 0.24)',
    );
    expect(resolveCardMaterial('classic', { relief: 'deboss' }, 'common').relief).toBeNull();
  });

  it('gives no spot work to a card that was never given a foil', () => {
    for (const rarity of ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const) {
      expect(resolveCardSpot({}, rarity), rarity).toBeNull();
      expect(resolveCardSpot({ treatment: 'none' }, rarity), rarity).toBeNull();
    }
  });

  it('takes the spot material from the chosen foil, not from the coat', () => {
    expect(resolveCardSpot({ finish: 'pearl' }, 'rare')).toBeNull();
    expect(resolveCardSpot({ finish: 'metallic' }, 'epic')).toBeNull();
    expect(resolveCardSpot({ treatment: 'foil', finish: 'pearl' }, 'epic')?.material).toBe('foil');
    expect(resolveCardSpot({ treatment: 'holo' }, 'legendary')?.material).toBe('holo');
  });

  it('only reads a pattern off a card that carries a foil', () => {
    expect(resolveCardSpot({ pattern: 'cosmos' }, 'legendary')).toBeNull();
    expect(resolveCardSpot({ treatment: 'foil', pattern: 'cosmos' }, 'epic')?.pattern).toBe(
      'cosmos',
    );
    expect(resolveCardSpot({ treatment: 'foil', pattern: 'moire' }, 'epic')?.pattern).toBe(
      'linear',
    );
  });

  it('spots a region unless the foil covers the whole face', () => {
    expect(resolveCardSpot({ treatment: 'foil', coverage: 'reverse' }, 'legendary')?.area).toBe(
      'reverse',
    );
    expect(resolveCardSpot({ treatment: 'foil', coverage: 'border' }, 'legendary')?.area).toBe(
      'spot',
    );
    expect(resolveCardSpot({ treatment: 'foil', coverage: 'frame' }, 'legendary')?.area).toBe(
      'spot',
    );
    expect(resolveCardSpot({ treatment: 'holo', coverage: 'art' }, 'legendary')?.area).toBe('spot');
    expect(resolveCardSpot({ treatment: 'foil', coverage: 'full' }, 'legendary')?.area).toBe(
      'full',
    );
  });

  it('carries the layers the chosen spot material prints with', () => {
    expect(resolveCardMaterial('classic', {}, 'common').spot).toBeNull();
    expect(resolveCardMaterial('classic', {}, 'uncommon').spot).toBeNull();
    expect(
      resolveCardMaterial('classic', { treatment: 'foil' }, 'legendary').spot?.layers.band.blend,
    ).toBe('hard-light');
    expect(
      resolveCardMaterial('classic', { treatment: 'holo' }, 'legendary').spot?.layers.field.opacity,
    ).toBe(0.34);
  });

  it('lets a hard coat reach white and keeps a soft one inside the stock', () => {
    expect(resolveCardMaterial('classic', { finish: 'gloss' }, 'common').coatBlend).toBe('overlay');
    expect(resolveCardMaterial('classic', { finish: 'matte' }, 'common').coatBlend).toBe(
      'soft-light',
    );
  });
});

describe('expandRepeating', () => {
  it('repeats stripes across the card and keeps offsets rising', () => {
    const stripes = {
      angle: 100,
      period: 10,
      stops: [
        { color: 'a', at: 0 },
        { color: 'b', at: 10 },
      ],
    };
    const g = expandRepeating(stripes, 100);
    expect(g.angle).toBe(100);
    expect(g.stops.length).toBeGreaterThan(2);
    const offsets = g.stops.map((s) => s.at ?? 0);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(offsets[0]).toBe(0);
    expect(offsets[offsets.length - 1]).toBeCloseTo(100, 5);
  });

  it('leaves a zero period alone', () => {
    const stripes = { angle: 0, period: 0, stops: [{ color: 'a' }] };
    expect(expandRepeating(stripes, 100).stops).toHaveLength(1);
  });
});
