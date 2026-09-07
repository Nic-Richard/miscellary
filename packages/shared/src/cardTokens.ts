import type { TemplateConfig } from './api';
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

const STOCKS: Record<string, { stock: string; edge: string }> = {
  cream: { stock: '#f4ecda', edge: '#d8cdb4' },
  bone: { stock: '#f7f2e6', edge: '#ddd3bf' },
  white: { stock: '#fdfbf6', edge: '#ded6c6' },
  light: { stock: '#f7f2e6', edge: '#ddd3bf' },
  sand: { stock: '#e8dcc2', edge: '#c8b898' },
  linen: { stock: '#efe7d5', edge: '#d3c8ac' },
  ash: { stock: '#d9d3c6', edge: '#b8b0a0' },
  blush: { stock: '#f2e2dd', edge: '#d5bdb6' },
  sky: { stock: '#e4ecf3', edge: '#c1cedb' },
  mint: { stock: '#e3eee6', edge: '#bed3c5' },
  butter: { stock: '#f5edd1', edge: '#dacfa6' },
  peach: { stock: '#f1d6bf', edge: '#d0af93' },
  lavender: { stock: '#e1ddec', edge: '#bbb3d0' },
  sage: { stock: '#d4dfc8', edge: '#afbf9f' },
  lilac: { stock: '#ead5e5', edge: '#c7abc0' },
  cocoa: { stock: '#49332d', edge: '#302019' },
  aubergine: { stock: '#30243f', edge: '#20162d' },
  moss: { stock: '#2c3a22', edge: '#1d2915' },
  teal: { stock: '#17434a', edge: '#0e2f34' },
  wine: { stock: '#4a2036', edge: '#331523' },
  bronze: { stock: '#46341f', edge: '#302213' },
  slate: { stock: '#4a565c', edge: '#333d42' },
  charcoal: { stock: '#3a3733', edge: '#272522' },
  ink: { stock: '#22201c', edge: '#14120f' },
  dark: { stock: '#1f3a36', edge: '#163029' },
  forest: { stock: '#22402f', edge: '#16301f' },
  oxblood: { stock: '#3f2223', edge: '#2b1516' },
  navy: { stock: '#232f4a', edge: '#172038' },
  plum: { stock: '#3b2438', edge: '#281727' },
};

const INKS: Record<string, string> = {
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
  cream: '#f0e6d2',
  white: '#fbf7ef',
  copper: '#b56c49',
  ochre: '#b49736',
  silver: '#aab2b6',
  sage: '#7f9977',
};

const RARITY_COLOURS: Record<Rarity, string> = {
  common: '#3f8f88',
  uncommon: '#b48a2c',
  rare: '#7b5fa3',
  epic: '#c66a3c',
  legendary: '#c9a24a',
};

const RARITY_EDGES: Partial<Record<Rarity, GradientPaint>> = {
  uncommon: {
    kind: 'gradient',
    angle: 160,
    stops: [
      { color: '#dcc078' },
      { color: '#b48a2c', at: 46 },
      { color: '#e2cd91', at: 72 },
      { color: '#9a7420' },
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
      { color: '#f0b28c' },
      { color: '#c66a3c', at: 40 },
      { color: '#f7cbab', at: 65 },
      { color: '#a04c26' },
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

const RARITY_EDGE_WIDTHS: Partial<Record<Rarity, number>> = {
  uncommon: 0.9,
  rare: 1.1,
  epic: 1.4,
  legendary: 2.2,
};

const RARITY_GLOWS: Partial<Record<Rarity, string>> = {
  epic: 'rgba(198, 106, 60, 0.3)',
  legendary: 'rgba(184, 144, 58, 0.38)',
};

const WEIGHTS: Record<string, number> = { fine: 1.2, standard: 2.1, bold: 3, heavy: 4.4 };
const CORNERS: Record<string, number> = { soft: 1.6, sharp: 0.4 };

const TEXTURE_SIZES: Record<string, number> = {
  linen: 96,
  canvas: 128,
  grain: 112,
  felt: 150,
  brushed: 140,
};

const DARK_STOCKS = new Set([
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

const TEMPLATE_BOARDS: Record<string, { stock: string; edge: string }> = {
  polaroid: { stock: '#fcfaf4', edge: '#d8cfbd' },
  minimal: { stock: '#14201f', edge: '#2b3c39' },
  bold: { stock: '#f6efe2', edge: '' },
  fieldnote: { stock: '#fbf6ea', edge: '#cdbfa6' },
  dossier: { stock: '#23292b', edge: '#12181a' },
};

const TEMPLATE_TEXT: Record<string, { ink: string; inkMuted: string }> = {
  minimal: { ink: '#fdf9ee', inkMuted: 'rgba(253, 249, 238, 0.8)' },
  dossier: { ink: '#ece5d6', inkMuted: '#a9b2ad' },
};

const BASE = {
  stock: '#f8f2e6',
  edge: '#cdbfa6',
  edgeWidth: 0.7,
  corner: 3,
  ink: '#3a2f26',
  inkMuted: '#6f6355',
  artBg: 'rgba(0, 0, 0, 0.06)',
  core: '#efe7d6',
};

function inkFor(token: string | undefined, rarityColour: string): string | null {
  if (!token || token === 'auto') return null;
  if (token === 'rarity') return rarityColour;
  return INKS[token] ?? null;
}

function textureFor(
  key: string,
  texture: string | undefined,
  stockToken: string | undefined,
): TextureTokens | null {
  if (texture === 'smooth') return { image: 'none', size: null, opacity: null, blend: null };
  if (texture) {
    const size = TEXTURE_SIZES[texture];
    if (size === undefined) return null;
    return { image: texture, size, opacity: 0.6, blend: 'overlay' };
  }
  if (stockToken && DARK_STOCKS.has(stockToken))
    return { image: null, size: null, opacity: 0.2, blend: 'screen' };
  if (key === 'dossier') return { image: null, size: null, opacity: 0.16, blend: 'screen' };
  return null;
}

export function resolveCardTokens(key: string, config: TemplateConfig, rarity: Rarity): CardTokens {
  const rarityColour = RARITY_COLOURS[rarity];
  const stockToken = config.frame;
  const board = stockToken ? STOCKS[stockToken] : undefined;
  const template = TEMPLATE_BOARDS[key];

  const border = inkFor(config.border, rarityColour) ?? rarityColour;
  const accent = inkFor(config.accent, rarityColour) ?? INKS.gold!;

  // An explicit border ink outranks the rarity edge, which outranks the board edge.
  const explicitBorder = config.border && config.border !== 'auto' ? border : null;
  const rarityEdge = RARITY_EDGES[rarity];
  let edge: Paint;
  if (explicitBorder) edge = { kind: 'solid', color: explicitBorder };
  else if (rarityEdge) edge = rarityEdge;
  else if (board) edge = { kind: 'solid', color: board.edge };
  else if (template?.edge) edge = { kind: 'solid', color: template.edge };
  else if (key === 'bold') edge = { kind: 'solid', color: border };
  else edge = { kind: 'solid', color: BASE.edge };

  const weight = config.weight ? WEIGHTS[config.weight] : undefined;
  const edgeWidth = weight ?? RARITY_EDGE_WIDTHS[rarity] ?? (key === 'bold' ? 3 : BASE.edgeWidth);

  const corners = config.corners ? CORNERS[config.corners] : undefined;
  const corner = corners ?? (key === 'bold' ? 5 : BASE.corner);

  const darkBoard = stockToken !== undefined && DARK_STOCKS.has(stockToken);
  const text = darkBoard
    ? { ink: '#f3ecdd', inkMuted: '#b9c9c4' }
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
    border,
    rarity: rarityColour,
    core: rarity === 'legendary' ? '#f4e7c4' : BASE.core,
    glow: RARITY_GLOWS[rarity] ?? null,
    texture: textureFor(key, config.texture, stockToken),
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
