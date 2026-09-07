import { resolveCardTokens } from '@miscellary/shared';
import { describe, expect, it } from 'vitest';
import { INK_COLOURS, STOCK_COLOURS } from './palette';

describe('card palette and renderer contract', () => {
  it('renders every stock with the color shown in its swatch', () => {
    for (const [token, colour] of Object.entries(STOCK_COLOURS)) {
      const tokens = resolveCardTokens('classic', { frame: token }, 'common');
      expect(tokens.stock, token).toBe(colour);
    }
  });

  it('renders every fixed ink color for both accents and borders', () => {
    for (const [token, colour] of Object.entries(INK_COLOURS)) {
      if (token === 'rarity') continue;
      expect(
        resolveCardTokens('classic', { accent: token }, 'common').accent,
        `accent/${token}`,
      ).toBe(colour);
      expect(
        resolveCardTokens('classic', { border: token }, 'common').border,
        `border/${token}`,
      ).toBe(colour);
    }
  });
});
