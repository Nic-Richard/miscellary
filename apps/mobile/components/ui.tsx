import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PressableProps, TextInputProps, ViewProps } from 'react-native';
import { colors, fonts } from '@/lib/theme';

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
  return children ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  ) : null;
}

export function Loading() {
  return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      selectionColor={colors.accent}
      {...props}
      style={[styles.input, props.style]}
    />
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
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={(state) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: disabled ? 0.5 : state.pressed ? 0.75 : 1,
        },
        typeof style === 'function' ? style(state) : style,
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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text
        style={{
          color: active ? colors.accentText : colors.muted,
          fontFamily: fonts.medium,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  tag: {
    color: colors.gold,
    fontFamily: fonts.medium,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 34, marginBottom: 12 },
  muted: { color: colors.muted, fontFamily: fonts.body, fontSize: 15 },
  error: { color: colors.danger, fontFamily: fonts.body, fontSize: 15, marginVertical: 6 },
  input: {
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 6,
    color: colors.text,
    fontFamily: fonts.body,
    minHeight: 48,
    padding: 12,
    fontSize: 16,
  },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonText: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 0.6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
});
