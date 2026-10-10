import type { SupporterTier } from '@miscellary/shared';
import { EMBLEM_ART, EMBLEM_STAR, SUPPORTER_TIERS } from '@miscellary/shared';
import styles from './SupporterEmblem.module.css';

/** Drawn once in the root layout; every emblem on the page points at these symbols. */
export function EmblemSprite() {
  return (
    <svg width="0" height="0" className={styles.sprite} aria-hidden="true">
      <defs>
        <linearGradient id="emblem-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {SUPPORTER_TIERS.map(({ id }) => {
          const art = EMBLEM_ART[id];
          const frame = art.star === '#ffffff' ? '#ffffff' : art.edge;
          return (
            <g key={id}>
              <linearGradient id={`emblem-fill-${id}`} x1="0" y1="0" x2="1" y2="1">
                {art.stops.map((colour, index) => (
                  <stop key={index} offset={index / (art.stops.length - 1)} stopColor={colour} />
                ))}
              </linearGradient>
              <symbol id={`emblem-${id}`} viewBox="0 0 26 34">
                <g transform="rotate(-8 13 17)">
                  <rect
                    x="3"
                    y="2"
                    width="20"
                    height="30"
                    rx="3"
                    fill={`url(#emblem-fill-${id})`}
                    stroke={art.edge}
                  />
                  {art.frame > 0 && (
                    <rect
                      x="5.5"
                      y="4.5"
                      width="15"
                      height="25"
                      rx="1.8"
                      fill="none"
                      stroke={frame}
                      strokeOpacity={art.frame}
                    />
                  )}
                  <path d={EMBLEM_STAR} transform="translate(13 16.5) scale(4.4)" fill={art.star} />
                  {art.sparkle && (
                    <>
                      <circle cx="7.6" cy="27.4" r="1" fill={art.star} />
                      <circle cx="18.4" cy="6.6" r="1" fill={art.star} />
                    </>
                  )}
                  {art.shine > 0 && (
                    <rect
                      x="3"
                      y="2"
                      width="20"
                      height="30"
                      rx="3"
                      fill="url(#emblem-shine)"
                      opacity={art.shine}
                    />
                  )}
                </g>
              </symbol>
            </g>
          );
        })}
      </defs>
    </svg>
  );
}

export default function SupporterEmblem({
  tier,
  months,
  large = false,
}: {
  tier: SupporterTier | null | undefined;
  months?: number | undefined;
  large?: boolean;
}) {
  if (!tier) return null;
  const label = SUPPORTER_TIERS.find((item) => item.id === tier)?.label ?? 'Common';
  const said = months
    ? `Supporter for ${months} ${months === 1 ? 'month' : 'months'}, ${label} emblem`
    : `Supporter, ${label} emblem`;
  return (
    <svg
      className={`${styles.emblem} ${large ? styles.large : ''}`}
      viewBox="0 0 26 34"
      role="img"
      aria-label={said}
    >
      <title>{said}</title>
      <use href={`#emblem-${tier}`} />
    </svg>
  );
}
