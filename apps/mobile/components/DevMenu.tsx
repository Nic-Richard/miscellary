import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts } from '@/lib/theme';

export default function DevMenu() {
  if (!__DEV__) return null;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open renderer primitives check"
        onPress={() => router.push('/dev/primitives')}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.label}>PRIMITIVES</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.accent,
    opacity: 0.9,
  },
  pressed: { opacity: 1 },
  label: { fontFamily: fonts.medium, fontSize: 12, color: colors.accentText, letterSpacing: 0.5 },
});
