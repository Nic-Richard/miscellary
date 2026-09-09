import type { OwnedCard, SetPointsBalance } from '@miscellary/shared';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CardInspector from '@/components/CardInspector';
import CardPreview from '@/components/CardPreview';
import LoginGate from '@/components/LoginGate';
import PointGain from '@/components/PointGain';
import { listMyCards, listMyPoints, recycleCard } from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import { ErrorText, Muted, Tag, Title } from '@/components/ui';

function stack(owned: OwnedCard[]): OwnedCard[] {
  const seen = new Map<string, OwnedCard>();
  for (const copy of owned) {
    const current = seen.get(copy.card.id);
    if (!current || (current.held && !copy.held)) seen.set(copy.card.id, copy);
  }
  return [...seen.values()];
}

function Collection() {
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [points, setPoints] = useState<SetPointsBalance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OwnedCard | null>(null);
  const [recycling, setRecycling] = useState<string | null>(null);
  const [gain, setGain] = useState<{ cardId: string; amount: number; key: number } | null>(null);

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

  async function recycle(owned: OwnedCard) {
    setRecycling(owned.id);
    setError(null);
    try {
      const result = await recycleCard(owned.id);
      setCards((current) =>
        current
          .filter((copy) => copy.id !== owned.id)
          .map((copy) =>
            copy.card.id === owned.card.id ? { ...copy, copies: copy.copies - 1 } : copy,
          ),
      );
      setPoints((current) => [
        ...current.filter((balance) => balance.set_slug !== result.set_slug),
        { set_slug: result.set_slug, set_title: owned.set_title, points: result.points },
      ]);
      setSelected((current) =>
        current?.card.id === owned.card.id ? { ...current, copies: current.copies - 1 } : current,
      );
      const nextGain = { cardId: owned.card.id, amount: result.earned, key: Date.now() };
      setGain(nextGain);
      setTimeout(() => setGain((current) => (current?.key === nextGain.key ? null : current)), 750);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not recycle.');
    } finally {
      setRecycling(null);
    }
  }

  const stackedCards = stack(cards);
  const bySet = new Map<string, OwnedCard[]>();
  for (const c of stackedCards) bySet.set(c.set_slug, [...(bySet.get(c.set_slug) ?? []), c]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Tag>My cards</Tag>
      <Title>My cards</Title>
      <ErrorText>{error}</ErrorText>
      {cards.length === 0 ? <Muted>Nothing yet. Open a pack from any published set.</Muted> : null}
      {[...bySet.entries()].map(([slug, list]) => (
        <View key={slug} style={styles.group}>
          <View style={styles.groupHeader}>
            <Link href={{ pathname: '/sets/[slug]', params: { slug } }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{list[0]?.set_title}</Text>
            </Link>
            <Muted style={{ fontSize: 12 }}>
              {list.length} cards · {list.reduce((total, card) => total + card.copies, 0)} copies ·{' '}
              {points.find((p) => p.set_slug === slug)?.points ?? 0} points
            </Muted>
          </View>
          <View style={styles.grid}>
            {list.map((owned) => (
              <View key={owned.card.id} style={{ alignItems: 'center', gap: 4 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Inspect ${owned.card.title}`}
                  onPress={() => setSelected(owned)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
                >
                  <CardPreview
                    width={150}
                    title={owned.card.title}
                    description={owned.card.description}
                    mark={owned.set_mark}
                    rarity={owned.card.rarity}
                    imageUrl={owned.card.image.url}
                    templateKey={owned.card.template_key}
                    templateConfig={owned.card.template_config}
                    number={owned.card.position + 1}
                    render={owned.card.render}
                  />
                </Pressable>
                <View style={styles.recycleRow}>
                  <View style={styles.recycleAnchor}>
                    <View style={styles.gainSlot} />
                    <View style={styles.recycleControl}>
                      {owned.held ? (
                        <Muted style={{ fontSize: 11 }}>In a pending trade</Muted>
                      ) : owned.copies > 1 ? (
                        <Pressable
                          disabled={recycling === owned.id}
                          onPress={() => void recycle(owned)}
                          style={({ pressed }) => [
                            styles.recycle,
                            (pressed || recycling === owned.id) && { opacity: 0.55 },
                          ]}
                        >
                          <Text style={{ color: colors.muted, fontSize: 11 }}>
                            Recycle (×{owned.copies})
                          </Text>
                        </Pressable>
                      ) : (
                        <Muted style={{ fontSize: 11 }}>Only copy</Muted>
                      )}
                    </View>
                    <View style={styles.gainSlot}>
                      {gain?.cardId === owned.card.id ? (
                        <PointGain key={gain.key} amount={gain.amount} />
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
      {selected ? (
        <Modal
          visible
          statusBarTranslucent
          navigationBarTranslucent
          supportedOrientations={['portrait', 'landscape']}
          onRequestClose={() => setSelected(null)}
        >
          <CardInspector
            card={selected.card}
            setTitle={selected.set_title}
            setSlug={selected.set_slug}
            mark={selected.set_mark}
            packColour={selected.set_pack_colour}
            copies={selected.copies}
            onClose={() => setSelected(null)}
          />
        </Modal>
      ) : null}
    </ScrollView>
  );
}

export default function CollectionScreen() {
  return (
    <LoginGate message="Log in to see your cards.">
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
  recycleRow: { minHeight: 26, alignItems: 'center', justifyContent: 'center' },
  recycleAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recycleControl: { alignItems: 'center', justifyContent: 'center' },
  gainSlot: { width: 38, alignItems: 'flex-start', justifyContent: 'center' },
});
