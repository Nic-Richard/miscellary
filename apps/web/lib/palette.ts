// Token lists mirror server validation; these values only paint editor swatches.

export interface Family<T = string> {
  label: string;
  values: T[];
}

export const INK_COLOURS: Record<string, string> = {
  rarity: '#8d8477',
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
};

export const INK_FAMILIES: Family[] = [
  { label: 'Neutral', values: ['ink', 'charcoal', 'slate'] },
  { label: 'Green', values: ['teal', 'green', 'forest'] },
  { label: 'Blue', values: ['blue', 'ocean', 'indigo'] },
  { label: 'Purple', values: ['purple', 'violet', 'plum'] },
  { label: 'Red', values: ['rose', 'red', 'crimson'] },
  { label: 'Warm', values: ['rust', 'ember', 'gold', 'bronze'] },
  { label: 'Pale', values: ['cream', 'white'] },
];

export const STOCK_COLOURS: Record<string, string> = {
  cream: '#f4ecda',
  bone: '#f7f2e6',
  white: '#fdfbf6',
  sand: '#e8dcc2',
  linen: '#efe7d5',
  ash: '#d9d3c6',
  light: '#f7f2e6',
  slate: '#4a565c',
  charcoal: '#3a3733',
  ink: '#22201c',
  dark: '#1c3b38',
  forest: '#22402f',
  oxblood: '#3f2223',
  navy: '#232f4a',
  plum: '#3b2438',
};

export const STOCK_FAMILIES: Family[] = [
  { label: 'Pale', values: ['white', 'bone', 'light', 'cream', 'linen'] },
  { label: 'Warm', values: ['sand', 'ash'] },
  { label: 'Deep', values: ['slate', 'charcoal', 'ink', 'dark'] },
  { label: 'Colour', values: ['forest', 'navy', 'oxblood', 'plum'] },
];

// Preserve unknown server tokens so new values remain selectable.
export function groupValues(values: string[], families: Family[]): Family[] {
  const seen = new Set<string>();
  const out: Family[] = [];
  for (const family of families) {
    const present = family.values.filter((v) => values.includes(v));
    present.forEach((v) => seen.add(v));
    if (present.length) out.push({ label: family.label, values: present });
  }
  const rest = values.filter((v) => !seen.has(v) && v !== 'rarity');
  if (rest.length) out.push({ label: 'Other', values: rest });
  return out;
}

export function swatchColour(token: string): string {
  return INK_COLOURS[token] ?? STOCK_COLOURS[token] ?? '#b9b0a0';
}
