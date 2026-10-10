import { Image, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Creator } from '@miscellary/shared';
import { fonts, useColors } from '@/lib/theme';

export const STAR_PATH = 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z';
const RING = 3;

export default function Avatar({
  person,
  supporter = false,
  size = 28,
}: {
  person: Creator | null;
  supporter?: boolean;
  size?: number;
}) {
  const colors = useColors();
  const name = person?.display_name || person?.username || '';
  const star = Math.max(12, Math.round(size * 0.38));
  const face = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.bdr2,
        backgroundColor: colors.sur2,
      }}
    >
      {person?.avatar_url ? (
        <Image source={{ uri: person.avatar_url }} style={{ width: size, height: size }} />
      ) : (
        <Text
          style={{
            color: colors.accentInk,
            fontFamily: fonts.medium,
            fontSize: Math.round(size * 0.44),
          }}
        >
          {name.charAt(0).toUpperCase() || '?'}
        </Text>
      )}
    </View>
  );
  if (!supporter) return <View importantForAccessibility="no-hide-descendants">{face}</View>;
  // The ring sits outside the avatar's own size, so supporters don't shift the layout.
  return (
    <View
      accessible
      accessibilityLabel={`${name}, supporter`}
      style={{
        width: size + RING * 2,
        height: size + RING * 2,
        margin: -RING,
        padding: RING - 1.5,
        borderRadius: size / 2 + RING,
        borderWidth: 1.5,
        borderColor: colors.gold,
      }}
    >
      {face}
      <View
        style={{
          position: 'absolute',
          right: -2,
          bottom: -2,
          width: star,
          height: star,
          borderRadius: star / 2,
          borderWidth: 1.5,
          borderColor: colors.sur,
          backgroundColor: colors.gold,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={star * 0.62} height={star * 0.62} viewBox="0 0 24 24">
          <Path d={STAR_PATH} fill={colors.sur} />
        </Svg>
      </View>
    </View>
  );
}
