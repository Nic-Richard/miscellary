import { SITE_URL } from '@miscellary/shared';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, Share, StyleSheet, Text } from 'react-native';
import { colors } from '@/lib/theme';

const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? SITE_URL;

export default function ShareButton({
  path,
  title,
  dark = false,
}: {
  path: string;
  title: string;
  dark?: boolean;
}) {
  const url = `${SITE}${path}`;
  const tint = dark ? '#f7f1e3' : colors.muted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Share ${title}`}
      onPress={() => void Share.share({ title, message: url, url }).catch(() => undefined)}
      style={({ pressed }) => [styles.button, dark && styles.dark, pressed && { opacity: 0.7 }]}
    >
      <Feather name="share" size={14} color={tint} />
      <Text style={{ color: tint, fontSize: 13 }}>Share</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  dark: { borderColor: 'rgba(247, 241, 227, 0.32)', backgroundColor: 'rgba(247, 241, 227, 0.08)' },
});
