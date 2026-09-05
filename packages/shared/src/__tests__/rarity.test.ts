import { describe, expect, it } from 'vitest';
import { PULL_ODDS, RARITIES } from '../rarity';

describe('rarity constants', () => {
  it('pull odds sum to 1', () => {
    const total = RARITIES.reduce((sum, r) => sum + PULL_ODDS[r], 0);
    expect(total).toBeCloseTo(1, 10);
  });
});
