import { SET_MARK_PATHS as MARKS } from '@miscellary/shared';

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
