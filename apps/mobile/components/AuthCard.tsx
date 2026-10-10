import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { createThemedStyles, fonts } from '@/lib/theme';

export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <View style={styles.head}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {children}
      </View>
    </ScrollView>
  );
}

export function OrDivider({ label }: { label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.or}>
      <View style={styles.line} />
      <Text style={styles.orText}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

export const useAuthStyles = createThemedStyles((colors) => ({
  link: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 15 },
  note: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  fieldError: { color: colors.danger, fontFamily: fonts.body, fontSize: 14 },
  footer: { alignItems: 'center', gap: 14, paddingTop: 4 },
}));

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingTop: 24, paddingBottom: 40 },
  card: {
    gap: 12,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  head: { gap: 2, marginBottom: 6 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 34, lineHeight: 36 },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 16 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  line: { flex: 1, height: 1, backgroundColor: colors.bdr },
  orText: { color: colors.faint, fontFamily: fonts.body, fontSize: 14 },
}));
