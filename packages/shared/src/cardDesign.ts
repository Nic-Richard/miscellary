import type { TemplateConfig } from './api';
import type { Rarity } from './rarity';

// Draft-only: published renderers must use their stored configuration unchanged.
export function prepareCardDesign(
  key: string,
  config: TemplateConfig,
  rarity: Rarity,
): TemplateConfig {
  const specialty = rarity === 'rare' || rarity === 'epic' || rarity === 'legendary';
  return {
    ...config,
    ...(key === 'minimal' ? { gradient: 'full' } : {}),
    relief: specialty ? 'emboss' : rarity === 'uncommon' ? 'spot' : 'none',
    treatment: rarity === 'legendary' ? (config.finish === 'pearl' ? 'holo' : 'foil') : 'none',
    coverage: key === 'minimal' ? 'art' : 'frame',
  };
}
