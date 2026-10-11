import { getTheme } from '@miscellary/shared';
import type { ThemeColors } from '@miscellary/shared';
import { StyleSheet } from 'react-native';
// The website serves the same file from its public folder.
import clothTexture from '../../web/public/materials/cloth.jpg';
import paperTexture from '../../web/public/materials/tex-paper.png';
import { useAuth } from './auth';

export const colors = getTheme().colors;

export function useColors(): ThemeColors {
  const { user } = useAuth();
  return getTheme(user?.theme).colors;
}

export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (palette: ThemeColors) => T,
): () => T {
  const cache = new WeakMap<ThemeColors, T>();
  return function useStyles() {
    const palette = useColors();
    let styles = cache.get(palette);
    if (!styles) {
      styles = StyleSheet.create(factory(palette));
      cache.set(palette, styles);
    }
    return styles;
  };
}

/** The website's shadows, scaled for dark themes the same way its CSS variables are. */
export function shadows(palette: ThemeColors) {
  const shade = (alpha: number) =>
    `rgba(${palette.shadowRgb}, ${Math.min(1, alpha * palette.shadowBoost)})`;
  return {
    sm: `0px 1px 2px ${shade(0.14)}`,
    md: `0px 1px 1px ${shade(0.1)}, 0px 6px 16px -6px ${shade(0.3)}`,
    sheet: `inset 0px 1px 0px ${palette.edgeLight}, 0px 1px 2px ${shade(0.1)}, 0px 14px 30px ${shade(0.12)}`,
    lift: `inset 0px 1px 0px ${palette.edgeLight}, 0px 1px 1px ${shade(0.1)}, 0px 6px 16px -6px ${shade(0.3)}`,
    inset: `inset 0px 1px 2px ${shade(0.12)}`,
  };
}

export { clothTexture, paperTexture };

export const fonts = {
  display: 'BebasNeue',
  body: 'RobotoCondensed',
  medium: 'RobotoCondensed-SemiBold',
};

export const binderColors: Record<string, string> = {
  teal: '#6c948e',
  moss: '#7b8a60',
  forest: '#426a52',
  ocean: '#557e91',
  indigo: '#596181',
  plum: '#806279',
  oxblood: '#784b4c',
  rust: '#a46a4b',
  tan: '#b29469',
  sand: '#c3b18d',
  slate: '#788485',
  charcoal: '#505955',
};

export const rarityColors: Record<string, string> = {
  common: '#7a8085',
  uncommon: '#3f6ea8',
  rare: '#7b5fa3',
  epic: '#c0568c',
  legendary: '#c9a24a',
};
