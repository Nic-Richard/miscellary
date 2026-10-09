import { Text } from 'react-native';
import { fonts, createThemedStyles } from '@/lib/theme';

export default function DemoBadge() {
  const styles = useStyles();
  return (
    <Text style={styles.badge} accessible accessibilityLabel="Demo account">
      {'\u{1F916} '}
      <Text style={styles.text}>Demo</Text>
    </Text>
  );
}

const useStyles = createThemedStyles((colors) => ({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    backgroundColor: colors.sur,
  },
  text: {
    color: colors.accent,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
}));
