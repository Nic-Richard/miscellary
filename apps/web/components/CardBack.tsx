import { useId } from 'react';
import { markPaths } from './SetMark';
import { packStyle, resolveMark } from '@/lib/setIdentity';
import styles from './CardBack.module.css';

export default function CardBack({
  mark,
  packColour,
  title,
}: {
  mark?: string | undefined;
  packColour?: string | undefined;
  title?: string | undefined;
}) {
  const id = useId().replace(/:/g, '');
  const chosen = resolveMark(mark);
  const paths = markPaths(chosen);
  const hasMark = paths.length > 0;

  return (
    <div className={styles.back} style={packStyle(packColour)} aria-hidden="true">
      <span className={styles.field} />
      <span className={styles.stock} />

      <svg className={styles.art} viewBox="0 0 100 140">
        <defs>
          <pattern
            id={`${id}-tile`}
            width={hasMark ? 17 : 13}
            height={hasMark ? 17 : 13}
            patternUnits="userSpaceOnUse"
            patternTransform={hasMark ? 'rotate(22)' : 'rotate(45)'}
          >
            {hasMark ? (
              <g transform="scale(0.3)" className={styles.tile}>
                {paths.map((d) => (
                  <path key={d} d={d} />
                ))}
              </g>
            ) : (
              <g className={styles.lattice}>
                <path d="M6.5 2.6l3.9 3.9l-3.9 3.9l-3.9-3.9Z" />
              </g>
            )}
          </pattern>
          <radialGradient id={`${id}-pool`}>
            <stop offset="0%" stopColor="rgba(226, 196, 116, 0.22)" />
            <stop offset="100%" stopColor="rgba(226, 196, 116, 0)" />
          </radialGradient>
        </defs>

        <rect
          x="0"
          y="0"
          width="100"
          height="140"
          fill={`url(#${id}-tile)`}
          opacity={hasMark ? 0.5 : 0.55}
        />
        <rect x="0" y="0" width="100" height="140" fill={`url(#${id}-pool)`} />

        <g className={styles.rule}>
          <rect x="5" y="5" width="90" height="130" rx="4" strokeWidth="1.1" />
          <rect x="8.5" y="8.5" width="83" height="123" rx="2.5" strokeWidth="0.5" />
          {[
            [8.5, 8.5],
            [91.5, 8.5],
            [8.5, 131.5],
            [91.5, 131.5],
          ].map(([x, y]) => (
            <path key={`${x}-${y}`} d={`M${x! - 2} ${y!}l2 -2l2 2l-2 2Z`} className={styles.pip} />
          ))}
        </g>

        <g className={styles.rule}>
          <circle cx="50" cy="63" r="27" strokeWidth="0.9" />
          <circle cx="50" cy="63" r="23.5" strokeWidth="0.45" />
        </g>

        {hasMark ? (
          <g className={styles.mark} transform="translate(50 63) scale(1.55) translate(-12 -12)">
            {paths.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        ) : (
          <g className={styles.mark} transform="translate(50 63) scale(0.72) translate(-32 -24)">
            <rect x="10" y="10" width="20" height="30" rx="2.5" transform="rotate(-16 20 25)" />
            <rect x="34" y="10" width="20" height="30" rx="2.5" transform="rotate(16 44 25)" />
            <rect x="22" y="6" width="20" height="32" rx="2.5" />
            <path
              d="m32 15 1.9 4 4.3.5-3.2 2.9.9 4.3-3.9-2.2-3.9 2.2.9-4.3-3.2-2.9 4.3-.5Z"
              className={styles.star}
            />
          </g>
        )}

        {title ? (
          <text x="50" y="115" className={styles.title}>
            {title.length > 22 ? `${title.slice(0, 21)}…` : title}
          </text>
        ) : null}
        <text x="50" y="124.5" className={styles.brand}>
          MISCELLARY
        </text>
      </svg>
    </div>
  );
}
