import { useState } from 'react';
import type { CardSetSummary } from '@miscellary/shared';
import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { binderColors, colors, fonts } from '@/lib/theme';
import DemoBadge from './DemoBadge';

export default function SetTile({ set }: { set: CardSetSummary }) {
  const [failed, setFailed] = useState(false);
  const pack = set.render_pack?.image?.url;
  const cover = set.cover?.url;
  const art = !failed && pack ? pack : null;
  return (
    <Link href={{ pathname: '/sets/[slug]', params: { slug: set.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${set.title}, ${set.card_count} cards, by ${set.creator.display_name || set.creator.username}`}
        style={({ pressed }) => [styles.root, pressed && { opacity: 0.85 }]}
      >
        <View
          style={[
            styles.stage,
            { backgroundColor: binderColors[set.binder_colour] ?? colors.cloth },
          ]}
        >
          {art ? (
            <Image
              source={{ uri: art }}
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
              onError={() => setFailed(true)}
            />
          ) : cover ? (
            <Image source={{ uri: cover }} resizeMode="cover" style={StyleSheet.absoluteFill} />
          ) : (
            <Text style={styles.initial}>{set.title.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {set.title}
        </Text>
        <View style={styles.metaRow}>
          <Text numberOfLines={1} style={styles.meta}>
            {set.card_count} cards · @{set.creator.username}
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
  initial: { fontFamily: fonts.display, fontSize: 48, color: colors.sur, marginBottom: 24 },
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
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
});
