import { readFileSync } from 'node:fs';
import { resolveCardMaterial, resolveCardSpot } from '@miscellary/shared';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../components/CardPreview.module.css', import.meta.url), 'utf8');

function declaration(selector: string, property: string): string {
  const block = css.match(
    new RegExp(`${selector.replace(/[.[\]()*$^|?+\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\n\\}`),
  );
  const match = block?.[1]?.match(new RegExp(`${property}:([\\s\\S]*?);`));
  return (match?.[1] ?? '').replace(/\s+/g, ' ').trim();
}

describe('card material matches the stylesheet', () => {
  it('keeps grain and sheen aligned for every finish', () => {
    for (const [finish, expected] of Object.entries({
      matte: { grain: 0.56, sheen: 0.5, blend: 'soft-light' },
      satin: { grain: 0.34, sheen: 0.72, blend: 'soft-light' },
      gloss: { grain: 0.14, sheen: 0.92, blend: 'overlay' },
      pearl: { grain: 0.2, sheen: 0.84, blend: 'soft-light' },
      metallic: { grain: 0.1, sheen: 0.96, blend: 'overlay' },
    })) {
      const selector = `.card[data-finish='${finish}']`;
      expect(Number(declaration(selector, '--grain')), finish).toBe(expected.grain);
      expect(Number(declaration(selector, '--sheen')), finish).toBe(expected.sheen);
      expect(declaration(selector, '--finish-blend'), finish).toBe(expected.blend);
      const material = resolveCardMaterial('classic', { finish }, 'common');
      expect(material.grain, finish).toBe(expected.grain);
      expect(material.sheen, finish).toBe(expected.sheen);
      expect(material.coatBlend, finish).toBe(expected.blend);
    }
  });

  it('keeps every coat gradient aligned', () => {
    for (const [finish, coat] of Object.entries({
      matte: 'matte',
      satin: 'satin',
      gloss: 'gloss',
      pearl: 'pearl',
      metallic: 'metal',
    })) {
      const declared = declaration('.card', `--coat-${coat}`);
      const material = resolveCardMaterial('classic', { finish, frame: 'cream' }, 'common');
      for (const stop of material.coat.stops) {
        expect(declared, `${finish}/${stop.color}`).toContain(stop.color);
      }
      expect(declared, finish).toContain(`${material.coat.angle}deg`);
    }
  });

  it('gives every struck tier a spot treatment the mask can follow', () => {
    expect(resolveCardSpot({}, 'common')).toBeNull();
    expect(resolveCardSpot({}, 'uncommon')).toEqual({
      material: 'varnish',
      area: 'spot',
      pattern: 'linear',
    });
    expect(resolveCardSpot({ finish: 'pearl' }, 'rare')).toEqual({
      material: 'pearl',
      area: 'spot',
      pattern: 'linear',
    });
    expect(resolveCardSpot({ finish: 'metallic' }, 'epic')).toEqual({
      material: 'foil',
      area: 'spot',
      pattern: 'linear',
    });
    expect(
      resolveCardSpot({ treatment: 'holo', coverage: 'full', pattern: 'cosmos' }, 'legendary'),
    ).toEqual({ material: 'holo', area: 'full', pattern: 'cosmos' });
    expect(resolveCardSpot({ treatment: 'holo', coverage: 'reverse' }, 'legendary')?.area).toBe(
      'reverse',
    );
    expect(resolveCardSpot({ treatment: 'foil', coverage: 'reverse' }, 'rare')).toEqual({
      material: 'foil',
      area: 'reverse',
      pattern: 'linear',
    });
  });

  it('keeps the struck rim aligned with the tier that gets it', () => {
    const declared = declaration(`.card[data-rarity='legendary']`, '--relief');
    for (const shadow of resolveCardMaterial('classic', {}, 'rare').relief ?? []) {
      expect(declared, shadow.color).toContain(shadow.color);
    }
  });
});
