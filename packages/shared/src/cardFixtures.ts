import type { TemplateConfig } from './api';
import type { Rarity } from './rarity';

export interface CardFixture {
  name: string;
  templateKey: string;
  rarity: Rarity;
  config: TemplateConfig;
}

export const CARD_FIXTURE_WIDTHS = [100, 150, 300];

export const CARD_FIXTURES: CardFixture[] = [
  {
    name: 'classic-common-light',
    templateKey: 'classic',
    rarity: 'common',
    config: { stock: 'cream', border: 'auto', window: 'rule', shape: 'square', texture: 'linen' },
  },
  {
    name: 'classic-common-dark',
    templateKey: 'classic',
    rarity: 'common',
    config: { stock: 'ink', border: 'auto', window: 'mat', shape: 'arch', texture: 'brushed' },
  },
  {
    name: 'classic-uncommon-rarity-edge',
    templateKey: 'classic',
    rarity: 'uncommon',
    config: { stock: 'sand', border: 'auto', window: 'inset', shape: 'square' },
  },
  {
    name: 'classic-legendary-ink-border',
    templateKey: 'classic',
    rarity: 'legendary',
    config: {
      stock: 'navy',
      border: 'gold',
      border_width: 'medium',
      shape: 'circle',
      finish: 'metallic',
    },
  },
  {
    name: 'classic-epic-untextured-dark',
    templateKey: 'classic',
    rarity: 'epic',
    config: { stock: 'wine', border: 'auto', shape: 'diamond' },
  },
  {
    name: 'polaroid-common',
    templateKey: 'polaroid',
    rarity: 'common',
    config: { stock: 'white', border: 'auto', shape: 'square', texture: 'grain' },
  },
  {
    name: 'polaroid-rare-sharp',
    templateKey: 'polaroid',
    rarity: 'rare',
    config: { stock: 'blush', border: 'rose', corners: 'sharp', shape: 'circle' },
  },
  {
    name: 'minimal-epic-fullart',
    templateKey: 'minimal',
    rarity: 'epic',
    config: { border: 'auto', gradient: 'bottom', corners: 'round', coverage: 'spot' },
  },
  {
    name: 'minimal-legendary-chase',
    templateKey: 'minimal',
    rarity: 'legendary',
    config: { border: 'cream', gradient: 'full', treatment: 'holo', coverage: 'full' },
  },
  {
    name: 'bold-common-rarity-border',
    templateKey: 'bold',
    rarity: 'common',
    config: { stock: 'cream', border: 'rarity', border_width: 'medium', shape: 'square' },
  },
  {
    name: 'bold-legendary-heavy',
    templateKey: 'bold',
    rarity: 'legendary',
    config: { stock: 'butter', border: 'rarity', border_width: 'thick', texture: 'canvas' },
  },
  {
    name: 'fieldnote-common-grain',
    templateKey: 'fieldnote',
    rarity: 'common',
    config: { stock: 'cream', border: 'auto', accent: 'green', texture: 'grain' },
  },
  {
    name: 'fieldnote-uncommon-ochre',
    templateKey: 'fieldnote',
    rarity: 'uncommon',
    config: { stock: 'linen', border: 'ochre', accent: 'rarity' },
  },
  {
    name: 'fieldnote-rare-arch',
    templateKey: 'fieldnote',
    rarity: 'rare',
    config: { stock: 'mint', border: 'auto', accent: 'forest', shape: 'arch' },
  },
  {
    name: 'classic-smooth-no-texture',
    templateKey: 'classic',
    rarity: 'common',
    config: { stock: 'bone', border: 'auto', texture: 'smooth', shape: 'square' },
  },
];
