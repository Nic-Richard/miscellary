import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BadgeStyle, Creator } from '@miscellary/shared';
import { BADGE_METALS, HOLO_STOPS, splitBadge } from '@miscellary/shared';
import { fonts, useColors } from '@/lib/theme';

export const STAR_PATH = 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z';
const FOIL = 2.5;
const GAP = 1.5;

/** Gradient stops for a badge metal and finish, approximating the website's foil. */
export function metalStops(badge: BadgeStyle): readonly [string, string, ...string[]] {
  const metal = splitBadge(badge) ?? splitBadge('gold-foil')!;
  const tone = BADGE_METALS[metal.colour] ?? BADGE_METALS.gold!;
  if (metal.finish === 'holo') return [tone.mid, HOLO_STOPS[0]!, ...HOLO_STOPS.slice(1), tone.mid];
  if (metal.finish === 'satin') return [tone.hi, tone.mid, tone.mid, tone.lo] as const;
  return [tone.lo, tone.mid, tone.hi, tone.mid, tone.lo, tone.hi, tone.mid] as const;
}

export default function Avatar({
  person,
  badge = null,
  size = 28,
}: {
  person: Creator | null;
  badge?: BadgeStyle | undefined;
  size?: number;
}) {
  const colors = useColors();
  const name = person?.display_name || person?.username || '';
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
  if (!badge) return <View importantForAccessibility="no-hide-descendants">{face}</View>;
  const outer = FOIL + GAP;
  // The foil ring sits outside the avatar's own size, so supporters don't shift the layout.
  return (
    <LinearGradient
      accessible
      accessibilityLabel={`${name}, supporter`}
      colors={metalStops(badge)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size + outer * 2,
        height: size + outer * 2,
        margin: -outer,
        padding: FOIL,
        borderRadius: size / 2 + outer,
      }}
    >
      <View style={{ padding: GAP, borderRadius: size / 2 + GAP, backgroundColor: colors.sur }}>
        {face}
      </View>
    </LinearGradient>
  );
}
