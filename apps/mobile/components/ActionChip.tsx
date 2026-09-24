import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '@/lib/theme';

export default function ActionChip({
  icon,
  label,
  count,
  tone = 'plain',
  dark = false,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label?: string;
  count?: number;
  tone?: 'plain' | 'on' | 'liked';
  dark?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const tint =
    tone === 'liked'
      ? dark
        ? '#f3b3a6'
        : colors.danger
      : tone === 'on'
        ? colors.accent
        : dark
          ? '#f7f1e3'
          : colors.muted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: tone !== 'plain', disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        dark && styles.dark,
        tone === 'on' && styles.on,
        tone === 'liked' && (dark ? styles.likedDark : styles.liked),
        (pressed || disabled) && { opacity: 0.7 },
      ]}
    >
      <Feather name={icon} size={15} color={tint} />
      {label ? <Text style={[styles.text, { color: tint }]}>{label}</Text> : null}
      {count !== undefined ? <Text style={[styles.count, { color: tint }]}>{count}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 6,
  },
  on: { borderColor: colors.accent, backgroundColor: 'rgba(30,110,103,0.09)' },
  liked: { borderColor: '#d3a89f', backgroundColor: 'rgba(174,74,58,0.08)' },
  dark: { borderColor: 'rgba(247, 241, 227, 0.32)', backgroundColor: 'rgba(247, 241, 227, 0.08)' },
  likedDark: { borderColor: 'rgba(240, 165, 151, 0.6)' },
  text: { fontFamily: fonts.medium, fontSize: 15 },
  count: { fontFamily: fonts.medium, fontSize: 15 },
});
