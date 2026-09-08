export interface IdentityColour {
  hue: number;
  saturation: number;
  brightness: number;
}

// Mirrors apps/api/cards/identity.py and drives both renderers.
export const PACK_COLOURS: Record<string, IdentityColour> = {
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

export function resolvePackColour(stored?: string): IdentityColour {
  return PACK_COLOURS[stored || 'mint'] ?? PACK_COLOURS.mint!;
}

export const BINDER_COLOURS: Record<string, IdentityColour> = {
  teal: { hue: 0, saturation: 1.15, brightness: 1 },
  moss: { hue: -40, saturation: 1.6, brightness: 0.95 },
  forest: { hue: -22, saturation: 2, brightness: 0.7 },
  ocean: { hue: 46, saturation: 1.7, brightness: 0.9 },
  indigo: { hue: 80, saturation: 1.9, brightness: 0.74 },
  plum: { hue: 124, saturation: 1.8, brightness: 0.8 },
  oxblood: { hue: 160, saturation: 2.2, brightness: 0.62 },
  rust: { hue: -150, saturation: 3, brightness: 0.84 },
  tan: { hue: -128, saturation: 2, brightness: 1.06 },
  sand: { hue: -112, saturation: 1.1, brightness: 1.22 },
  slate: { hue: 30, saturation: 0.5, brightness: 0.84 },
  charcoal: { hue: 0, saturation: 0.12, brightness: 0.5 },
};

export function resolveBinderColour(stored?: string): IdentityColour {
  return BINDER_COLOURS[stored || 'teal'] ?? BINDER_COLOURS.teal!;
}
