import { getTheme } from '@miscellary/shared';
import type { ThemeColors } from '@miscellary/shared';
import { StyleSheet } from 'react-native';
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
