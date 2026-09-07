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
    config: { frame: 'cream', border: 'auto', window: 'line', shape: 'square', texture: 'linen' },
  },
  {
    name: 'classic-common-dark',
    templateKey: 'classic',
    rarity: 'common',
    config: { frame: 'ink', border: 'auto', window: 'mat', shape: 'arch', texture: 'brushed' },
  },
  {
    name: 'classic-uncommon-rarity-edge',
    templateKey: 'classic',
    rarity: 'uncommon',
    config: { frame: 'sand', border: 'auto', window: 'inset', shape: 'square' },
  },
  {
    name: 'classic-legendary-ink-border',
    templateKey: 'classic',
    rarity: 'legendary',
    config: { frame: 'navy', border: 'gold', weight: 'bold', shape: 'hex', finish: 'metallic' },
  },
  {
    name: 'classic-epic-untextured-dark',
    templateKey: 'classic',
    rarity: 'epic',
    config: { frame: 'wine', border: 'auto', shape: 'diamond' },
  },
  {
    name: 'polaroid-common',
    templateKey: 'polaroid',
    rarity: 'common',
    config: { frame: 'white', border: 'auto', shape: 'square', texture: 'grain' },
  },
  {
    name: 'polaroid-rare-sharp',
    templateKey: 'polaroid',
    rarity: 'rare',
    config: { frame: 'blush', border: 'rose', corners: 'sharp', shape: 'circle' },
  },
  {
    name: 'minimal-epic-fullart',
    templateKey: 'minimal',
    rarity: 'epic',
    config: { border: 'auto', gradient: 'bottom', corners: 'round', coverage: 'art' },
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
    config: { frame: 'cream', border: 'rarity', weight: 'bold', shape: 'square' },
  },
  {
    name: 'bold-legendary-heavy',
    templateKey: 'bold',
    rarity: 'legendary',
    config: { frame: 'butter', border: 'rarity', weight: 'heavy', texture: 'canvas' },
  },
  {
    name: 'fieldnote-common-ruled',
    templateKey: 'fieldnote',
    rarity: 'common',
    config: { frame: 'cream', border: 'auto', paper: 'ruled', accent: 'green', texture: 'grain' },
  },
  {
    name: 'fieldnote-uncommon-label',
    templateKey: 'fieldnote',
    rarity: 'uncommon',
    config: { frame: 'linen', border: 'ochre', paper: 'label', accent: 'rarity' },
  },
  {
    name: 'fieldnote-rare-tinted',
    templateKey: 'fieldnote',
    rarity: 'rare',
    config: { frame: 'mint', border: 'auto', paper: 'tinted', accent: 'forest', shape: 'arch' },
  },
  {
    name: 'dossier-common-felt',
    templateKey: 'dossier',
    rarity: 'common',
    config: { frame: 'ink', border: 'auto', paper: 'plain', accent: 'gold', texture: 'felt' },
  },
  {
    name: 'dossier-epic-inset',
    templateKey: 'dossier',
    rarity: 'epic',
    config: {
      frame: 'oxblood',
      border: 'copper',
      paper: 'inset',
      accent: 'ember',
      relief: 'emboss',
    },
  },
  {
    name: 'dossier-legendary-transparent',
    templateKey: 'dossier',
    rarity: 'legendary',
    config: { frame: 'aubergine', border: 'auto', paper: 'transparent', treatment: 'foil' },
  },
  {
    name: 'classic-smooth-no-texture',
    templateKey: 'classic',
    rarity: 'common',
    config: { frame: 'bone', border: 'auto', texture: 'smooth', shape: 'square' },
  },
];
