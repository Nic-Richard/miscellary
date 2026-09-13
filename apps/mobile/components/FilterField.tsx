import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

export default function FilterField({
  value,
  onChange,
  placeholder,
  label,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  style?: object;
}) {
  return (
    <View style={[styles.box, style]}>
      <Feather name="search" size={17} color={colors.muted} />
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        selectionColor={colors.accent}
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={styles.input}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear"
          hitSlop={10}
          onPress={() => onChange('')}
          style={({ pressed }) => [styles.clear, pressed && { opacity: 0.6 }]}
        >
          <Feather name="x" size={16} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 12,
    paddingRight: 6,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 7,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  clear: { padding: 8 },
});
