import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { createThemedStyles, fonts, useColors } from '@/lib/theme';
import { STAR_PATH } from './Avatar';

export default function SupporterBadge() {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.badge}>
      <View style={styles.star}>
        <Svg width={12} height={12} viewBox="0 0 24 24">
          <Path d={STAR_PATH} fill={colors.sur} />
        </Svg>
      </View>
      <Text style={styles.label}>Supporter</Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingVertical: 3,
    paddingLeft: 4,
    paddingRight: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.sur,
  },
  star: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  label: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
}));
