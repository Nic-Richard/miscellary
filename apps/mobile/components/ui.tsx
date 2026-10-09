import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import type { PressableProps, TextInputProps, ViewProps } from 'react-native';
import { fonts, useColors, createThemedStyles } from '@/lib/theme';

export function Screen({ style, ...rest }: ViewProps) {
  const styles = useStyles();
  return <View style={[styles.screen, style]} {...rest} />;
}

export function Tag({ children }: { children: string }) {
  const styles = useStyles();
  return <Text style={styles.tag}>{children}</Text>;
}

export function Title({ children }: { children: string }) {
  const styles = useStyles();
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  const styles = useStyles();
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function ErrorText({ children }: { children: string | null }) {
  const styles = useStyles();
  return children ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  ) : null;
}

export function Loading() {
  const colors = useColors();
  return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;
}

export function Input(props: TextInputProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      selectionColor={colors.accent}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function PasswordInput(props: Omit<TextInputProps, 'secureTextEntry'>) {
  const colors = useColors();
  const styles = useStyles();
  const [shown, setShown] = useState(false);
  return (
    <View style={styles.passwordWrap}>
      <Input
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        secureTextEntry={!shown}
        style={[styles.passwordInput, props.style]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={shown ? 'Hide password' : 'Show password'}
        accessibilityState={{ selected: shown }}
        hitSlop={8}
        onPress={() => setShown((current) => !current)}
        style={styles.passwordToggle}
      >
        <Feather name={shown ? 'eye-off' : 'eye'} size={20} color={colors.faint} />
      </Pressable>
    </View>
  );
}

interface ButtonProps extends PressableProps {
  title: string;
  kind?: 'primary' | 'secondary' | 'danger';
}

export function Button({ title, kind = 'primary', disabled, style, ...rest }: ButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const solid = kind === 'primary';
  const bg = solid ? (disabled ? colors.bdr : colors.accent) : 'transparent';
  const border = kind === 'danger' ? colors.danger : kind === 'secondary' ? colors.bdr2 : bg;
  const fg = solid
    ? disabled
      ? colors.muted
      : colors.accentText
    : kind === 'danger'
      ? colors.danger
      : colors.muted;
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
          opacity: disabled ? (solid ? 1 : 0.5) : state.pressed ? 0.75 : 1,
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
  const colors = useColors();
  const styles = useStyles();
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

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  tag: {
    color: colors.accent,
    fontFamily: fonts.medium,
    fontSize: 15,
    marginBottom: 2,
  },
  title: { color: colors.pageText, fontFamily: fonts.display, fontSize: 34, marginBottom: 12 },
  muted: { color: colors.muted, fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
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
  buttonText: { fontFamily: fonts.medium, fontSize: 17 },
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
  passwordWrap: { justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  passwordToggle: {
    position: 'absolute',
    right: 6,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
