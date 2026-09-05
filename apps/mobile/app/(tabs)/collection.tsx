import type { OwnedCard, SetPointsBalance } from '@miscellary/shared';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CardPreview from '@/components/CardPreview';
import LoginGate from '@/components/LoginGate';
import { listMyCards, listMyPoints, recycleCard } from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import { ErrorText, Muted, Tag, Title } from '@/components/ui';

function Collection() {
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [points, setPoints] = useState<SetPointsBalance[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [page, pts] = await Promise.all([listMyCards(), listMyPoints()]);
      setCards(page.results);
      setPoints(pts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your cards.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function recycle(owned: OwnedCard) {
    Alert.alert('Recycle duplicate', `Turn this copy of ${owned.card.title} into set points?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Recycle',
        onPress: async () => {
          try {
            await recycleCard(owned.id);
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not recycle.');
          }
        },
      },
    ]);
  }

  const bySet = new Map<string, OwnedCard[]>();
  for (const c of cards) bySet.set(c.set_slug, [...(bySet.get(c.set_slug) ?? []), c]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Tag>Collection</Tag>
      <Title>Your cards</Title>
      <ErrorText>{error}</ErrorText>
      {cards.length === 0 ? <Muted>Nothing yet. Open a pack from any published set.</Muted> : null}
      {[...bySet.entries()].map(([slug, list]) => (
        <View key={slug} style={styles.group}>
          <View style={styles.groupHeader}>
            <Link href={{ pathname: '/sets/[slug]', params: { slug } }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{list[0]?.set_title}</Text>
            </Link>
            <Muted style={{ fontSize: 12 }}>
              {list.length} cards · {points.find((p) => p.set_slug === slug)?.points ?? 0} points
            </Muted>
          </View>
          <View style={styles.grid}>
            {list.map((owned) => (
              <View key={owned.id} style={{ alignItems: 'center', gap: 4 }}>
                <CardPreview
                  width={150}
                  title={owned.card.title}
                  rarity={owned.card.rarity}
                  imageUrl={owned.card.image.url}
                  templateKey={owned.card.template_key}
                  templateConfig={owned.card.template_config}
                />
                {owned.held ? (
                  <Muted style={{ fontSize: 11 }}>In a pending trade</Muted>
                ) : owned.copies > 1 ? (
                  <Pressable onPress={() => recycle(owned)} style={styles.recycle}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      Recycle (×{owned.copies})
                    </Text>
                  </Pressable>
                ) : (
                  <Muted style={{ fontSize: 11 }}>Only copy</Muted>
                )}
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export default function CollectionScreen() {
  return (
    <LoginGate message="Log in to see your collection.">
      <Collection />
    </LoginGate>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 16 },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderBottomColor: colors.bdr,
    borderBottomWidth: 1,
    paddingBottom: 6,
    marginBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  recycle: {
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
