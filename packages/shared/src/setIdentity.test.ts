import { describe, expect, it } from 'vitest';
import {
  BINDER_COLOURS,
  PACK_COLOURS,
  resolveBinderColour,
  resolvePackColour,
} from './setIdentity';

describe('resolvePackColour', () => {
  it('uses mint for empty and unknown values', () => {
    expect(resolvePackColour()).toEqual(PACK_COLOURS.mint);
    expect(resolvePackColour('unknown')).toEqual(PACK_COLOURS.mint);
  });

  it('preserves the full colour adjustment', () => {
    expect(resolvePackColour('cream')).toEqual({
      hue: -92,
      saturation: 0.3,
      brightness: 1.4,
    });
    expect(resolvePackColour('black')).toEqual({
      hue: 0,
      saturation: 0.03,
      brightness: 0.24,
    });
  });
});

describe('resolveBinderColour', () => {
  it('uses teal for empty and unknown values', () => {
    expect(resolveBinderColour()).toEqual(BINDER_COLOURS.teal);
    expect(resolveBinderColour('unknown')).toEqual(BINDER_COLOURS.teal);
  });

  it('preserves the full cloth adjustment', () => {
    expect(resolveBinderColour('oxblood')).toEqual({
      hue: 160,
      saturation: 2.2,
      brightness: 0.62,
    });
  });
});
