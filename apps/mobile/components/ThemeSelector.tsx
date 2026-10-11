import { DEFAULT_THEME, THEMES, getTheme } from '@miscellary/shared';
import Feather from '@expo/vector-icons/Feather';
import { Fragment, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { createThemedStyles, fonts } from '@/lib/theme';
import { ErrorText } from './ui';

/** Every colour theme as a swatch, grouped like the website's theme menu. */
export default function ThemeSelector() {
  const { user, updateTheme } = useAuth();
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const current = getTheme(user.theme).id;

  async function choose(id: string) {
    if (busy || id === current) return;
    setBusy(true);
    setError(null);
    try {
      await updateTheme(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your theme.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root} accessibilityRole="radiogroup" accessibilityLabel="Colour theme">
      {THEMES.map((theme, index) => (
        <Fragment key={theme.id}>
          {theme.group !== THEMES[index - 1]?.group && (
            <Text accessibilityRole="header" style={styles.group}>
              {theme.group}
            </Text>
          )}
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel={theme.id === DEFAULT_THEME ? `${theme.name}, default` : theme.name}
            accessibilityState={{ checked: theme.id === current, disabled: busy }}
            disabled={busy}
            onPress={() => void choose(theme.id)}
            style={({ pressed }) => [
              styles.swatch,
              theme.id === current && styles.on,
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={styles.colours}>
              <View style={[styles.colour, { flex: 3, backgroundColor: theme.bg }]} />
              <View style={[styles.colour, { flex: 2, backgroundColor: theme.sur }]} />
              <View style={[styles.colour, { flex: 1, backgroundColor: theme.accent }]} />
            </View>
            <View style={styles.label}>
              <Text numberOfLines={2} style={styles.name}>
                {theme.name}
              </Text>
              {theme.id === current && <Feather name="check" size={14} style={styles.check} />}
            </View>
          </Pressable>
        </Fragment>
      ))}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  root: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  group: {
    width: '100%',
    marginTop: 6,
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  swatch: {
    width: '31.5%',
    overflow: 'hidden',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  on: { borderColor: colors.accent, borderWidth: 2 },
  colours: { flexDirection: 'row', height: 40 },
  colour: { height: '100%' },
  label: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 7, minHeight: 40 },
  name: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 12 },
  check: { color: colors.accentInk },
}));
