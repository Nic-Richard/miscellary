import { useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { SupporterTier } from '@miscellary/shared';
import { EMBLEM_ART, EMBLEM_STAR, SUPPORTER_TIERS } from '@miscellary/shared';

export default function SupporterEmblem({
  tier,
  months,
  size = 15,
}: {
  tier: SupporterTier | null | undefined;
  months?: number | undefined;
  size?: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (!tier) return null;
  const art = EMBLEM_ART[tier];
  const frame = art.star === '#ffffff' ? '#ffffff' : art.edge;
  const label = SUPPORTER_TIERS.find((item) => item.id === tier)?.label ?? 'Common';
  return (
    <Svg
      width={(size * 26) / 34}
      height={size}
      viewBox="0 0 26 34"
      accessible
      accessibilityLabel={
        months
          ? `Supporter for ${months} ${months === 1 ? 'month' : 'months'}, ${label} emblem`
          : `Supporter, ${label} emblem`
      }
    >
      <Defs>
        <LinearGradient id={`fill${id}`} x1="0" y1="0" x2="1" y2="1">
          {art.stops.map((colour, index) => (
            <Stop key={index} offset={index / (art.stops.length - 1)} stopColor={colour} />
          ))}
        </LinearGradient>
        <LinearGradient id={`shine${id}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#fff" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#fff" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#fff" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <G rotation={-8} origin="13, 17">
        <Rect
          x={3}
          y={2}
          width={20}
          height={30}
          rx={3}
          fill={`url(#fill${id})`}
          stroke={art.edge}
        />
        {art.frame > 0 && (
          <Rect
            x={5.5}
            y={4.5}
            width={15}
            height={25}
            rx={1.8}
            fill="none"
            stroke={frame}
            strokeOpacity={art.frame}
          />
        )}
        <Path d={EMBLEM_STAR} transform="translate(13 16.5) scale(4.4)" fill={art.star} />
        {art.sparkle && (
          <>
            <Circle cx={7.6} cy={27.4} r={1} fill={art.star} />
            <Circle cx={18.4} cy={6.6} r={1} fill={art.star} />
          </>
        )}
        {art.shine > 0 && (
          <Rect
            x={3}
            y={2}
            width={20}
            height={30}
            rx={3}
            fill={`url(#shine${id})`}
            opacity={art.shine}
          />
        )}
      </G>
    </Svg>
  );
}
