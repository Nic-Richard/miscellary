import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { createThemedStyles, fonts, useColors } from '@/lib/theme';

const ICONS = {
  followers:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.5 2.5-5.5 6-5.5s6 2 6 5.5M16 4.5a3 3 0 0 1 0 6M18 14c2 .5 3 2 3 4.5',
  following:
    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c0-4 3-6.5 7-6.5s7 2.5 7 6.5M16 9l1.5 1.5L21 7',
  sets: 'M4 5.5h6a2 2 0 0 1 2 2V19a2 2 0 0 0-2-2H4Zm16 0h-6a2 2 0 0 0-2 2V19a2 2 0 0 1 2-2h6Z',
  cards: 'M7 4h10v16H7ZM4 7h1v10H4Zm15 0h1v10h-1ZM10 8h4M10 11h4',
};

export interface Stat {
  icon: keyof typeof ICONS;
  value: number;
  label: string;
  onPress?: () => void;
  expanded?: boolean;
}

/** A collector's counts as icon rows, two to a line, as on the website's profile. */
export default function StatRows({ stats }: { stats: Stat[] }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.stats}>
      {stats.map((stat) => {
        const row = (
          <>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path
                d={ICONS[stat.icon]}
                fill="none"
                stroke={colors.muted}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.value}>{stat.value}</Text>
            <Text style={styles.label}>{stat.label}</Text>
          </>
        );
        return stat.onPress ? (
          <Pressable
            key={stat.icon}
            accessibilityRole="button"
            accessibilityState={{ expanded: stat.expanded }}
            onPress={stat.onPress}
            style={({ pressed }) => [styles.stat, pressed && { opacity: 0.7 }]}
          >
            {row}
          </Pressable>
        ) : (
          <View key={stat.icon} style={styles.stat}>
            {row}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  stat: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  label: { flexShrink: 1, color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
}));
