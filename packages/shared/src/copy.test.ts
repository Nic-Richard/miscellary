import { describe, expect, it } from 'vitest';
import type { OwnedCard } from './api';
import { countOf, offerSides } from './copy';

describe('countOf', () => {
  it('uses the singular only for one', () => {
    expect(countOf(1, 'card')).toBe('1 card');
    expect(countOf(0, 'card')).toBe('0 cards');
    expect(countOf(2, 'copy', 'copies')).toBe('2 copies');
  });
});

describe('offerSides', () => {
  const give = [{ id: 'g' }] as OwnedCard[];
  const want = [{ id: 'w' }] as OwnedCard[];

  it('reads an offer from the viewer', () => {
    expect(offerSides({ give, want }, true)).toEqual({ youGet: give, youGive: want });
    expect(offerSides({ give, want }, false)).toEqual({ youGet: want, youGive: give });
  });
});
