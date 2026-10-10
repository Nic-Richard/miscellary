import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useMembership } from '@/lib/membership';
import { createThemedStyles, fonts } from '@/lib/theme';
import { Button } from './ui';

/** Explains a supporter feature where it would be used, while memberships are on. */
export default function SupporterPrompt({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const { enabled, supporter } = useMembership();
  if (!enabled || supporter) return null;
  return (
    <View style={styles.prompt}>
      <Text style={styles.text}>{children}</Text>
      <Button title="Become a supporter" onPress={() => router.push('/membership')} />
    </View>
  );
}

export function SupporterTag() {
  const styles = useStyles();
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>SUPPORTER</Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  prompt: {
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.sur2,
  },
  text: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  tag: {
    alignSelf: 'center',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: '#c9a24a',
  },
  tagText: { color: '#3a2a0c', fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1 },
}));
