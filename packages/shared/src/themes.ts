export const DEFAULT_THEME = 'stone-navy';
export const THEME_STORAGE_KEY = 'miscellary-theme';
export const THEME_GROUPS = ['Light', 'Muted', 'Darker', 'Dark'] as const;

const palettes = [
  {
    id: 'white-charcoal',
    name: 'White / charcoal',
    number: 4,
    group: 'Light',
    bg: '#ededeb',
    sur: '#fafaf8',
    nav: '#e0e2df',
    accent: '#424c46',
    text: '#372e25',
  },
  {
    id: 'grey-forest',
    name: 'Grey / forest',
    number: 7,
    group: 'Light',
    bg: '#e9ebe7',
    sur: '#f7f8f4',
    nav: '#dce0d8',
    accent: '#386345',
    text: '#372e25',
  },
  {
    id: 'grey-plum',
    name: 'Grey / plum',
    number: 9,
    group: 'Light',
    bg: '#ebeae8',
    sur: '#f8f7f5',
    nav: '#e0dddb',
    accent: '#795269',
    text: '#372e25',
  },
  {
    id: 'cream-teal',
    name: 'Cream / teal',
    number: 50,
    group: 'Light',
    bg: '#f4eee1',
    sur: '#f9f4ea',
    nav: '#e9e1d1',
    accent: '#278b82',
    text: '#372e25',
  },
  {
    id: 'fog-forest',
    name: 'Fog / forest',
    number: 28,
    group: 'Muted',
    bg: '#cbd0ca',
    sur: '#e1e3db',
    nav: '#9cac9e',
    accent: '#3e604d',
    text: '#333d34',
  },
  {
    id: 'mushroom-ink',
    name: 'Mushroom / ink',
    number: 29,
    group: 'Muted',
    bg: '#c9c4bd',
    sur: '#e1dbd2',
    nav: '#aaa69f',
    accent: '#405c70',
    text: '#34393d',
  },
  {
    id: 'pewter-ochre',
    name: 'Pewter / ochre',
    number: 31,
    group: 'Muted',
    bg: '#bfc5c6',
    sur: '#d9dedb',
    nav: '#455458',
    accent: '#85652c',
    text: '#303b3e',
  },
  {
    id: 'dove-aubergine',
    name: 'Dove / aubergine',
    number: 45,
    group: 'Muted',
    bg: '#c9c5c7',
    sur: '#e2dddd',
    nav: '#50424e',
    accent: '#704c66',
    text: '#3b343a',
  },
  {
    id: DEFAULT_THEME,
    name: 'Stone / navy',
    number: 46,
    group: 'Muted',
    bg: '#c3c3bb',
    sur: '#dfded4',
    nav: '#414e63',
    accent: '#3e5976',
    text: '#333b42',
  },
  {
    id: 'ash-olive',
    name: 'Ash / olive',
    number: 48,
    group: 'Muted',
    bg: '#b8bdb5',
    sur: '#d7ddcf',
    nav: '#515b4b',
    accent: '#586a3f',
    text: '#333d30',
  },
  {
    id: 'graphite-teal',
    name: 'Graphite / teal',
    number: 24,
    group: 'Darker',
    bg: '#6b7275',
    sur: '#b8bebd',
    nav: '#363e43',
    accent: '#265b60',
    text: '#283237',
  },
  {
    id: 'blue-graphite-gold',
    name: 'Blue graphite / gold',
    number: 39,
    group: 'Darker',
    bg: '#69717c',
    sur: '#cbd2dc',
    nav: '#354451',
    accent: '#795d2e',
    text: '#2d3740',
  },
  {
    id: 'ink-copper',
    name: 'Ink / copper',
    number: 2,
    group: 'Dark',
    bg: '#22272e',
    sur: '#2e353e',
    nav: '#191e24',
    accent: '#d6a171',
    text: '#f2f0e9',
  },
] as const;

function channels(hex: string): number[] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function mix(first: string, second: string, weight: number): string {
  const other = channels(second);
  return (
    '#' +
    channels(first)
      .map((value, index) =>
        Math.round(value * (1 - weight) + other[index]! * weight)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

function luminance(hex: string): number {
  const rgb = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}

export function contrast(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function ink(background: string, preferred: string): string {
  return (
    [preferred, '#f3f5f2', '#ffffff', '#1b2022', '#000000'].find(
      (color) => contrast(color, background) >= 4.5,
    ) ?? '#1b2022'
  );
}

function readable(background: string, color: string): string {
  const target = luminance(background) > 0.18 ? '#000000' : '#ffffff';
  for (let step = 0; step <= 10; step++) {
    const candidate = mix(color, target, step / 10);
    if (contrast(candidate, background) >= 4.5) return candidate;
  }
  return ink(background, color);
}

export const THEMES = palettes.map((palette) => {
  const { bg, sur, nav, accent, text } = palette;
  const accentText = ink(accent, '#f3f5f2');
  const navInk = ink(nav, text);
  const muted = readable(sur, mix(text, sur, 0.16));
  const pageText = ink(bg, text);
  const pageMuted = ink(bg, mix(pageText, bg, 0.16));
  const navHover = mix(nav, navInk, 0.1);
  const navActive = mix(nav, navInk, 0.16);
  const colors = {
    bg,
    sur,
    sur2: mix(sur, bg, 0.45),
    text,
    pageText,
    pageMuted,
    pageAccent: readable(bg, accent),
    muted,
    faint: readable(sur, mix(text, sur, 0.23)),
    bdr: mix(sur, text, 0.24),
    bdr2: mix(sur, text, 0.37),
    accent,
    accentDeep: palette.number === 2 ? accent : mix(accent, '#10191c', 0.18),
    accentText,
    accentInk: readable(sur, accent),
    revealBg: mix(accent, '#10191c', 0.7),
    danger: readable(sur, '#923d32'),
    gold: readable(sur, '#795a22'),
    green: readable(sur, '#32614d'),
    cloth: accent,
    nav,
    navInk: ink(navActive, navInk),
    navMuted: ink(nav, mix(navInk, nav, 0.16)),
    navBorder: mix(nav, navInk, 0.24),
    navHover,
    navActive,
  };
  const css = {
    '--bg': bg,
    '--sur': sur,
    '--sur2': colors.sur2,
    '--text': text,
    '--panel-text': text,
    '--panel-muted': muted,
    '--panel-faint': colors.faint,
    '--panel-accent': colors.accentInk,
    '--panel-accent-deep': colors.accentDeep,
    '--page-text': pageText,
    '--page-muted': pageMuted,
    '--page-accent': colors.pageAccent,
    '--muted': muted,
    '--faint': colors.faint,
    '--bdr': colors.bdr,
    '--bdr2': colors.bdr2,
    '--accent': accent,
    '--accent-ink': colors.accentInk,
    '--accent-deep': colors.accentDeep,
    '--accent-text': accentText,
    '--accent-rgb': channels(accent).join(', '),
    '--reveal-bg': colors.revealBg,
    '--cloth': mix(accent, sur, 0.25),
    '--cloth-deep': accent,
    '--cloth-ink': accentText,
    '--gold': colors.gold,
    '--danger': colors.danger,
    '--rail': nav,
    '--rail-edge': colors.navBorder,
    '--nav-ink': colors.navInk,
    '--nav-muted': colors.navMuted,
    '--nav-hover': colors.navHover,
    '--nav-active': colors.navActive,
  };
  return { ...palette, colors, css };
});

export type Theme = (typeof THEMES)[number];
export type ThemeColors = Theme['colors'];

export function getTheme(id?: string | null): Theme {
  return (
    THEMES.find((theme) => theme.id === id) ?? THEMES.find((theme) => theme.id === DEFAULT_THEME)!
  );
}
