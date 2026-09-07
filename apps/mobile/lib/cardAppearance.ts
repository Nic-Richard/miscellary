import type { Rarity, TemplateConfig } from '@miscellary/shared';

export const cardFonts: Record<string, string> = {
  display: 'BebasNeue',
  body: 'RobotoCondensed',
  playfair: 'PlayfairDisplay',
  cinzel: 'Cinzel',
  archivo: 'ArchivoBlack',
  spacemono: 'SpaceMono',
  caveat: 'Caveat',
  alfa: 'AlfaSlabOne',
};

export const stocks: Record<string, string> = {
  cream: '#f4ecda',
  bone: '#f7f2e6',
  white: '#fdfbf6',
  sand: '#e8dcc2',
  linen: '#efe7d5',
  ash: '#d9d3c6',
  blush: '#f2e2dd',
  sky: '#e4ecf3',
  mint: '#e3eee6',
  butter: '#f5edd1',
  peach: '#f1d6bf',
  lavender: '#e1ddec',
  sage: '#d4dfc8',
  lilac: '#ead5e5',
  light: '#f7f2e6',
  slate: '#4a565c',
  charcoal: '#3a3733',
  ink: '#22201c',
  dark: '#1f3a36',
  forest: '#22402f',
  oxblood: '#3f2223',
  navy: '#232f4a',
  plum: '#3b2438',
  moss: '#2c3a22',
  teal: '#17434a',
  wine: '#4a2036',
  bronze: '#46341f',
  cocoa: '#49332d',
  aubergine: '#30243f',
};
export const inks: Record<string, string> = {
  ink: '#241f1a',
  charcoal: '#43413c',
  slate: '#5d6b70',
  teal: '#2f8078',
  green: '#4c7a5a',
  forest: '#2b5b3c',
  blue: '#4f6f9e',
  ocean: '#2f6690',
  indigo: '#3a4482',
  purple: '#7b5fa3',
  violet: '#6a4b93',
  plum: '#7c3f63',
  rose: '#b1587a',
  red: '#b04c3c',
  crimson: '#9d2f3f',
  rust: '#a8503a',
  ember: '#c4622c',
  gold: '#b8903a',
  bronze: '#84603a',
  copper: '#b56c49',
  ochre: '#b49736',
  silver: '#aab2b6',
  sage: '#7f9977',
  cream: '#f0e6d2',
  white: '#fbf7ef',
};
const rarityInks: Record<Rarity, string> = {
  common: '#3f8f88',
  uncommon: '#b48a2c',
  rare: '#7b5fa3',
  epic: '#c66a3c',
  legendary: '#c9a24a',
};
const darkStocks = new Set([
  'slate',
  'charcoal',
  'ink',
  'dark',
  'forest',
  'oxblood',
  'navy',
  'plum',
  'moss',
  'teal',
  'wine',
  'bronze',
  'cocoa',
  'aubergine',
]);

export function cardAppearance(key: string, config: TemplateConfig, rarity: Rarity) {
  const defaultStock =
    key === 'polaroid' ? 'white' : key === 'dossier' ? 'ink' : key === 'classic' ? 'dark' : 'cream';
  const stockToken = config.frame ?? defaultStock;
  const dark = key === 'minimal' || darkStocks.has(stockToken);
  const ink = (token: string | undefined, fallback: string) =>
    token === 'rarity' ? rarityInks[rarity] : (inks[token ?? ''] ?? fallback);
  const weights: Record<string, number> = {
    fine: 0.012,
    standard: 0.021,
    bold: 0.03,
    heavy: 0.044,
  };
  return {
    stock: stocks[stockToken] ?? stocks[defaultStock]!,
    dark,
    edge: ink(config.border, key === 'bold' ? rarityInks[rarity] : dark ? '#51645b' : '#cdbfa6'),
    text: dark ? '#fdf9ee' : '#3a2f26',
    muted: dark ? '#d4cebf' : '#6f6355',
    accent: ink(config.accent, key === 'fieldnote' ? inks.green! : inks.gold!),
    border: weights[config.weight ?? ''] ?? (key === 'bold' ? 0.03 : 0.007),
    corner: config.corners === 'sharp' ? 0 : config.corners === 'soft' ? 0.015 : 0.03,
    texture:
      config.texture ??
      (key === 'polaroid' || key === 'fieldnote'
        ? 'grain'
        : key === 'dossier'
          ? 'felt'
          : key === 'bold'
            ? 'canvas'
            : 'linen'),
  };
}
