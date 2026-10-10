import { useId } from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import type { BadgeStyle } from '@miscellary/shared';
import { BADGE_METALS, splitBadge } from '@miscellary/shared';
import { fonts } from '@/lib/theme';
import { STAR_PATH, metalStops } from './Avatar';

const HEIGHT = 26;
const WIDTH = 116;

/** A ticket-cut foil ribbon in the supporter's chosen metal and finish. */
export default function SupporterBadge({
  badge = 'gold-foil',
}: {
  badge?: BadgeStyle | undefined;
}) {
  const id = `ribbon${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const style = badge ?? 'gold-foil';
  const stops = metalStops(style);
  const ink = BADGE_METALS[splitBadge(style)?.colour ?? 'gold']?.ink ?? '#3a2a0c';
  return (
    <View
      accessible
      accessibilityLabel="Supporter"
      style={{ width: WIDTH, height: HEIGHT, alignSelf: 'flex-start' }}
    >
      <Svg width={WIDTH} height={HEIGHT} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.4">
            {stops.map((colour, index) => (
              <Stop key={index} offset={index / (stops.length - 1)} stopColor={colour} />
            ))}
          </LinearGradient>
        </Defs>
        <Path
          d={`M0 0H${WIDTH}L${WIDTH - 8} ${HEIGHT / 2}L${WIDTH} ${HEIGHT}H0Z`}
          fill={`url(#${id})`}
        />
      </Svg>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 9,
        }}
      >
        <Svg width={13} height={13} viewBox="0 0 24 24">
          <Path d={STAR_PATH} fill={ink} />
        </Svg>
        <Text style={{ color: ink, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.4 }}>
          SUPPORTER
        </Text>
      </View>
    </View>
  );
}
