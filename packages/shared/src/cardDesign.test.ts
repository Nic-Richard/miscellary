import { describe, expect, it } from 'vitest';
import { prepareCardDesign } from './cardDesign';

describe('automatic draft production settings', () => {
  it('preserves creative options and does not mutate its input', () => {
    const config = {
      stock: 'peach',
      border: 'copper',
      border_width: 'medium',
      treatment: 'holo',
      coverage: 'full',
    };
    const prepared = prepareCardDesign('fieldnote', config);
    expect(prepared).toMatchObject({
      stock: 'peach',
      border: 'copper',
      border_width: 'medium',
      treatment: 'holo',
      coverage: 'full',
    });
    expect(prepared).not.toHaveProperty('relief');
    expect(config.treatment).toBe('holo');
  });
  it('forces nothing on any tier, including the Full Art scrim', () => {
    expect(prepareCardDesign('minimal', { finish: 'pearl' })).toMatchObject({
      treatment: 'none',
      coverage: 'spot',
    });
    expect(prepareCardDesign('minimal', { finish: 'pearl' })).not.toHaveProperty('gradient');
    expect(prepareCardDesign('minimal', { gradient: 'top' })).toMatchObject({ gradient: 'top' });
    expect(prepareCardDesign('classic', { finish: 'matte' })).toMatchObject({
      treatment: 'none',
      coverage: 'spot',
    });
    expect(prepareCardDesign('classic', { treatment: 'holo', coverage: 'reverse' })).toMatchObject({
      treatment: 'holo',
      coverage: 'reverse',
    });
  });
});
