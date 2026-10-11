import { personHandle, personName } from '@miscellary/shared';
import type { CardSetSummary } from '@miscellary/shared';
import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { binderColors, fonts, useColors, createThemedStyles } from '@/lib/theme';

export default function SetTile({ set }: { set: CardSetSummary }) {
  const colors = useColors();
  const styles = useStyles();
  const pack = set.render_pack?.image?.url;
  return (
    <Link href={{ pathname: '/sets/[slug]', params: { slug: set.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${set.title}, ${set.card_count} cards, by ${personName(set.creator)}`}
        style={({ pressed }) => [styles.press, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.root}>
          <View
            style={[
              styles.stage,
              { backgroundColor: binderColors[set.binder_colour] ?? colors.cloth },
            ]}
          >
            {pack ? (
              <Image source={{ uri: pack }} resizeMode="cover" style={StyleSheet.absoluteFill} />
            ) : null}
          </View>
          <View style={styles.label}>
            <Text style={styles.title} numberOfLines={2}>
              {set.title}
            </Text>
            <Text numberOfLines={1} style={styles.meta}>
              {set.card_count} cards · {personHandle(set.creator)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const useStyles = createThemedStyles((colors) => ({
  press: { flex: 1, minWidth: 0 },
  root: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderBottomWidth: 2,
    backgroundColor: colors.sur,
  },
  stage: {
    aspectRatio: 0.8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: '9%',
  },
  label: {
    gap: 3,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderColor: colors.bdr2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 22,
    color: colors.text,
  },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
}));
