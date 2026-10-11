import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { PressableProps, TextInputProps, ViewProps } from 'react-native';
import { fonts, paperTexture, shadows, useColors, createThemedStyles } from '@/lib/theme';

export function Screen({ style, ...rest }: ViewProps) {
  const styles = useStyles();
  return <View style={[styles.screen, style]} {...rest} />;
}

/** The website's paper sheet: textured, lifted, with a stitched inner edge. `plain` is the
 * off-white card for items inside a screen, like a set tile. */
export function Panel({
  stitched = true,
  plain = false,
  style,
  children,
  ...rest
}: ViewProps & { stitched?: boolean; plain?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.panel, plain && styles.panelPlain, style]} {...rest}>
      {!plain && <Image source={paperTexture} resizeMode="repeat" style={styles.paper} />}
      {stitched && !plain && <View pointerEvents="none" style={styles.stitch} />}
      {children}
    </View>
  );
}

/** The unstitched sheet under a row of BinderTabs. */
export function Board({ style, ...rest }: ViewProps) {
  const styles = useStyles();
  return <Panel stitched={false} style={[styles.board, style]} {...rest} />;
}

export function PanelTitle({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <Text accessibilityRole="header" style={styles.panelTitle}>
      {children}
    </Text>
  );
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

type ButtonKind = 'primary' | 'secondary' | 'quiet' | 'danger';

interface ButtonProps extends PressableProps {
  title: string;
  kind?: ButtonKind;
  small?: boolean;
}

export function Button({ title, kind = 'primary', small, disabled, style, ...rest }: ButtonProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={(state) => [
        styles.button,
        small && styles.buttonSmall,
        styles[kind],
        disabled && styles.buttonDisabled,
        state.pressed && !disabled && styles.buttonPressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <Text
        numberOfLines={1}
        style={[styles.buttonText, small && styles.buttonTextSmall, styles[TEXT[kind]]]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const TEXT = {
  primary: 'primaryText',
  secondary: 'secondaryText',
  quiet: 'quietText',
  danger: 'dangerText',
} as const;

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  fill = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** Spread the options across the full width. */
  fill?: boolean;
}) {
  const styles = useStyles();
  return (
    <View
      style={[styles.segments, fill && styles.segmentsFill]}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, fill && styles.segmentFill, active && styles.segmentOn]}
          >
            <Text numberOfLines={1} style={[styles.segmentText, active && styles.segmentTextOn]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Folder tabs that sit on top of an unstitched Panel, the website's board. */
export function BinderTabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.binderTabs}
      accessibilityRole="tablist"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.binderTab, active && styles.binderTabOn]}
          >
            <Text style={[styles.binderTabText, active && styles.binderTabTextOn]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Chip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
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
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
        {count !== undefined && (
          <Text style={[styles.chipCount, active && styles.chipCountActive]}> {count}</Text>
        )}
      </Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => {
  const shadow = shadows(colors);
  return {
    screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
    binderTabs: { gap: 4, paddingLeft: 4, alignItems: 'flex-end' },
    binderTab: {
      paddingHorizontal: 16,
      paddingTop: 9,
      paddingBottom: 10,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.bdr,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      backgroundColor: colors.sur2,
    },
    binderTabOn: {
      zIndex: 3,
      marginBottom: -1,
      paddingTop: 12,
      paddingBottom: 11,
      backgroundColor: colors.sur,
      boxShadow: `inset 0 3px 0 ${colors.accent}`,
    },
    binderTabText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 15 },
    binderTabTextOn: { color: colors.text },
    board: { padding: 0, gap: 0, borderTopLeftRadius: 0, overflow: 'hidden' },
    panel: {
      gap: 10,
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.bdr,
      backgroundColor: colors.sur,
      boxShadow: shadow.sheet,
    },
    panelPlain: { padding: 14, borderRadius: 12, boxShadow: shadow.sm },
    paper: {
      ...StyleSheet.absoluteFillObject,
      width: undefined,
      height: undefined,
      borderRadius: 13,
      mixBlendMode: 'multiply',
    },
    stitch: {
      position: 'absolute',
      top: 6,
      right: 6,
      bottom: 6,
      left: 6,
      borderRadius: 9,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.bdr2,
    },
    panelTitle: {
      paddingBottom: 9,
      borderBottomWidth: 1,
      borderBottomColor: colors.bdr,
      color: colors.text,
      fontFamily: fonts.display,
      fontSize: 22,
      letterSpacing: 0.6,
    },
    tag: { color: colors.accent, fontFamily: fonts.medium, fontSize: 15, marginBottom: 2 },
    title: { color: colors.pageText, fontFamily: fonts.display, fontSize: 34, marginBottom: 12 },
    muted: { color: colors.muted, fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
    error: { color: colors.danger, fontFamily: fonts.body, fontSize: 15, marginVertical: 6 },
    input: {
      backgroundColor: colors.sur2,
      borderColor: colors.bdr2,
      borderWidth: 1,
      borderRadius: 8,
      color: colors.text,
      fontFamily: fonts.body,
      minHeight: 46,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      boxShadow: shadow.inset,
    },
    button: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: 8,
      paddingHorizontal: 16,
    },
    buttonSmall: { minHeight: 36, paddingHorizontal: 12 },
    buttonPressed: { transform: [{ translateY: 1 }], opacity: 0.9 },
    buttonDisabled: { opacity: 0.45 },
    buttonText: { fontFamily: fonts.medium, fontSize: 16 },
    buttonTextSmall: { fontSize: 14 },
    primary: {
      borderColor: colors.accentDeep,
      backgroundColor: colors.accent,
      experimental_backgroundImage: `linear-gradient(180deg, ${colors.accentSoft}, ${colors.accent})`,
      boxShadow: `inset 0px 1px 0px rgba(255, 255, 255, 0.22), 0px 1px 0px ${colors.accentDeep}, ${shadow.sm}`,
    },
    primaryText: { color: colors.accentText },
    secondary: {
      borderColor: colors.bdr2,
      backgroundColor: colors.sur,
      boxShadow: `inset 0px 1px 0px ${colors.edgeLight}, 0px 1px 0px ${colors.bdr2}`,
    },
    secondaryText: { color: colors.accentInk },
    quiet: {},
    quietText: { color: colors.muted },
    danger: { borderColor: colors.danger },
    dangerText: { color: colors.danger },
    segments: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      padding: 3,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.bdr,
      backgroundColor: colors.sur2,
      boxShadow: shadow.inset,
    },
    segmentsFill: { alignSelf: 'stretch' },
    segment: {
      minHeight: 34,
      paddingHorizontal: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    segmentFill: { flex: 1, paddingHorizontal: 6 },
    segmentOn: {
      backgroundColor: colors.sur,
      borderColor: colors.bdr,
      boxShadow: `inset 0px 1px 0px ${colors.edgeLight}, ${shadow.sm}`,
    },
    segmentText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
    segmentTextOn: { color: colors.text },
    chip: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 13,
      borderWidth: 1,
      borderColor: colors.bdr2,
      borderRadius: 999,
      backgroundColor: colors.sur,
      boxShadow: `inset 0px 1px 0px ${colors.edgeLight}`,
    },
    chipActive: { borderColor: colors.accentDeep, backgroundColor: colors.accent },
    chipText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
    chipTextActive: { color: colors.accentText },
    chipCount: { color: colors.faint, fontFamily: fonts.body },
    chipCountActive: { color: colors.accentText, opacity: 0.75 },
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
  } as const;
});
