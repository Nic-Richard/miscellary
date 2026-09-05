import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PressableProps, TextInputProps, ViewProps } from 'react-native';
import { colors } from '@/lib/theme';

export function Screen({ style, ...rest }: ViewProps) {
  return <View style={[styles.screen, style]} {...rest} />;
}

export function Tag({ children }: { children: string }) {
  return <Text style={styles.tag}>{children}</Text>;
}

export function Title({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function ErrorText({ children }: { children: string | null }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

export function Loading() {
  return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;
}

export function Input(props: TextInputProps) {
  return (
    <TextInput placeholderTextColor={colors.faint} {...props} style={[styles.input, props.style]} />
  );
}

interface ButtonProps extends PressableProps {
  title: string;
  kind?: 'primary' | 'secondary' | 'danger';
}

export function Button({ title, kind = 'primary', disabled, style, ...rest }: ButtonProps) {
  const bg = kind === 'primary' ? colors.accent : 'transparent';
  const border = kind === 'danger' ? colors.danger : kind === 'secondary' ? colors.bdr2 : bg;
  const fg =
    kind === 'primary' ? colors.accentText : kind === 'danger' ? colors.danger : colors.muted;
  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 },
        style as object,
      ]}
      {...rest}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={{ color: active ? colors.text : colors.muted, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  tag: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', marginBottom: 12 },
  muted: { color: colors.muted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 13, marginVertical: 6 },
  input: {
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 6,
    color: colors.text,
    padding: 12,
    fontSize: 15,
  },
  button: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonText: { fontWeight: '700', fontSize: 15 },
  chip: {
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  chipActive: { borderColor: colors.accent },
});
