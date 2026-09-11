// Keys mirror API validation; app/layout.tsx supplies the font variables.

export const FONT_KEYS = [
  'display',
  'oswald',
  'archivo',
  'alfa',
  'marcellus',
  'cinzel',
  'playfair',
  'garamond',
  'spectral',
  'body',
  'cabin',
  'jost',
  'spacemono',
  'caveat',
] as const;

export const FONT_LABELS: Record<string, string> = {
  display: 'Bebas Neue',
  oswald: 'Oswald',
  archivo: 'Archivo Black',
  alfa: 'Alfa Slab One',
  marcellus: 'Marcellus SC',
  cinzel: 'Cinzel',
  playfair: 'Playfair Display',
  garamond: 'EB Garamond',
  spectral: 'Spectral',
  body: 'Roboto Condensed',
  cabin: 'Cabin',
  jost: 'Jost',
  spacemono: 'Space Mono',
  caveat: 'Caveat',
};

export const FONT_VARS: Record<string, string> = {
  display: 'var(--font-display), Impact, sans-serif',
  oswald: 'var(--font-oswald), Impact, sans-serif',
  archivo: 'var(--font-archivo), Impact, sans-serif',
  alfa: 'var(--font-alfa), Georgia, serif',
  marcellus: 'var(--font-marcellus), Georgia, serif',
  cinzel: 'var(--font-cinzel), Georgia, serif',
  playfair: 'var(--font-playfair), Georgia, serif',
  garamond: 'var(--font-garamond), Georgia, serif',
  spectral: 'var(--font-spectral), Georgia, serif',
  body: 'var(--font-body), system-ui, sans-serif',
  cabin: 'var(--font-cabin), system-ui, sans-serif',
  jost: 'var(--font-jost), system-ui, sans-serif',
  spacemono: 'var(--font-spacemono), ui-monospace, monospace',
  caveat: 'var(--font-caveat), cursive',
};

export function fontStack(key: string | undefined): string {
  return FONT_VARS[key || 'display'] ?? FONT_VARS['display']!;
}
