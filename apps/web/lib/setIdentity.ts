import type { CSSProperties } from 'react';

// Lists mirror apps/api/cards/identity.py. Empty values select platform defaults.

export const SET_MARKS = [
  'waves',
  'leaf',
  'peaks',
  'crystal',
  'record',
  'feather',
  'star',
  'shell',
  'bolt',
  'moon',
  'flame',
  'drop',
  'key',
  'bloom',
  'orbit',
  'arrowhead',
] as const;

export const MARK_LABELS: Record<string, string> = {
  waves: 'Sun and waves',
  leaf: 'Leaf',
  peaks: 'Peaks',
  crystal: 'Crystal',
  record: 'Record',
  feather: 'Feather',
  star: 'Star',
  shell: 'Shell',
  bolt: 'Bolt',
  moon: 'Moon',
  flame: 'Flame',
  drop: 'Drop',
  key: 'Key',
  bloom: 'Bloom',
  orbit: 'Orbit',
  arrowhead: 'Arrowhead',
  none: 'No mark',
};

export const PACK_COLOURS: Record<string, { hue: number; saturation: number; brightness: number }> =
  {
    mint: { hue: 0, saturation: 1, brightness: 1 },
    moss: { hue: -42, saturation: 0.95, brightness: 0.97 },
    forest: { hue: -28, saturation: 1.15, brightness: 0.72 },
    ocean: { hue: 54, saturation: 1, brightness: 1 },
    sky: { hue: 38, saturation: 0.75, brightness: 1.16 },
    indigo: { hue: 88, saturation: 1.05, brightness: 0.78 },
    violet: { hue: 108, saturation: 0.95, brightness: 1 },
    orchid: { hue: 148, saturation: 0.9, brightness: 1.06 },
    rose: { hue: 168, saturation: 0.78, brightness: 1.1 },
    crimson: { hue: 172, saturation: 1.15, brightness: 0.82 },
    ember: { hue: -132, saturation: 1, brightness: 1 },
    rust: { hue: -142, saturation: 1.1, brightness: 0.78 },
    gold: { hue: -104, saturation: 1, brightness: 1.08 },
    bronze: { hue: -112, saturation: 0.85, brightness: 0.8 },
    sand: { hue: -96, saturation: 0.45, brightness: 1.18 },
    cream: { hue: -92, saturation: 0.3, brightness: 1.4 },
    white: { hue: 0, saturation: 0.04, brightness: 1.62 },
    silver: { hue: 0, saturation: 0.08, brightness: 1.28 },
    ash: { hue: 0, saturation: 0.2, brightness: 1.06 },
    slate: { hue: 34, saturation: 0.32, brightness: 0.82 },
    charcoal: { hue: 0, saturation: 0.12, brightness: 0.42 },
    black: { hue: 0, saturation: 0.03, brightness: 0.24 },
  };
export const PACK_COLOUR_NAMES = Object.keys(PACK_COLOURS);

export const EMBLEM_LAYOUTS = ['seal', 'stacked', 'wordmark', 'badge', 'crest'] as const;
export const EMBLEM_LAYOUT_LABELS: Record<string, string> = {
  seal: 'Seal (text around)',
  stacked: 'Stacked',
  wordmark: 'Wordmark only',
  badge: 'Badge',
  crest: 'Crest',
};

export const EMBLEM_SHAPES = [
  'disc',
  'shield',
  'banner',
  'diamond',
  'hex',
  'rosette',
  'tablet',
  'none',
] as const;
export const EMBLEM_STYLES = ['filled', 'outline', 'transparent'] as const;

export const PACK_FINISHES = ['gloss', 'satin', 'matte', 'holo'] as const;

export const PACK_LAYER_KINDS = ['image', 'emblem'] as const;

// Free text layers dropped on the pack. Coordinates are percentages of the
// pack's box measured from its centre, so a layer holds its place at any size.
export interface PackTextLayer {
  text: string;
  hidden: boolean;
  font: string;
  colour: string;
  size: number;
  x: number;
  y: number;
  rotate: number;
  tracking: number;
}

export const TEXT_LAYER_DEFAULT: PackTextLayer = {
  text: '',
  hidden: false,
  font: 'display',
  colour: 'cream',
  size: 6,
  x: 0,
  y: 0,
  rotate: 0,
  tracking: 12,
};

export const PACK_SUBTITLE_MAX_LENGTH = 40;
export const PACK_TEXT_MAX_LAYERS = 6;
export const PACK_TEXT_MAX_LENGTH = 40;
export const TEXT_SIZE_MIN = 2;
export const TEXT_SIZE_MAX = 26;
export const TEXT_OFFSET_MIN = -50;
export const TEXT_OFFSET_MAX = 50;
export const TEXT_ROTATE_MIN = -90;
export const TEXT_ROTATE_MAX = 90;
export const TEXT_TRACKING_MIN = -5;
export const TEXT_TRACKING_MAX = 60;

export const ART_SCALE_MIN = 20;
export const ART_SCALE_MAX = 300;
export const ART_OFFSET_MIN = -45;
export const ART_OFFSET_MAX = 45;
export const ART_ROTATE_MIN = -180;
export const ART_ROTATE_MAX = 180;
export const ART_OPACITY_MIN = 10;
export const ART_OPACITY_MAX = 100;
export const PACK_LAYER_MAX = 5;

// The pack front, bottom of the stack first.
export interface PackLayer {
  kind: string;
  image_id: string;
  hidden: boolean;
  url: string;
  width: number;
  height: number;
  scale: number;
  x: number;
  y: number;
  rotate: number;
  flip_x: boolean;
  flip_y: boolean;
  opacity: number;
}

export const LAYER_DEFAULT: Omit<PackLayer, 'image_id' | 'url' | 'width' | 'height'> = {
  kind: 'image',
  hidden: false,
  scale: 70,
  x: 0,
  y: 0,
  rotate: 0,
  flip_x: false,
  flip_y: false,
  opacity: 100,
};

// The pack image's own proportions, for working out whether a layer is drawn
// large enough to cover the wrapper.
export const PACK_ASPECT = 886 / 530;

// Coverage is derived from rendered geometry because layers scale by width.
export function coversPack(layer: PackLayer): boolean {
  if (layer.kind !== 'image' || layer.hidden || !layer.width || !layer.height) return false;
  if (layer.opacity < 100 || layer.rotate !== 0) return false;
  const widths = layer.scale / 100;
  const heights = (widths * layer.height) / layer.width / PACK_ASPECT;
  return widths >= 1 && heights >= 1;
}

export const EMBLEM_TEXT_COLOURS: Record<string, string> = {
  ink: '#241f1a',
  charcoal: '#43413c',
  slate: '#5d6b70',
  teal: '#2f8078',
  forest: '#2b5b3c',
  ocean: '#2f6690',
  indigo: '#3a4482',
  violet: '#6a4b93',
  plum: '#7c3f63',
  rose: '#b1587a',
  crimson: '#9d2f3f',
  rust: '#a8503a',
  ember: '#c4622c',
  gold: '#b8903a',
  bronze: '#84603a',
  cream: '#f0e6d2',
  white: '#fbf7ef',
};
export const EMBLEM_TEXT_NAMES = Object.keys(EMBLEM_TEXT_COLOURS);

export const SCALE_MIN = 60;
export const SCALE_MAX = 140;

export const PACK_COLOUR_FAMILIES = [
  { label: 'Green', values: ['mint', 'moss', 'forest'] },
  { label: 'Blue', values: ['ocean', 'sky', 'indigo'] },
  { label: 'Purple', values: ['violet', 'orchid'] },
  { label: 'Red', values: ['rose', 'crimson'] },
  { label: 'Warm', values: ['ember', 'rust', 'gold', 'bronze', 'sand'] },
  { label: 'Neutral', values: ['cream', 'white', 'silver', 'ash', 'slate', 'charcoal', 'black'] },
];

export interface SetIdentity {
  mark?: string;
  pack_colour?: string;
  pack_finish?: string;
  pack_layers?: PackLayer[];
  emblem_layout?: string;
  emblem_shape?: string;
  emblem_style?: string;
  emblem_text?: string;
  emblem_type_scale?: number;
  mark_scale?: number;
  pack_subtitle?: string;
  pack_text?: PackTextLayer[];
}

export function resolveMark(stored: string | undefined): string {
  return stored || 'waves';
}

export function packStyle(stored: string | undefined): CSSProperties {
  const c = PACK_COLOURS[stored || 'mint'] ?? PACK_COLOURS['mint']!;
  return {
    '--pack-hue': `${c.hue}deg`,
    '--pack-saturation': `${c.saturation}`,
    '--pack-brightness': `${c.brightness}`,
  } as CSSProperties;
}

export function packSwatchStyle(token: string): CSSProperties {
  const c = PACK_COLOURS[token] ?? PACK_COLOURS['mint']!;
  return {
    background: 'var(--foil)',
    filter: `hue-rotate(${c.hue}deg) saturate(${c.saturation}) brightness(${c.brightness})`,
  };
}
