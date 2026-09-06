// Client labels for server-defined option tokens.

import type { OptionGroup } from '@miscellary/shared';

export const GROUP_LABELS: Record<OptionGroup, string> = {
  board: 'Board',
  print: 'Print',
  type: 'Type and ink',
  press: 'Press',
};

export const GROUP_NOTES: Record<OptionGroup, string> = {
  board: 'What the card is printed on and how it is cut.',
  print: 'How the photograph is reproduced and mounted.',
  type: 'The face it is set in and the ink it is printed with.',
  press: 'Coatings and specialty work applied after printing.',
};

const VALUE_LABELS: Record<string, Record<string, string>> = {
  frame: {
    dark: 'Pine',
    ink: 'Ink',
    light: 'Bone',
  },
  weight: {
    fine: 'Fine',
    standard: 'Standard',
    bold: 'Bold',
    heavy: 'Heavy',
  },
  shape: {
    square: 'Square',
    arch: 'Arch',
    circle: 'Round',
    diamond: 'Diamond',
    hex: 'Hexagon',
  },
  accent: {
    rarity: 'Rarity colour',
    ink: 'Ink black',
  },
  border: {
    rarity: 'Rarity colour',
    ink: 'Ink black',
  },
  texture: {
    smooth: 'Smooth',
  },
  corners: {
    round: 'Rounded',
    soft: 'Soft',
    sharp: 'Square',
  },
  tint: {
    none: 'As shot',
    punch: 'Punchy',
    mono: 'Black and white',
  },
  window: {
    line: 'Rule',
    none: 'Bare',
    mat: 'Mount',
    inset: 'Sunk',
  },
  paper: {
    dot: 'Dotted',
  },
  gradient: {
    none: 'No scrim',
    full: 'Whole face',
  },
  relief: {
    none: 'None',
    spot: 'Spot varnish',
    emboss: 'Embossed',
    deboss: 'Debossed',
  },
  treatment: {
    none: 'None',
    holo: 'Holographic',
  },
  coverage: {
    art: 'Over the photo',
    frame: 'Struck border',
    full: 'Whole card',
  },
};

function titleCase(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export function valueLabel(option: string, value: string): string {
  return VALUE_LABELS[option]?.[value] ?? titleCase(value);
}

export function valueLabels(option: string, values: string[]): Record<string, string> {
  return Object.fromEntries(values.map((v) => [v, valueLabel(option, v)]));
}
