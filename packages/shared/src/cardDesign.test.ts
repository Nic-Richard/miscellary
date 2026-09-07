import { describe, expect, it } from 'vitest';
import { prepareCardDesign } from './cardDesign';

describe('automatic draft production settings', () => {
  it('preserves creative options and does not mutate its input', () => {
    const config = {
      frame: 'peach',
      border: 'copper',
      weight: 'bold',
      paper: 'label',
      treatment: 'holo',
    };
    expect(prepareCardDesign('fieldnote', config, 'common')).toMatchObject({
      frame: 'peach',
      border: 'copper',
      weight: 'bold',
      paper: 'label',
      relief: 'none',
      treatment: 'none',
    });
    expect(config.treatment).toBe('holo');
  });
  it('matches a legendary treatment and Full Art contrast to the draft', () => {
    expect(prepareCardDesign('minimal', { finish: 'pearl' }, 'legendary')).toMatchObject({
      treatment: 'holo',
      coverage: 'art',
      gradient: 'full',
    });
    expect(prepareCardDesign('classic', { finish: 'matte' }, 'legendary')).toMatchObject({
      treatment: 'foil',
      coverage: 'frame',
    });
  });
});
