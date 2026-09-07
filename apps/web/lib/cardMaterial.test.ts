import { readFileSync } from 'node:fs';
import { resolveCardMaterial } from '@miscellary/shared';
import { describe, expect, it } from 'vitest';

// Guard the CSS material values until the web renderer uses the shared resolver.

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
      matte: { grain: 0.4, sheen: 0.62 },
      satin: { grain: 0.3, sheen: 0.74 },
      gloss: { grain: 0.22, sheen: 0.86 },
      pearl: { grain: 0.24, sheen: 0.9 },
      metallic: { grain: 0.18, sheen: 1 },
    })) {
      const selector = `.card[data-finish='${finish}']`;
      expect(Number(declaration(selector, '--grain')), finish).toBe(expected.grain);
      expect(Number(declaration(selector, '--sheen')), finish).toBe(expected.sheen);
      const material = resolveCardMaterial('classic', { finish }, 'common');
      expect(material.grain, finish).toBe(expected.grain);
      expect(material.sheen, finish).toBe(expected.sheen);
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

  it('keeps the relief pair aligned', () => {
    for (const relief of ['emboss', 'deboss']) {
      const declared = declaration(`.card[data-relief='${relief}']`, '--relief');
      const material = resolveCardMaterial('classic', { relief }, 'common');
      for (const shadow of material.relief ?? []) {
        expect(declared, `${relief}/${shadow.color}`).toContain(shadow.color);
      }
    }
  });
});
