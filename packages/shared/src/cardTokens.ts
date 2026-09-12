import type { TemplateConfig } from './api';
import { currentConfig } from './cardConfig';
import type { Rarity } from './rarity';

export interface GradientPaint {
  kind: 'gradient';
  angle: number;
  stops: Array<{ color: string; at?: number }>;
}
export type Paint = { kind: 'solid'; color: string } | GradientPaint;

export interface CardTokens {
  stock: string;
  edge: Paint;
  edgeWidth: number;
  corner: number;
  ink: string;
  inkMuted: string;
  artBg: string;
  accent: string;
  titleInk: string | null;
  bodyInk: string | null;
  border: string;
  rarity: string;
  core: string;
  glow: string | null;
  texture: TextureTokens | null;
}

export interface TextureTokens {
  /** A stock texture name, 'none' for a smooth board, or null to leave it unset. */
  image: string | null;
  size: number | null;
  opacity: number | null;
  blend: string | null;
}

/* Every colour in the palette as a board and its cut edge, in picker order.
   Mirrors COLOURS in apps/web/lib/palette.ts. */
const STOCKS: Record<string, { stock: string; edge: string }> = {
  white: { stock: '#fdfbf6', edge: '#ded6c6' },
  haze: { stock: '#dfe0e2', edge: '#bcbec2' },
  ash: { stock: '#d9d3c6', edge: '#b8b0a0' },
  silver: { stock: '#8f9a9f', edge: '#6d797f' },
  graphite: { stock: '#5b6165', edge: '#3d4245' },
  slate: { stock: '#4a565c', edge: '#333d42' },
  steel: { stock: '#3c4750', edge: '#28313a' },
  charcoal: { stock: '#3a3733', edge: '#272522' },
  ink: { stock: '#22201c', edge: '#14120f' },
  bone: { stock: '#f7f2e6', edge: '#ddd3bf' },
  cream: { stock: '#f4ecda', edge: '#d8cdb4' },
  butter: { stock: '#f5edd1', edge: '#dacfa6' },
  linen: { stock: '#efe7d5', edge: '#d3c8ac' },
  sand: { stock: '#e8dcc2', edge: '#c8b898' },
  straw: { stock: '#ece0bc', edge: '#cbbc93' },
  ochre: { stock: '#9b822e', edge: '#796524' },
  gold: { stock: '#7c5f1e', edge: '#584214' },
  bronze: { stock: '#46341f', edge: '#302213' },
  shell: { stock: '#f7e6d6', edge: '#e6b281' },
  peach: { stock: '#f1d6bf', edge: '#d0af93' },
  apricot: { stock: '#e8b98c', edge: '#da8f48' },
  melon: { stock: '#d99a68', edge: '#c87532' },
  copper: { stock: '#9c5d3f', edge: '#7a4931' },
  ember: { stock: '#a95426', edge: '#84421e' },
  umber: { stock: '#6b4326', edge: '#53341e' },
  rust: { stock: '#5a2f1e', edge: '#3e1e12' },
  cocoa: { stock: '#49332d', edge: '#302019' },
  blush: { stock: '#f2e2dd', edge: '#d5bdb6' },
  salmon: { stock: '#e8a396', edge: '#d96751' },
  coral: { stock: '#d97a68', edge: '#c84a32' },
  red: { stock: '#974134', edge: '#763329' },
  brick: { stock: '#8f4436', edge: '#70352a' },
  crimson: { stock: '#872836', edge: '#691f2a' },
  garnet: { stock: '#5e1f28', edge: '#49181f' },
  wine: { stock: '#4a2036', edge: '#331523' },
  oxblood: { stock: '#3f2223', edge: '#2b1516' },
  petal: { stock: '#f3dde8', edge: '#d3b6c5' },
  powder: { stock: '#f0cfe0', edge: '#d984b0' },
  peony: { stock: '#e0a3c0', edge: '#cb6394' },
  blossom: { stock: '#cf7fa4', edge: '#bb4a7e' },
  magenta: { stock: '#a83d70', edge: '#833057' },
  rose: { stock: '#9b4968', edge: '#793951' },
  fuchsia: { stock: '#7a3358', edge: '#55203c' },
  mulberry: { stock: '#5c2742', edge: '#481e33' },
  plum: { stock: '#3b2438', edge: '#281727' },
  lavender: { stock: '#e1ddec', edge: '#bbb3d0' },
  thistle: { stock: '#ded4ee', edge: '#a88dd2' },
  lilac: { stock: '#ead5e5', edge: '#c7abc0' },
  wisteria: { stock: '#b3a3d6', edge: '#846abc' },
  amethyst: { stock: '#9179c4', edge: '#6a4cac' },
  purple: { stock: '#6a518d', edge: '#533f6e' },
  damson: { stock: '#4a3468', edge: '#3a2951' },
  violet: { stock: '#4a3068', edge: '#321f49' },
  aubergine: { stock: '#30243f', edge: '#20162d' },
  sky: { stock: '#e4ecf3', edge: '#c1cedb' },
  sea: { stock: '#d8e8e8', edge: '#b2caca' },
  cornflower: { stock: '#8fa9cf', edge: '#5980b8' },
  blue: { stock: '#445f88', edge: '#354a6a' },
  azure: { stock: '#2f4f7a', edge: '#1e3654' },
  ocean: { stock: '#28587c', edge: '#1f4561' },
  indigo: { stock: '#2b2f5c', edge: '#1b1e40' },
  navy: { stock: '#232f4a', edge: '#172038' },
  teal: { stock: '#17434a', edge: '#0e2f34' },
  mint: { stock: '#e3eee6', edge: '#bed3c5' },
  sage: { stock: '#d4dfc8', edge: '#afbf9f' },
  fern: { stock: '#9dbf9a', edge: '#70a26c' },
  jade: { stock: '#6fa383', edge: '#538265' },
  olive: { stock: '#7d8c4e', edge: '#626d3d' },
  green: { stock: '#41694d', edge: '#33523c' },
  forest: { stock: '#22402f', edge: '#16301f' },
  moss: { stock: '#2c3a22', edge: '#1d2915' },
  pine: { stock: '#1c3327', edge: '#12241a' },
};

/* The same palette as ink. A colour is itself whichever way it is printed, so
   this is the board table's colour without its edge. */
const INKS: Record<string, string> = {
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

const RARITY_COLOURS: Record<Rarity, string> = {
  common: '#7a8085',
  uncommon: '#3f6ea8',
  rare: '#7b5fa3',
  epic: '#c0568c',
  legendary: '#c9a24a',
};

const RARITY_EDGES: Partial<Record<Rarity, GradientPaint>> = {
  common: {
    kind: 'gradient',
    angle: 160,
    stops: [
      { color: '#b6bbbe' },
      { color: '#7a8085', at: 46 },
      { color: '#c3c7ca', at: 72 },
      { color: '#63686c' },
    ],
  },
  uncommon: {
    kind: 'gradient',
    angle: 160,
    stops: [
      { color: '#8ea9cd' },
      { color: '#3f6ea8', at: 46 },
      { color: '#a3bcda', at: 72 },
      { color: '#2f5580' },
    ],
  },
  rare: {
    kind: 'gradient',
    angle: 160,
    stops: [
      { color: '#b7a4d6' },
      { color: '#7b5fa3', at: 45 },
      { color: '#c6b6e0', at: 70 },
      { color: '#5f4488' },
    ],
  },
  epic: {
    kind: 'gradient',
    angle: 160,
    stops: [
      { color: '#eaa7c6' },
      { color: '#c0568c', at: 40 },
      { color: '#f2c2d9', at: 65 },
      { color: '#993f6c' },
    ],
  },
  legendary: {
    kind: 'gradient',
    angle: 135,
    stops: [
      { color: '#f7ecc2', at: 0 },
      { color: '#b8903a', at: 22 },
      { color: '#fff4cf', at: 42 },
      { color: '#a67c2c', at: 60 },
      { color: '#f2dfa2', at: 78 },
      { color: '#b8903a', at: 100 },
    ],
  },
};

const RARITY_GLOWS: Partial<Record<Rarity, string>> = {
  epic: 'rgba(192, 86, 140, 0.3)',
  legendary: 'rgba(184, 144, 58, 0.38)',
};

const WEIGHTS: Record<string, number> = { hairline: 1.2, thin: 2.1, medium: 3, thick: 4.4 };
const CORNERS: Record<string, number> = { soft: 1.6, sharp: 0.4 };

const TEXTURE_SIZES: Record<string, number> = {
  linen: 96,
  canvas: 128,
  grain: 112,
  felt: 150,
  brushed: 140,
};

/* Whether a board is dark enough to print light type on. Read from the colour
   rather than a list, so every stock in the palette answers for itself. */
/** Relative luminance of a #rrggbb colour, for deciding what will read on it. */
export function luminance(hex: string): number {
  const channel = (at: number) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function isDarkStock(hex: string): boolean {
  return luminance(hex) < 0.3;
}

const TEMPLATE_BOARDS: Record<string, { stock: string; edge: string }> = {
  polaroid: { stock: '#fcfaf4', edge: '#d8cfbd' },
  minimal: { stock: '#14201f', edge: '#2b3c39' },
  bold: { stock: '#f6efe2', edge: '' },
  fieldnote: { stock: '#fbf6ea', edge: '#cdbfa6' },
};

const TEMPLATE_TEXT: Record<string, { ink: string; inkMuted: string }> = {
  minimal: { ink: '#fdf9ee', inkMuted: 'rgba(253, 249, 238, 0.8)' },
};

const BASE = {
  stock: '#f8f2e6',
  edge: '#cdbfa6',
  edgeWidth: 0.7,
  corner: 3,
  ink: '#241c14',
  inkMuted: '#655a4c',
  artBg: 'rgba(0, 0, 0, 0.06)',
  core: '#efe7d6',
};

function inkFor(token: string | undefined, rarityColour: string): string | null {
  if (!token || token === 'auto') return null;
  if (token === 'rarity') return rarityColour;
  return INKS[token] ?? null;
}

function textureFor(
  texture: string | undefined,
  board: { stock: string } | undefined,
): TextureTokens | null {
  if (texture === 'smooth') return { image: 'none', size: null, opacity: null, blend: null };
  if (texture) {
    const size = TEXTURE_SIZES[texture];
    if (size === undefined) return null;
    return { image: texture, size, opacity: 0.6, blend: 'overlay' };
  }
  if (board && isDarkStock(board.stock))
    return { image: null, size: null, opacity: 0.2, blend: 'screen' };
  return null;
}

/** The palette by token, for anything that needs the colour without its edge. */
export const CARD_COLOURS: Record<string, string> = Object.fromEntries(
  Object.entries(STOCKS).map(([token, board]) => [token, board.stock]),
);

export function resolveCardTokens(key: string, stored: TemplateConfig, rarity: Rarity): CardTokens {
  const config = currentConfig(stored);
  const rarityColour = RARITY_COLOURS[rarity];
  const stockToken = config.stock;
  const board = stockToken ? STOCKS[stockToken] : undefined;
  const template = TEMPLATE_BOARDS[key];

  const border = inkFor(config.border, rarityColour) ?? rarityColour;
  const accent = inkFor(config.accent, rarityColour) ?? INKS.gold!;
  // Null keeps the template text colour.
  const titleInk = inkFor(config.title_ink, rarityColour);
  const bodyInk = inkFor(config.body_ink, rarityColour);

  // 'rarity' selects the tier edge treatment; 'auto' keeps the board edge.
  const byRarity = config.border === 'rarity';
  const rarityEdge = byRarity ? RARITY_EDGES[rarity] : undefined;
  const explicitBorder = config.border && config.border !== 'auto' ? border : null;
  let edge: Paint;
  if (rarityEdge) edge = rarityEdge;
  else if (explicitBorder) edge = { kind: 'solid', color: explicitBorder };
  else if (board) edge = { kind: 'solid', color: board.edge };
  else if (template?.edge) edge = { kind: 'solid', color: template.edge };
  else if (key === 'bold') edge = { kind: 'solid', color: border };
  else edge = { kind: 'solid', color: BASE.edge };

  const weight = config.border_width ? WEIGHTS[config.border_width] : undefined;
  const edgeWidth = weight ?? (key === 'bold' ? 3 : BASE.edgeWidth);

  const corners = config.corners ? CORNERS[config.corners] : undefined;
  const corner = corners ?? (key === 'bold' ? 5 : BASE.corner);

  const darkBoard = board !== undefined && isDarkStock(board.stock);
  const text = darkBoard
    ? { ink: '#fffdf7', inkMuted: '#cdd6d2' }
    : (TEMPLATE_TEXT[key] ?? { ink: BASE.ink, inkMuted: BASE.inkMuted });

  return {
    stock: board?.stock ?? template?.stock ?? BASE.stock,
    edge,
    edgeWidth,
    corner,
    ink: text.ink,
    inkMuted: text.inkMuted,
    artBg: darkBoard ? 'rgba(0, 0, 0, 0.24)' : BASE.artBg,
    accent,
    titleInk,
    bodyInk,
    border,
    rarity: rarityColour,
    core: rarity === 'legendary' ? '#f4e7c4' : BASE.core,
    glow: RARITY_GLOWS[rarity] ?? null,
    texture: textureFor(config.texture, board),
  };
}

export function paintToCss(paint: Paint): string {
  if (paint.kind === 'solid') return paint.color;
  const stops = paint.stops
    .map((stop) => (stop.at === undefined ? stop.color : `${stop.color} ${stop.at}%`))
    .join(', ');
  return `linear-gradient(${paint.angle}deg, ${stops})`;
}

export const CARD_STOCK_TOKENS = Object.keys(STOCKS);
export const CARD_INK_TOKENS = Object.keys(INKS);
