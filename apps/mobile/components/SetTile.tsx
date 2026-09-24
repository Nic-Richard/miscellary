import { personHandle, personName } from '@miscellary/shared';
import type { CardSetSummary } from '@miscellary/shared';
import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { binderColors, colors, fonts } from '@/lib/theme';
import DemoBadge from './DemoBadge';

export default function SetTile({ set }: { set: CardSetSummary }) {
  const pack = set.render_pack?.image?.url;
  return (
    <Link href={{ pathname: '/sets/[slug]', params: { slug: set.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${set.title}, ${set.card_count} cards, by ${personName(set.creator)}`}
        style={({ pressed }) => [styles.root, pressed && { opacity: 0.85 }]}
      >
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
        <Text style={styles.title} numberOfLines={2}>
          {set.title}
        </Text>
        <View style={styles.metaRow}>
          <Text numberOfLines={1} style={styles.meta}>
            {set.card_count} cards · {personHandle(set.creator)}
          </Text>
          {set.creator.is_demo ? <DemoBadge /> : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, gap: 8 },
  stage: {
    aspectRatio: 0.8,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: '9%',
    borderWidth: 1,
    borderColor: 'rgba(41,30,14,0.18)',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 19,
    lineHeight: 21,
    color: colors.text,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
});
