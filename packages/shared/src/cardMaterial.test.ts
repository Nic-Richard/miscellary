import { describe, expect, it } from 'vitest';
import { expandRepeating, resolveCardMaterial } from './cardMaterial';

describe('resolveCardMaterial', () => {
  it('defaults to a matte coat', () => {
    const m = resolveCardMaterial('classic', {}, 'common');
    expect(m.grain).toBe(0.4);
    expect(m.sheen).toBe(0.62);
    expect(m.coatBlend).toBe('soft-light');
    expect(m.coat.stops[1]?.color).toBe('rgba(255, 255, 255, 0.05)');
  });

  it('takes grain and sheen from the chosen finish', () => {
    expect(resolveCardMaterial('classic', { finish: 'gloss' }, 'common').sheen).toBe(0.86);
    expect(resolveCardMaterial('classic', { finish: 'metallic' }, 'common').grain).toBe(0.18);
  });

  it('inherits a finish from rarity only when none is chosen', () => {
    expect(resolveCardMaterial('classic', {}, 'rare').sheen).toBe(0.72);
    expect(resolveCardMaterial('classic', {}, 'epic').sheen).toBe(0.82);
    expect(resolveCardMaterial('classic', { finish: 'matte' }, 'epic').sheen).toBe(0.62);
  });

  it('gives dark boards a colder pearl', () => {
    const light = resolveCardMaterial('classic', { finish: 'pearl', frame: 'cream' }, 'common');
    const dark = resolveCardMaterial('classic', { finish: 'pearl', frame: 'ink' }, 'common');
    expect(light.coat.stops[0]?.color).toBe('rgba(198, 178, 255, 0.2)');
    expect(dark.coat.stops[0]?.color).toBe('rgba(206, 226, 255, 0.16)');
    expect(resolveCardMaterial('dossier', { finish: 'pearl' }, 'common').coat).toEqual(dark.coat);
  });

  it('raises epic and legendary edges unless the card names a relief', () => {
    expect(resolveCardMaterial('classic', {}, 'common').relief).toBeNull();
    expect(resolveCardMaterial('classic', {}, 'epic').relief).toHaveLength(2);
    expect(resolveCardMaterial('classic', { relief: 'none' }, 'epic').relief).toBeNull();
    expect(resolveCardMaterial('classic', { relief: 'deboss' }, 'epic').relief?.[0]?.color).toBe(
      'rgba(40, 24, 8, 0.26)',
    );
  });

  it('treats spot relief as a varnish over the art', () => {
    const m = resolveCardMaterial('classic', { relief: 'spot' }, 'common');
    expect(m.varnish).toBe(true);
    expect(m.relief).toBeNull();
  });

  it('supplies chase layers only for foil and holo', () => {
    expect(resolveCardMaterial('classic', { treatment: 'none' }, 'legendary').chase).toBeNull();
    expect(
      resolveCardMaterial('classic', { treatment: 'foil' }, 'legendary').chase?.band.blend,
    ).toBe('hard-light');
    expect(
      resolveCardMaterial('classic', { treatment: 'holo' }, 'legendary').chase?.field.opacity,
    ).toBe(0.34);
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
