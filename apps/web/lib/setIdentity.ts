import type { CSSProperties } from 'react';
import { CARD_COLOURS, swatchColour } from './palette';
import {
  BINDER_COLOURS,
  PACK_COLOURS,
  resolveBinderColour,
  resolvePackColour,
} from '@miscellary/shared';

export { BINDER_COLOURS, PACK_COLOURS };

// Lists mirror apps/api/cards/identity.py.

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
  'acorn',
  'anchor',
  'beetle',
  'butterfly',
  'cactus',
  'cloud',
  'cog',
  'compass',
  'fern',
  'fish',
  'honeycomb',
  'lantern',
  'mushroom',
  'pine',
  'snowflake',
  'sprout',
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
  acorn: 'Acorn',
  anchor: 'Anchor',
  beetle: 'Beetle',
  butterfly: 'Butterfly',
  cactus: 'Cactus',
  cloud: 'Cloud',
  cog: 'Cog',
  compass: 'Compass',
  fern: 'Fern',
  fish: 'Fish',
  honeycomb: 'Honeycomb',
  lantern: 'Lantern',
  mushroom: 'Mushroom',
  pine: 'Pine',
  snowflake: 'Snowflake',
  sprout: 'Sprout',
  none: 'No mark',
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

// Pack text coordinates are percentages from the pack centre.
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

export const PACK_ASPECT = 886 / 530;

// Coverage uses rendered geometry because layers scale by width.
export function coversPack(layer: PackLayer): boolean {
  if (layer.kind !== 'image' || layer.hidden || !layer.width || !layer.height) return false;
  if (layer.opacity < 100 || layer.rotate !== 0) return false;
  const widths = layer.scale / 100;
  const heights = (widths * layer.height) / layer.width / PACK_ASPECT;
  return widths >= 1 && heights >= 1;
}

export const EMBLEM_TEXT_NAMES = CARD_COLOURS;

export function emblemInk(token: string | undefined): string {
  return swatchColour(token || 'teal');
}

export const SCALE_MIN = 60;
export const SCALE_MAX = 140;

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
  const c = resolvePackColour(stored);
  return {
    '--pack-hue': `${c.hue}deg`,
    '--pack-saturation': `${c.saturation}`,
    '--pack-brightness': `${c.brightness}`,
  } as CSSProperties;
}

export function packSwatchStyle(token: string): CSSProperties {
  const c = resolvePackColour(token);
  return {
    background: 'var(--foil)',
    filter: `hue-rotate(${c.hue}deg) saturate(${c.saturation}) brightness(${c.brightness})`,
  };
}

export const BINDER_COLOUR_NAMES = Object.keys(BINDER_COLOURS);

export function binderStyle(stored: string | undefined): CSSProperties {
  const c = resolveBinderColour(stored);
  return {
    '--binder-hue': `${c.hue}deg`,
    '--binder-saturation': `${c.saturation}`,
    '--binder-brightness': `${c.brightness}`,
  } as CSSProperties;
}

// Scale the shelf texture so one cover token matches the open-binder cloth.
const SHELF_SATURATION = 20.9 / 67;
const SHELF_BRIGHTNESS = 43.1 / 17.8;

export function binderClothStyle(token: string): CSSProperties {
  const c = resolveBinderColour(token);
  const saturation = (c.saturation * SHELF_SATURATION).toFixed(3);
  const brightness = (c.brightness * SHELF_BRIGHTNESS).toFixed(3);
  return {
    backgroundImage: 'var(--cloth-tex)',
    backgroundSize: '220px',
    filter: `hue-rotate(${c.hue}deg) saturate(${saturation}) brightness(${brightness})`,
  };
}

const CLOTH_MEAN = '#708f8b';

export function binderSwatchStyle(token: string): CSSProperties {
  const c = resolveBinderColour(token);
  return {
    background: CLOTH_MEAN,
    filter: `hue-rotate(${c.hue}deg) saturate(${c.saturation}) brightness(${c.brightness})`,
  };
}
