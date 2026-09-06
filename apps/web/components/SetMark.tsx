const MARKS: Record<string, [string, string?]> = {
  waves: [
    'M8.5 11.5a3.5 3.5 0 0 1 7 0M12 6.1V3.9M8.18 7.68 6.63 6.13M15.82 7.68 17.37 6.13M4.4 11.5h2.2M17.4 11.5h2.2',
    'M3 16c2.5-2.5 4.5 2.5 7 0s4.5 2.5 7 0 4.5 2.5 4 0M3 20c2.5-2.5 4.5 2.5 7 0s4.5 2.5 7 0',
  ],
  leaf: ['M5 19C5 11 10 5 19 5c0 9-6 14-14 14Z', 'M9 15c2-3 5-5 8-6'],
  peaks: ['M2 19h20L15 6l-4 7-2-3-7 9Z', 'M15 6v13'],
  crystal: ['M12 3 4 9l8 12 8-12-8-6Z', 'M12 3v18M4 9h16'],
  record: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    'M12 11.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2Z',
  ],
  feather: ['M20 4C11 4 5 10 5 19l3-3c8 0 12-5 12-12Z', 'M8 16 13.5 10.5'],
  star: ['M12 2l2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6L12 2Z'],
  shell: ['M12 21a9 9 0 1 0-9-9 6 6 0 0 0 12 0 3 3 0 0 0-6 0'],
  bolt: ['M13 2 5 13h5l-1 9 8-11h-5l1-9Z'],
  moon: ['M20 14A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20 14Z', 'M17 4.5v3M15.5 6h3'],
  flame: [
    'M12 22c4 0 6-2.7 6-6 0-4.5-6-9-6-14C9 6 6 8 6 12c0 3.3 2 6 6 10Z',
    'M12 22c-2 0-3-1.4-3-3s1.4-3 3-4c1.6 1 3 2.4 3 4s-1 3-3 3Z',
  ],
  drop: ['M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11Z', 'M9 15a3 3 0 0 0 3 3'],
  key: [
    'M3.22 19.22 4.78 20.78 5.91 19.65 6.97 20.71 8.1 19.58 7.04 18.52 8.03 17.53 8.81 18.31 9.8 17.32 9.02 16.54 14.73 10.82a3.8 3.8 0 0 1-1.56-1.55Z',
    'M16.5 3.7a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z',
  ],
  bloom: [
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 9V4M12 15v5M9 12H4M15 12h5',
    'M9.88 9.88 6.34 6.34M14.12 9.88 17.66 6.34M9.88 14.12 6.34 17.66M14.12 14.12 17.66 17.66',
  ],
  orbit: [
    'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z',
    'M4.6 15.6c-1.6 1.9-2.2 3.6-1.4 4.5 1.3 1.5 6-.4 10.4-4.2s6.9-8.1 5.6-9.6c-.8-.9-2.6-.5-4.7.8',
  ],
  arrowhead: ['M12 3 5 21l7-4 7 4-7-18Z', 'M12 3v14'],
};

/** The raw paths behind a mark, for drawing it somewhere an <svg> cannot go,
 *  such as inside a <pattern>. */
export function markPaths(mark: string): string[] {
  if (mark === 'none') return [];
  const [main, extra] = MARKS[mark] ?? MARKS['waves']!;
  return extra ? [main, extra] : [main];
}

export default function SetMark({
  mark = 'waves',
  className,
  style,
}: {
  mark?: string;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
}) {
  if (mark === 'none') return null;
  const [main, extra] = MARKS[mark] ?? MARKS['waves']!;
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      <path d={main} />
      {extra ? <path d={extra} /> : null}
    </svg>
  );
}
