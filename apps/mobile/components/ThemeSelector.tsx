import { DEFAULT_THEME, THEMES, getTheme } from '@miscellary/shared';
import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useColors, fonts, createThemedStyles } from '@/lib/theme';
import ChoiceSheet from './ChoiceSheet';
import { ErrorText } from './ui';

export default function ThemeSelector() {
  const { user, updateTheme } = useAuth();
  const colors = useColors();
  const styles = useStyles();
  const theme = getTheme(user?.theme);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  async function choose(theme: string) {
    if (busy) return;
    setOpen(false);
    if (theme === getTheme(user?.theme).id) return;
    setBusy(true);
    setError(null);
    try {
      await updateTheme(theme);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your theme.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.text, fontFamily: fonts.body }}>Colour theme</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Colour theme: ${theme.name}`}
        accessibilityState={{ disabled: busy, expanded: open }}
        disabled={busy}
        style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.7 }]}
        onPress={() => setOpen(true)}
      >
        <View
          style={styles.swatches}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {[theme.bg, theme.sur, theme.accent].map((color, index) => (
            <View key={index} style={{ backgroundColor: color, width: 12, height: 24 }} />
          ))}
        </View>
        <Text style={styles.name}>{theme.name}</Text>
        <Feather name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      {busy && (
        <Text accessibilityRole="alert" style={{ color: colors.muted }}>
          Saving…
        </Text>
      )}
      <ErrorText>{error}</ErrorText>
      <ChoiceSheet
        visible={open}
        title="Colour theme"
        choices={THEMES.map((theme) => ({
          label: theme.name,
          value: theme.id,
          group: theme.group,
          swatches: [theme.bg, theme.sur, theme.accent],
          selected: theme.id === getTheme(user.theme).id,
          ...(theme.id === DEFAULT_THEME ? { note: 'Default' } : {}),
          icon: theme.id === getTheme(user.theme).id ? 'check' : 'circle',
        }))}
        onClose={() => setOpen(false)}
        onChoose={(value) => void choose(value)}
      />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.bdr2,
    backgroundColor: colors.sur,
  },
  swatches: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.bdr2,
  },
  name: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
}));
