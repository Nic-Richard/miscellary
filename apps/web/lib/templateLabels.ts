import type { OptionGroup } from '@miscellary/shared';

export const GROUP_LABELS: Record<OptionGroup, string> = {
  board: 'Board',
  print: 'Print',
  type: 'Font and ink',
  press: 'Press',
};

export const GROUP_NOTES: Partial<Record<OptionGroup, string>> = {
  press: 'Applied after printing.',
};

/* Labels for tokens whose stored value is not suitable display copy.
   needed where a token cannot be a phrase. Everything else is title-cased. */
const VALUE_LABELS: Record<string, Record<string, string>> = {
  border: { auto: 'Auto', rarity: 'Rarity metal' },
  accent: { rarity: 'Rarity' },
  tint: { mono: 'Black and white' },
  coverage: { spot: 'Spot', reverse: 'Reverse', full: 'Full card' },
  pattern: { linear: 'Linear', mirror: 'Mirror', cosmos: 'Cosmos', rainbow: 'Rainbow' },
  gradient: { none: 'No scrim', full: 'Whole face' },
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
