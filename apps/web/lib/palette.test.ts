import { resolveCardTokens } from '@miscellary/shared';
import { describe, expect, it } from 'vitest';
import { CARD_COLOURS, COLOURS } from './palette';

describe('card palette and renderer contract', () => {
  it('renders every colour the same whether it is the board or the ink', () => {
    for (const token of CARD_COLOURS) {
      const colour = COLOURS[token];
      expect(resolveCardTokens('classic', { stock: token }, 'common').stock, token).toBe(colour);
      expect(resolveCardTokens('classic', { accent: token }, 'common').accent, token).toBe(colour);
      expect(resolveCardTokens('classic', { border: token }, 'common').border, token).toBe(colour);
    }
  });

  it('lays the picker out as whole rows of the same length', () => {
    expect(CARD_COLOURS.length).toBe(72);
    expect(new Set(CARD_COLOURS).size).toBe(CARD_COLOURS.length);
  });
});
