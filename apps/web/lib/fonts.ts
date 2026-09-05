// Keys mirror API validation; app/layout.tsx supplies the self-hosted variables.

export const FONT_KEYS = [
  'display',
  'body',
  'playfair',
  'cinzel',
  'archivo',
  'spacemono',
  'caveat',
  'alfa',
] as const;

export const FONT_LABELS: Record<string, string> = {
  display: 'Condensed',
  body: 'Plain',
  playfair: 'Serif',
  cinzel: 'Engraved',
  archivo: 'Heavy',
  spacemono: 'Monospace',
  caveat: 'Handwritten',
  alfa: 'Slab',
};

export const FONT_VARS: Record<string, string> = {
  display: 'var(--font-display), Impact, sans-serif',
  body: 'var(--font-body), system-ui, sans-serif',
  playfair: 'var(--font-playfair), Georgia, serif',
  cinzel: 'var(--font-cinzel), Georgia, serif',
  archivo: 'var(--font-archivo), Impact, sans-serif',
  spacemono: 'var(--font-spacemono), ui-monospace, monospace',
  caveat: 'var(--font-caveat), cursive',
  alfa: 'var(--font-alfa), Georgia, serif',
};

export function fontStack(key: string | undefined): string {
  return FONT_VARS[key || 'display'] ?? FONT_VARS['display']!;
}
