import type { TemplateConfig } from './api';
import { CARD_COLOURS, isDarkStock } from './cardTokens';
import { currentConfig } from './cardConfig';
import type { Rarity } from './rarity';

export interface Stop {
  color: string;
  at?: number;
}
export interface Gradient {
  angle: number;
  stops: Stop[];
}

export interface RepeatingGradient extends Gradient {
  period: number;
}

export interface ReliefShadow {
  spread: number;
  blur: number;
  color: string;
}

export interface ChaseLayer {
  stripes: RepeatingGradient;
  sheet: Gradient;
  blend: string;
  opacity: number;
}
export interface ChaseBand {
  gradient: Gradient;
  scale: number;
  blend: string;
  opacity: number;
}
export interface Chase {
  field: ChaseLayer;
  band: ChaseBand;
}

export type SpotMaterial = 'varnish' | 'pearl' | 'foil' | 'holo';
export type SpotArea = 'spot' | 'reverse' | 'full';
export type SpotPattern = 'linear' | 'mirror' | 'cosmos' | 'rainbow';

export const SPOT_PATTERNS: Record<SpotPattern, { grain: string; size: string; wash?: string }> = {
  linear: { grain: '', size: '' },
  mirror: { grain: 'none', size: 'auto' },
  cosmos: {
    grain: [
      'radial-gradient(circle at 30% 22%, rgba(255, 255, 255, 0.95) 0 0.5cqw, transparent 1.3cqw)',
      'radial-gradient(circle at 72% 58%, rgba(255, 255, 255, 0.8) 0 0.34cqw, transparent 1cqw)',
      'radial-gradient(circle at 44% 84%, rgba(255, 255, 255, 0.62) 0 0.8cqw, transparent 1.9cqw)',
      'radial-gradient(circle at 86% 28%, rgba(206, 232, 255, 0.75) 0 0.4cqw, transparent 1.1cqw)',
    ].join(', '),
    size: '13cqw 17cqw, 19cqw 11cqw, 27cqw 23cqw, 17cqw 19cqw',
  },
  rainbow: {
    grain: 'none',
    size: 'auto',
    wash: [
      'linear-gradient(var(--lit-angle, 104deg),',
      'rgba(255, 170, 210, 0.5) 4%,',
      'rgba(255, 214, 160, 0.46) 20%,',
      'rgba(246, 246, 158, 0.44) 36%,',
      'rgba(166, 240, 190, 0.46) 52%,',
      'rgba(158, 216, 255, 0.48) 68%,',
      'rgba(196, 174, 255, 0.5) 84%,',
      'rgba(255, 176, 224, 0.5) 100%)',
    ].join(' '),
  },
};

export interface CardSpot {
  material: SpotMaterial;
  area: SpotArea;
  pattern: SpotPattern;
  layers: Chase;
}

export interface CardMaterial {
  coat: Gradient;
  coatBlend: string;
  grain: number;
  sheen: number;
  relief: ReliefShadow[] | null;
  spot: CardSpot | null;
}

const COATS: Record<string, Gradient> = {
  matte: {
    angle: 104,
    stops: [
      { color: 'rgba(255, 255, 255, 0)', at: 30 },
      { color: 'rgba(255, 252, 244, 0.07)', at: 50 },
      { color: 'rgba(255, 255, 255, 0)', at: 70 },
    ],
  },
  satin: {
    angle: 104,
    stops: [
      { color: 'rgba(255, 255, 255, 0)', at: 20 },
      { color: 'rgba(255, 253, 246, 0.14)', at: 38 },
      { color: 'rgba(255, 255, 255, 0.26)', at: 50 },
      { color: 'rgba(255, 253, 246, 0.14)', at: 62 },
      { color: 'rgba(255, 255, 255, 0)', at: 80 },
    ],
  },
  gloss: {
    angle: 104,
    stops: [
      { color: 'rgba(255, 255, 255, 0)', at: 38 },
      { color: 'rgba(255, 255, 255, 0.2)', at: 46 },
      { color: 'rgba(255, 255, 255, 0.86)', at: 50 },
      { color: 'rgba(255, 255, 255, 0.2)', at: 54 },
      { color: 'rgba(255, 255, 255, 0)', at: 62 },
      { color: 'rgba(255, 255, 255, 0.09)', at: 72 },
      { color: 'rgba(255, 255, 255, 0)', at: 80 },
    ],
  },
  pearl: {
    angle: 104,
    stops: [
      { color: 'rgba(255, 255, 255, 0)', at: 14 },
      { color: 'rgba(196, 172, 255, 0.34)', at: 30 },
      { color: 'rgba(255, 255, 255, 0.6)', at: 43 },
      { color: 'rgba(158, 220, 255, 0.38)', at: 53 },
      { color: 'rgba(255, 232, 190, 0.32)', at: 66 },
      { color: 'rgba(214, 176, 255, 0.24)', at: 80 },
      { color: 'rgba(255, 255, 255, 0)', at: 92 },
    ],
  },
  metal: {
    angle: 104,
    stops: [
      { color: 'rgba(26, 16, 4, 0.2)', at: 16 },
      { color: 'rgba(255, 238, 206, 0.52)', at: 32 },
      { color: 'rgba(52, 34, 8, 0.3)', at: 43 },
      { color: 'rgba(255, 250, 232, 0.82)', at: 51 },
      { color: 'rgba(52, 34, 8, 0.28)', at: 60 },
      { color: 'rgba(255, 232, 194, 0.44)', at: 71 },
      { color: 'rgba(26, 16, 4, 0.18)', at: 88 },
    ],
  },
};

const DARK_COATS: Record<string, Gradient> = {
  pearl: {
    angle: 104,
    stops: [
      { color: 'rgba(255, 255, 255, 0)', at: 12 },
      { color: 'rgba(206, 226, 255, 0.3)', at: 30 },
      { color: 'rgba(255, 255, 255, 0.52)', at: 44 },
      { color: 'rgba(176, 210, 240, 0.3)', at: 56 },
      { color: 'rgba(226, 214, 255, 0.24)', at: 74 },
      { color: 'rgba(255, 255, 255, 0)', at: 90 },
    ],
  },
  gloss: {
    angle: 104,
    stops: [
      { color: 'rgba(255, 255, 255, 0)', at: 38 },
      { color: 'rgba(255, 255, 255, 0.26)', at: 46 },
      { color: 'rgba(255, 255, 255, 0.96)', at: 50 },
      { color: 'rgba(255, 255, 255, 0.26)', at: 54 },
      { color: 'rgba(255, 255, 255, 0)', at: 62 },
      { color: 'rgba(255, 255, 255, 0.12)', at: 72 },
      { color: 'rgba(255, 255, 255, 0)', at: 80 },
    ],
  },
};

const FINISHES: Record<string, { coat: string; grain: number; sheen: number }> = {
  matte: { coat: 'matte', grain: 0.56, sheen: 0.5 },
  satin: { coat: 'satin', grain: 0.34, sheen: 0.72 },
  gloss: { coat: 'gloss', grain: 0.14, sheen: 0.92 },
  pearl: { coat: 'pearl', grain: 0.2, sheen: 0.84 },
  metallic: { coat: 'metal', grain: 0.1, sheen: 0.96 },
};

const BASE_FINISH = { coat: 'matte', grain: 0.56, sheen: 0.5 };

const COAT_BLENDS: Record<string, string> = {
  matte: 'soft-light',
  satin: 'soft-light',
  gloss: 'overlay',
  pearl: 'soft-light',
  metal: 'overlay',
};

const STRUCK_RIM: ReliefShadow[] = [
  { spread: 0.5, blur: 0, color: 'rgba(255, 248, 226, 0.24)' },
  { spread: 0, blur: 1.4, color: 'rgba(40, 24, 8, 0.28)' },
];
const STRUCK_TIERS = new Set(['rare', 'epic', 'legendary']);

const FOIL: Chase = {
  field: {
    stripes: {
      angle: 100,
      period: 1.1,
      stops: [
        { color: 'rgba(255, 250, 228, 0)', at: 0 },
        { color: 'rgba(255, 250, 228, 0)', at: 0.22 },
        { color: 'rgba(255, 252, 236, 0.55)', at: 0.4 },
        { color: 'rgba(78, 56, 12, 0.4)', at: 0.68 },
        { color: 'rgba(255, 250, 228, 0)', at: 1.1 },
      ],
    },
    sheet: {
      angle: 104,
      stops: [
        { color: '#7a5a1d', at: 3 },
        { color: '#d8b358', at: 13 },
        { color: '#fff6d6', at: 24 },
        { color: '#b98f31', at: 34 },
        { color: '#6d5119', at: 44 },
        { color: '#e7c976', at: 56 },
        { color: '#fffbe9', at: 66 },
        { color: '#a97f28', at: 78 },
        { color: '#d9b65f', at: 90 },
        { color: '#6b4f18', at: 99 },
      ],
    },
    blend: 'overlay',
    opacity: 0.62,
  },
  band: {
    gradient: {
      angle: 104,
      stops: [
        { color: 'transparent', at: 41 },
        { color: 'rgba(255, 253, 242, 0.95)', at: 48 },
        { color: 'rgba(255, 226, 150, 0.55)', at: 52 },
        { color: 'transparent', at: 60 },
      ],
    },
    scale: 2.6,
    blend: 'hard-light',
    opacity: 0.7,
  },
};

const HOLO: Chase = {
  field: {
    stripes: {
      angle: 73,
      period: 2,
      stops: [
        { color: 'rgba(255, 255, 255, 0)', at: 0 },
        { color: 'rgba(255, 255, 255, 0)', at: 0.55 },
        { color: 'rgba(255, 255, 255, 0.3)', at: 0.95 },
        { color: 'rgba(40, 20, 90, 0.2)', at: 1.35 },
        { color: 'rgba(255, 255, 255, 0)', at: 2 },
      ],
    },
    sheet: {
      angle: 104,
      stops: [
        { color: 'rgba(120, 205, 255, 0.3)' },
        { color: 'rgba(255, 145, 220, 0.26)', at: 38 },
        { color: 'rgba(160, 255, 205, 0.26)', at: 68 },
        { color: 'rgba(150, 160, 255, 0.3)' },
      ],
    },
    blend: 'overlay',
    opacity: 0.34,
  },
  band: {
    gradient: {
      angle: 104,
      stops: [
        { color: 'transparent', at: 20 },
        { color: 'rgba(104, 16, 78, 0.34)', at: 26 },
        { color: 'rgba(255, 44, 140, 0.48)', at: 31 },
        { color: 'rgba(132, 96, 0, 0.3)', at: 35 },
        { color: 'rgba(255, 200, 50, 0.5)', at: 39 },
        { color: 'rgba(0, 104, 78, 0.32)', at: 43 },
        { color: 'rgba(90, 255, 180, 0.5)', at: 47 },
        { color: 'rgba(255, 255, 250, 0.44)', at: 50.5 },
        { color: 'rgba(8, 58, 122, 0.34)', at: 54 },
        { color: 'rgba(60, 195, 255, 0.5)', at: 58 },
        { color: 'rgba(58, 16, 112, 0.34)', at: 63 },
        { color: 'rgba(170, 90, 255, 0.48)', at: 67 },
        { color: 'rgba(96, 14, 66, 0.28)', at: 72 },
        { color: 'transparent', at: 79 },
      ],
    },
    scale: 2.5,
    blend: 'hard-light',
    opacity: 0.62,
  },
};

const VARNISH: Chase = {
  field: {
    stripes: {
      angle: 104,
      period: 0.9,
      stops: [
        { color: 'rgba(255, 255, 255, 0)', at: 0 },
        { color: 'rgba(255, 255, 255, 0.05)', at: 0.45 },
        { color: 'rgba(255, 255, 255, 0)', at: 0.9 },
      ],
    },
    sheet: {
      angle: 104,
      stops: [
        { color: 'rgba(255, 255, 255, 0.04)', at: 0 },
        { color: 'rgba(255, 255, 255, 0.12)', at: 50 },
        { color: 'rgba(255, 255, 255, 0.04)', at: 100 },
      ],
    },
    blend: 'soft-light',
    opacity: 0.5,
  },
  band: {
    gradient: {
      angle: 104,
      stops: [
        { color: 'transparent', at: 40 },
        { color: 'rgba(255, 255, 255, 0.34)', at: 47 },
        { color: 'rgba(255, 255, 255, 0.92)', at: 50 },
        { color: 'rgba(255, 255, 255, 0.34)', at: 53 },
        { color: 'transparent', at: 60 },
      ],
    },
    scale: 2.2,
    blend: 'screen',
    opacity: 0.62,
  },
};

const PEARL_SPOT: Chase = {
  field: {
    stripes: {
      angle: 96,
      period: 1.6,
      stops: [
        { color: 'rgba(255, 255, 255, 0)', at: 0 },
        { color: 'rgba(255, 255, 255, 0.16)', at: 0.7 },
        { color: 'rgba(120, 96, 190, 0.12)', at: 1.1 },
        { color: 'rgba(255, 255, 255, 0)', at: 1.6 },
      ],
    },
    sheet: {
      angle: 104,
      stops: [
        { color: 'rgba(206, 178, 255, 0.34)', at: 4 },
        { color: 'rgba(255, 250, 240, 0.4)', at: 26 },
        { color: 'rgba(150, 216, 255, 0.34)', at: 48 },
        { color: 'rgba(255, 228, 186, 0.32)', at: 70 },
        { color: 'rgba(214, 176, 255, 0.34)', at: 96 },
      ],
    },
    blend: 'overlay',
    opacity: 0.58,
  },
  band: {
    gradient: {
      angle: 104,
      stops: [
        { color: 'transparent', at: 28 },
        { color: 'rgba(212, 186, 255, 0.42)', at: 38 },
        { color: 'rgba(255, 255, 255, 0.72)', at: 48 },
        { color: 'rgba(164, 224, 255, 0.46)', at: 56 },
        { color: 'rgba(255, 232, 196, 0.36)', at: 66 },
        { color: 'transparent', at: 76 },
      ],
    },
    scale: 3,
    blend: 'screen',
    opacity: 0.5,
  },
};

const SPOT_LAYERS: Record<SpotMaterial, Chase> = {
  varnish: VARNISH,
  pearl: PEARL_SPOT,
  foil: FOIL,
  holo: HOLO,
};

const SPOT_TIERS = new Set(['uncommon', 'rare', 'epic', 'legendary']);
const SPOT_AREAS = new Set<SpotArea>(['spot', 'reverse', 'full']);
const PATTERNS = new Set<SpotPattern>(['linear', 'mirror', 'cosmos', 'rainbow']);

/** Resolves the stored foil or holo treatment and its coverage. */
export function resolveCardSpot(
  stored: TemplateConfig,
  rarity: Rarity,
): { material: SpotMaterial; area: SpotArea; pattern: SpotPattern } | null {
  if (!SPOT_TIERS.has(rarity)) return null;
  const config = currentConfig(stored);
  const treatment = config.treatment;
  if (treatment !== 'foil' && treatment !== 'holo') return null;
  const chosen = config.pattern as SpotPattern | undefined;
  const pattern = chosen && PATTERNS.has(chosen) ? chosen : 'linear';
  const coverage = config.coverage as SpotArea | undefined;
  const area = coverage && SPOT_AREAS.has(coverage) ? coverage : 'spot';
  return { material: treatment, area, pattern };
}

const DARK_TEMPLATES = new Set(['minimal']);

export function resolveCardMaterial(
  key: string,
  stored: TemplateConfig,
  rarity: Rarity,
): CardMaterial {
  const config = currentConfig(stored);
  const board = config.stock ? CARD_COLOURS[config.stock] : undefined;
  const dark = DARK_TEMPLATES.has(key) || (!!board && isDarkStock(board));
  const finish = FINISHES[config.finish ?? ''] ?? BASE_FINISH;
  const coat = (dark ? DARK_COATS[finish.coat] : undefined) ?? COATS[finish.coat] ?? COATS.matte!;
  const spot = resolveCardSpot(stored, rarity);

  return {
    coat,
    coatBlend: COAT_BLENDS[finish.coat] ?? 'soft-light',
    grain: finish.grain,
    sheen: finish.sheen,
    relief: STRUCK_TIERS.has(rarity) ? STRUCK_RIM : null,
    spot: spot ? { ...spot, layers: SPOT_LAYERS[spot.material] } : null,
  };
}

export function expandRepeating(gradient: RepeatingGradient, width: number): Gradient {
  const period = (gradient.period / 100) * width;
  if (period <= 0) return { angle: gradient.angle, stops: gradient.stops };
  const span = Math.hypot(width, width * 1.4);
  const cycles = Math.min(Math.ceil(span / period), 400);
  const stops: Stop[] = [];
  for (let cycle = 0; cycle < cycles; cycle++) {
    for (const stop of gradient.stops) {
      const at = ((cycle * gradient.period + (stop.at ?? 0)) / (cycles * gradient.period)) * 100;
      stops.push({ color: stop.color, at });
    }
  }
  return { angle: gradient.angle, stops };
}
