import type { TemplateConfig } from './api';
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

export interface CardMaterial {
  coat: Gradient;
  coatBlend: string;
  grain: number;
  sheen: number;
  relief: ReliefShadow[] | null;

  varnish: boolean;
  chase: Chase | null;
}

const COATS: Record<string, Gradient> = {
  matte: {
    angle: 104,
    stops: [
      { color: 'rgba(255, 255, 255, 0)', at: 26 },
      { color: 'rgba(255, 255, 255, 0.05)', at: 50 },
      { color: 'rgba(255, 255, 255, 0)', at: 74 },
    ],
  },
  satin: {
    angle: 104,
    stops: [
      { color: 'rgba(255, 255, 255, 0)', at: 18 },
      { color: 'rgba(255, 255, 255, 0.12)', at: 46 },
      { color: 'rgba(255, 255, 255, 0)', at: 78 },
    ],
  },
  gloss: {
    angle: 104,
    stops: [
      { color: 'rgba(255, 255, 255, 0)', at: 14 },
      { color: 'rgba(255, 255, 255, 0.06)', at: 34 },
      { color: 'rgba(255, 255, 255, 0.2)', at: 46 },
      { color: 'rgba(255, 255, 255, 0.05)', at: 58 },
      { color: 'rgba(255, 255, 255, 0)', at: 82 },
    ],
  },
  pearl: {
    angle: 104,
    stops: [
      { color: 'rgba(198, 178, 255, 0.2)', at: 6 },
      { color: 'rgba(255, 255, 255, 0.16)', at: 28 },
      { color: 'rgba(170, 214, 255, 0.16)', at: 48 },
      { color: 'rgba(255, 255, 255, 0.12)', at: 68 },
      { color: 'rgba(212, 176, 255, 0.2)', at: 92 },
    ],
  },
  metal: {
    angle: 104,
    stops: [
      { color: 'rgba(255, 190, 142, 0.1)', at: 4 },
      { color: 'rgba(255, 240, 222, 0.3)', at: 20 },
      { color: 'rgba(196, 118, 70, 0.08)', at: 34 },
      { color: 'rgba(255, 246, 232, 0.34)', at: 52 },
      { color: 'rgba(196, 118, 70, 0.08)', at: 66 },
      { color: 'rgba(255, 236, 214, 0.24)', at: 82 },
      { color: 'rgba(255, 190, 142, 0.1)', at: 96 },
    ],
  },
};

const DARK_COATS: Record<string, Gradient> = {
  pearl: {
    angle: 104,
    stops: [
      { color: 'rgba(206, 226, 255, 0.16)', at: 8 },
      { color: 'rgba(255, 255, 255, 0.26)', at: 30 },
      { color: 'rgba(176, 200, 232, 0.12)', at: 52 },
      { color: 'rgba(255, 255, 255, 0.2)', at: 72 },
      { color: 'rgba(206, 226, 255, 0.16)', at: 94 },
    ],
  },
  gloss: {
    angle: 104,
    stops: [
      { color: 'rgba(255, 255, 255, 0)', at: 14 },
      { color: 'rgba(255, 255, 255, 0.1)', at: 34 },
      { color: 'rgba(255, 255, 255, 0.28)', at: 46 },
      { color: 'rgba(255, 255, 255, 0.08)', at: 58 },
      { color: 'rgba(255, 255, 255, 0)', at: 82 },
    ],
  },
};

const FINISHES: Record<string, { coat: string; grain: number; sheen: number }> = {
  matte: { coat: 'matte', grain: 0.4, sheen: 0.62 },
  satin: { coat: 'satin', grain: 0.3, sheen: 0.74 },
  gloss: { coat: 'gloss', grain: 0.22, sheen: 0.86 },
  pearl: { coat: 'pearl', grain: 0.24, sheen: 0.9 },
  metallic: { coat: 'metal', grain: 0.18, sheen: 1 },
};

const RARITY_FINISHES: Partial<Record<Rarity, { coat: string; grain: number; sheen: number }>> = {
  rare: { coat: 'pearl', grain: 0.24, sheen: 0.72 },
  epic: { coat: 'metal', grain: 0.18, sheen: 0.82 },
};

const BASE_FINISH = { coat: 'matte', grain: 0.4, sheen: 0.62 };

const RELIEFS: Record<string, ReliefShadow[]> = {
  emboss: [
    { spread: 0.5, blur: 0, color: 'rgba(255, 248, 226, 0.24)' },
    { spread: 0, blur: 1.4, color: 'rgba(40, 24, 8, 0.28)' },
  ],
  deboss: [
    { spread: 0.5, blur: 0, color: 'rgba(40, 24, 8, 0.26)' },
    { spread: 0, blur: 1.4, color: 'rgba(255, 248, 226, 0.2)' },
  ],
};

// Preserve the default relief for stored epic and legendary cards.
const RARITY_RELIEF: ReliefShadow[] = [
  { spread: 0.5, blur: 0, color: 'rgba(255, 248, 226, 0.2)' },
  { spread: 0, blur: 1.3, color: 'rgba(40, 24, 8, 0.26)' },
];

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

const DARK_TEMPLATES = new Set(['minimal', 'dossier']);

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

export function resolveCardMaterial(
  key: string,
  config: TemplateConfig,
  rarity: Rarity,
): CardMaterial {
  const dark = DARK_TEMPLATES.has(key) || (!!config.frame && DARK_STOCKS.has(config.frame));
  // Explicit finishes override rarity defaults.
  const finish = config.finish
    ? (FINISHES[config.finish] ?? BASE_FINISH)
    : (RARITY_FINISHES[rarity] ?? BASE_FINISH);
  const coat = (dark ? DARK_COATS[finish.coat] : undefined) ?? COATS[finish.coat] ?? COATS.matte!;
  const rarityRelief = rarity === 'epic' || rarity === 'legendary' ? RARITY_RELIEF : null;
  const treatment = config.treatment;

  return {
    coat,
    coatBlend: 'soft-light',
    grain: finish.grain,
    sheen: finish.sheen,
    relief: config.relief ? (RELIEFS[config.relief] ?? null) : rarityRelief,
    varnish: config.relief === 'spot',
    chase: treatment === 'foil' ? FOIL : treatment === 'holo' ? HOLO : null,
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
