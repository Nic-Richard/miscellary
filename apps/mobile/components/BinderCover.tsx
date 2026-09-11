import { useState } from 'react';
import type { CardSetSummary } from '@miscellary/shared';
import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { binderColors, colors, fonts } from '@/lib/theme';
import cloth from '../assets/cloth.png';
import DemoBadge from './DemoBadge';

export default function BinderCover({ set }: { set: CardSetSummary }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = set.cover?.url;
  return (
    <Link href={{ pathname: '/sets/[slug]', params: { slug: set.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${set.title}, ${set.card_count} cards, by ${set.creator.display_name || set.creator.username}`}
        style={({ pressed }) => [
          styles.root,
          pressed && { opacity: 0.8, transform: [{ translateY: 2 }] },
        ]}
      >
        <View
          style={[
            styles.cover,
            { backgroundColor: binderColors[set.binder_colour] ?? colors.cloth },
          ]}
        >
          <Image source={cloth} resizeMode="repeat" style={styles.cloth} />
          <View style={styles.stitch} />
          <View style={styles.spine} />
          <View style={styles.window}>
            {url && url !== failedUrl ? (
              <Image
                source={{ uri: url }}
                resizeMode="cover"
                style={StyleSheet.absoluteFill}
                onError={() => setFailedUrl(url)}
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.initial}>{set.title.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.windowRim} />
          </View>
          <View style={styles.label}>
            <Text style={styles.title} numberOfLines={2}>
              {set.title}
            </Text>
            <Text style={styles.count}>{set.card_count} cards</Text>
          </View>
          <View style={styles.pages} />
        </View>
        <View style={styles.creatorRow}>
          <Text numberOfLines={1} style={styles.creator}>
            @{set.creator.username}
          </Text>
          {set.creator.is_demo ? <DemoBadge /> : null}
        </View>
        <Text style={styles.likes}>
          {set.like_count === 1
            ? '1 collector liked this'
            : `${set.like_count} collectors liked this`}
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0 },
  cover: {
    aspectRatio: 0.74,
    borderRadius: 5,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 20,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(40,50,38,0.3)',
    elevation: 3,
    shadowColor: '#372e25',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 3 },
  },
  stitch: {
    position: 'absolute',
    inset: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,250,229,0.25)',
    borderRadius: 3,
  },
  cloth: { ...StyleSheet.absoluteFillObject, opacity: 0.12, borderRadius: 5 },
  spine: {
    position: 'absolute',
    left: 5,
    top: 0,
    bottom: 0,
    width: 7,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(30,40,26,0.22)',
    backgroundColor: 'rgba(30,40,26,0.09)',
  },
  window: {
    flex: 1,
    backgroundColor: colors.sur2,
    borderWidth: 3,
    borderColor: '#eee5cf',
    marginBottom: 12,
    overflow: 'hidden',
  },
  windowRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(40,30,15,0.2)',
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.display, fontSize: 48, color: colors.cloth },
  label: {
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: 'rgba(55,46,37,0.2)',
    paddingHorizontal: 7,
    paddingVertical: 7,
    minHeight: 67,
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 23, color: colors.text },
  count: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 3 },
  pages: {
    position: 'absolute',
    bottom: 2,
    right: 3,
    left: 15,
    height: 3,
    backgroundColor: '#ded3ba',
    borderBottomWidth: 1,
    borderColor: '#bcb097',
  },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  creator: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  likes: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 2,
  },
});
