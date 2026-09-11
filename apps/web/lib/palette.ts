import type { CSSProperties } from 'react';

/* One palette, one value per colour, wherever a colour is picked: the board,
   the border ink, the accent and the set mark all draw from this. A colour is
   itself whatever it is printed as, so the picker shows the same swatch in
   every control.

   Eight rows of nine. A row is a hue, running light to dark. */
export const COLOUR_ROWS: string[][] = [
  ['white', 'haze', 'ash', 'silver', 'graphite', 'slate', 'steel', 'charcoal', 'ink'],
  ['bone', 'cream', 'butter', 'linen', 'sand', 'straw', 'ochre', 'gold', 'bronze'],
  ['shell', 'peach', 'apricot', 'melon', 'copper', 'ember', 'umber', 'rust', 'cocoa'],
  ['blush', 'salmon', 'coral', 'red', 'brick', 'crimson', 'garnet', 'wine', 'oxblood'],
  ['petal', 'powder', 'peony', 'blossom', 'magenta', 'rose', 'fuchsia', 'mulberry', 'plum'],
  [
    'lavender',
    'thistle',
    'lilac',
    'wisteria',
    'amethyst',
    'purple',
    'damson',
    'violet',
    'aubergine',
  ],
  ['sky', 'sea', 'cornflower', 'blue', 'azure', 'ocean', 'indigo', 'navy', 'teal'],
  ['mint', 'sage', 'fern', 'jade', 'olive', 'green', 'forest', 'moss', 'pine'],
];

export const CARD_COLOURS: string[] = COLOUR_ROWS.flat();

export const COLOURS: Record<string, string> = {
  rarity: '#8d8477',
  white: '#fdfbf6',
  haze: '#dfe0e2',
  ash: '#d9d3c6',
  silver: '#8f9a9f',
  graphite: '#5b6165',
  slate: '#4a565c',
  steel: '#3c4750',
  charcoal: '#3a3733',
  ink: '#22201c',
  bone: '#f7f2e6',
  cream: '#f4ecda',
  butter: '#f5edd1',
  linen: '#efe7d5',
  sand: '#e8dcc2',
  straw: '#ece0bc',
  ochre: '#9b822e',
  gold: '#7c5f1e',
  bronze: '#46341f',
  shell: '#f7e6d6',
  peach: '#f1d6bf',
  apricot: '#e8b98c',
  melon: '#d99a68',
  copper: '#9c5d3f',
  ember: '#a95426',
  umber: '#6b4326',
  rust: '#5a2f1e',
  cocoa: '#49332d',
  blush: '#f2e2dd',
  salmon: '#e8a396',
  coral: '#d97a68',
  red: '#974134',
  brick: '#8f4436',
  crimson: '#872836',
  garnet: '#5e1f28',
  wine: '#4a2036',
  oxblood: '#3f2223',
  petal: '#f3dde8',
  powder: '#f0cfe0',
  peony: '#e0a3c0',
  blossom: '#cf7fa4',
  magenta: '#a83d70',
  rose: '#9b4968',
  fuchsia: '#7a3358',
  mulberry: '#5c2742',
  plum: '#3b2438',
  lavender: '#e1ddec',
  thistle: '#ded4ee',
  lilac: '#ead5e5',
  wisteria: '#b3a3d6',
  amethyst: '#9179c4',
  purple: '#6a518d',
  damson: '#4a3468',
  violet: '#4a3068',
  aubergine: '#30243f',
  sky: '#e4ecf3',
  sea: '#d8e8e8',
  cornflower: '#8fa9cf',
  blue: '#445f88',
  azure: '#2f4f7a',
  ocean: '#28587c',
  indigo: '#2b2f5c',
  navy: '#232f4a',
  teal: '#17434a',
  mint: '#e3eee6',
  sage: '#d4dfc8',
  fern: '#9dbf9a',
  jade: '#6fa383',
  olive: '#7d8c4e',
  green: '#41694d',
  forest: '#22402f',
  moss: '#2c3a22',
  pine: '#1c3327',
};

/** The offered colours as picker rows, specials removed. Anything the palette
 *  does not name, such as a pack foil tint, lands in a row of its own. */
export function colourRows(values: string[]): string[][] {
  const offered = values.filter((v) => v !== 'auto' && v !== 'rarity');
  const known = new Set(CARD_COLOURS);
  const rows = COLOUR_ROWS.map((row) => row.filter((token) => offered.includes(token))).filter(
    (row) => row.length > 0,
  );
  const rest = offered.filter((token) => !known.has(token));
  return rest.length ? [...rows, rest] : rows;
}

export function swatchColour(token: string): string {
  return COLOURS[token] ?? '#b9b0a0';
}

const BOARD = '#cabb9f';

const TEXTURE_FILES: Record<string, string> = {
  linen: 'tex-linen.png',
  canvas: 'tex-canvas.png',
  grain: 'tex-grain.png',
  felt: 'tex-felt.png',
  brushed: 'tex-brushed.png',
};

export function textureTile(token: string): CSSProperties {
  const file = TEXTURE_FILES[token];
  if (!file) return { background: BOARD };
  return {
    backgroundColor: BOARD,
    backgroundImage: `url('/materials/${file}')`,
    backgroundSize: '40px',
    backgroundBlendMode: 'overlay',
  };
}

const COATS: Record<string, string> = {
  matte:
    'linear-gradient(104deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 70%)',
  satin:
    'linear-gradient(104deg, rgba(255,255,255,0) 12%, rgba(255,255,255,0.34) 48%, rgba(255,255,255,0) 84%)',
  gloss:
    'linear-gradient(104deg, rgba(255,255,255,0) 22%, rgba(255,255,255,0.16) 38%, rgba(255,255,255,0.85) 48%, rgba(255,255,255,0.12) 58%, rgba(255,255,255,0) 76%)',
  pearl:
    'linear-gradient(104deg, rgba(198,178,255,0.6) 4%, rgba(255,255,255,0.7) 26%, rgba(170,214,255,0.6) 48%, rgba(255,255,255,0.6) 68%, rgba(212,176,255,0.62) 94%)',
  metallic:
    'linear-gradient(104deg, #8d7554 2%, #f4e2c4 18%, #9a8161 34%, #fff3dd 52%, #9a8161 68%, #f0dcbc 84%, #8d7554 98%)',
};

export function coatTile(token: string): CSSProperties {
  return { backgroundColor: '#efe7d6', backgroundImage: COATS[token] ?? 'none' };
}

export function shapeTile(token: string): CSSProperties {
  const clips: Record<string, string> = {
    circle: 'circle(42%)',
    diamond: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
  };
  return {
    background: '#7b9183',
    width: 36,
    height: 36,
    margin: '0 auto',
    borderRadius: token === 'arch' ? '50% 50% 2px 2px' : 2,
    clipPath: clips[token],
  };
}

export function borderTile(token: string): CSSProperties {
  const widths: Record<string, number> = {
    auto: 1,
    hairline: 1.2,
    thin: 2.1,
    medium: 3,
    thick: 4.4,
  };
  return {
    background: '#f4ecda',
    border: `${widths[token] ?? 1}px ${token === 'auto' ? 'dashed' : 'solid'} #84603a`,
  };
}
