import type { Tag } from '@miscellary/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

export default function TagChips({ tags, label }: { tags: Tag[]; label?: string }) {
  if (!tags.length) return null;
  return (
    <View accessibilityLabel={label} style={styles.row}>
      {tags.map((tag) => (
        <Pressable
          key={tag.slug}
          accessibilityRole="link"
          accessibilityLabel={`Search for ${tag.label}`}
          onPress={() => router.push({ pathname: '/search', params: { q: tag.label } })}
          style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.text}>{tag.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: colors.sur,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
});
