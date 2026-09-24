import { describe, expect, it } from 'vitest';
import {
  BINDER_COLOURS,
  cardCode,
  normaliseSetCode,
  PACK_COLOURS,
  resolveBinderColour,
  resolvePackColour,
  setCodeProblems,
} from './setIdentity';

describe('resolvePackColour', () => {
  it('uses mint for empty and unknown values', () => {
    expect(resolvePackColour()).toEqual(PACK_COLOURS.mint);
    expect(resolvePackColour('unknown')).toEqual(PACK_COLOURS.mint);
  });
});

describe('resolveBinderColour', () => {
  it('uses teal for empty and unknown values', () => {
    expect(resolveBinderColour()).toEqual(BINDER_COLOURS.teal);
    expect(resolveBinderColour('unknown')).toEqual(BINDER_COLOURS.teal);
  });
});

describe('cardCode', () => {
  it('numbers the card definition inside its published set', () => {
    expect(cardCode('CAM-01', 11, 36)).toBe('CAM-01 12/36');
  });

  it('prints nothing until a set has a code and a frozen total', () => {
    expect(cardCode('', 0, 20)).toBe('');
    expect(cardCode('CAM-01', 0, 0)).toBe('');
  });
});

describe('normaliseSetCode', () => {
  it('keeps capital letters and digits, up to the base code length', () => {
    expect(normaliseSetCode('geo-1x!')).toBe('GEO');
    expect(normaliseSetCode('r2')).toBe('R2');
  });

  it('reports a code of the wrong length, and accepts an empty one', () => {
    expect(setCodeProblems('GE')).toHaveLength(1);
    expect(setCodeProblems('')).toEqual([]);
    expect(setCodeProblems('GEO')).toEqual([]);
  });
});
