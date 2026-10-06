import {
  cardCode,
  createCollectionRequests,
  groupOwnedCards,
  RARITIES,
  RARITY_LABELS,
  countOf,
  spareCount,
  stackOwnedCards,
} from '@miscellary/shared';
import type { OwnedCard, SetPointsBalance } from '@miscellary/shared';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import InspectorModal from '@/components/InspectorModal';
import CardInspector from '@/components/CardInspector';
import CardPreview from '@/components/CardPreview';
import FilterField from '@/components/FilterField';
import LoginGate from '@/components/LoginGate';
import PointGain from '@/components/PointGain';
import { listAllMyCards, listMyPoints, recycleCard, recycleDuplicates } from '@/lib/endpoints';
import { colors, fonts, rarityColors } from '@/lib/theme';
import { ErrorText, Muted } from '@/components/ui';

function Collection() {
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [points, setPoints] = useState<SetPointsBalance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OwnedCard | null>(null);
  const [recycling, setRecycling] = useState<string | null>(null);
  const [gain, setGain] = useState<{ cardId: string; amount: number; key: number } | null>(null);
  const [filter, setFilter] = useState('');
  const [requests] = useState(() =>
    createCollectionRequests({ listAllMyCards, listMyPoints, recycleCard, recycleDuplicates }),
  );

  useFocusEffect(
    useCallback(() => {
      void requests.load(
        undefined,
        ({ cards, points }) => {
          setCards(cards);
          setPoints(points);
          setError(null);
        },
        (e) => setError(e instanceof Error ? e.message : 'Could not load your cards.'),
      );
      return () => requests.invalidate();
    }, [requests]),
  );

  async function recycle(owned: OwnedCard) {
    await requests.recycle(
      owned.id,
      (result) => {
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
        setTimeout(
          () => setGain((current) => (current?.key === nextGain.key ? null : current)),
          750,
        );
      },
      (e) => setError(e instanceof Error ? e.message : 'Could not recycle.'),
      (busy) => {
        setRecycling(busy ? owned.id : null);
        if (busy) setError(null);
      },
    );
  }

  async function recycleAll(slug: string, title: string) {
    await requests.recycleAll(
      slug,
      undefined,
      (result) => {
        setPoints((current) => [
          ...current.filter((balance) => balance.set_slug !== slug),
          { set_slug: slug, set_title: title, points: result.points },
        ]);
        setCards(result.cards);
      },
      (e) => setError(e instanceof Error ? e.message : 'Could not recycle.'),
      (busy) => {
        setRecycling(busy ? `set:${slug}` : null);
        if (busy) setError(null);
      },
    );
  }

  const stackedCards = stackOwnedCards(cards);
  const bySet = groupOwnedCards(stackedCards);

  const needle = filter.trim().toLowerCase();
  const groups = groupOwnedCards(
    stackedCards.filter(
      (c) =>
        !needle ||
        c.card.title.toLowerCase().includes(needle) ||
        c.set_title.toLowerCase().includes(needle),
    ),
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <ErrorText>{error}</ErrorText>

      {cards.length ? (
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{stackedCards.length}</Text>
              <Text style={styles.figureLabel}>different</Text>
            </View>
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{cards.length}</Text>
              <Text style={styles.figureLabel}>copies</Text>
            </View>
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{cards.length - stackedCards.length}</Text>
              <Text style={styles.figureLabel}>spare</Text>
            </View>
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{bySet.size}</Text>
              <Text style={styles.figureLabel}>sets</Text>
            </View>
          </View>
          <View style={styles.tiers}>
            {RARITIES.map((rarity) => {
              const held = stackedCards.filter((c) => c.card.rarity === rarity).length;
              const most = Math.max(
                1,
                ...RARITIES.map((r) => stackedCards.filter((c) => c.card.rarity === r).length),
              );
              return (
                <View key={rarity} style={styles.tier}>
                  <Text style={styles.tierName}>{RARITY_LABELS[rarity]}</Text>
                  <View style={styles.tierTrack}>
                    <View
                      style={[
                        styles.tierFill,
                        { width: `${(held / most) * 100}%`, backgroundColor: rarityColors[rarity] },
                      ]}
                    />
                  </View>
                  <Text style={styles.tierValue}>{held}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
      {cards.length === 0 ? <Muted>Nothing yet. Open a pack from any published set.</Muted> : null}

      {stackedCards.length > 1 ? (
        <FilterField
          style={styles.filter}
          value={filter}
          onChange={setFilter}
          placeholder="Filter by card or set"
          label="Filter your collection by card or set"
        />
      ) : null}
      {cards.length > 0 && groups.size === 0 ? (
        <Muted>Nothing in your collection matches “{filter}”.</Muted>
      ) : null}

      {[...groups.entries()].map(([slug, list]) => (
        <View key={slug} style={styles.group}>
          <View style={styles.groupHeader}>
            <Link href={{ pathname: '/sets/[slug]', params: { slug } }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{list[0]?.set_title}</Text>
            </Link>
            <Muted style={{ fontSize: 14 }}>
              {countOf(list.length, 'card')} ·{' '}
              {countOf(
                list.reduce((total, card) => total + card.copies, 0),
                'copy',
                'copies',
              )}{' '}
              · {points.find((p) => p.set_slug === slug)?.points ?? 0} points toward an extra pack
            </Muted>
            {spareCount(cards.filter((copy) => copy.set_slug === slug)) > 0 ? (
              <Pressable
                accessibilityRole="button"
                disabled={recycling !== null}
                onPress={() => void recycleAll(slug, list[0]?.set_title ?? '')}
                style={({ pressed }) => [
                  styles.recycle,
                  (pressed || recycling === `set:${slug}`) && { opacity: 0.55 },
                ]}
              >
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {recycling === `set:${slug}`
                    ? 'Recycling…'
                    : `Recycle all spares (${spareCount(cards.filter((copy) => copy.set_slug === slug))})`}
                </Text>
              </Pressable>
            ) : null}
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
                    printedText={owned.card.printed_text}
                    mark={owned.set_mark}
                    rarity={owned.card.rarity}
                    imageUrl={owned.card.image.url}
                    templateKey={owned.card.template_key}
                    templateConfig={owned.card.template_config}
                    code={cardCode(
                      owned.card.printed_set_code,
                      owned.card.position,
                      owned.card.set_total,
                    )}
                    render={owned.card.render}
                  />
                </Pressable>
                <View style={styles.recycleRow}>
                  <View style={styles.recycleAnchor}>
                    <View style={styles.gainSlot} />
                    <View style={styles.recycleControl}>
                      {owned.held ? (
                        <Muted style={{ fontSize: 13 }}>In a pending trade</Muted>
                      ) : owned.copies > 1 ? (
                        <Pressable
                          disabled={recycling !== null}
                          onPress={() => void recycle(owned)}
                          style={({ pressed }) => [
                            styles.recycle,
                            (pressed || recycling === owned.id) && { opacity: 0.55 },
                          ]}
                        >
                          <Text style={{ color: colors.muted, fontSize: 13 }}>
                            Recycle (×{owned.copies})
                          </Text>
                        </Pressable>
                      ) : null}
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
        <InspectorModal open onClose={() => setSelected(null)}>
          <CardInspector
            card={selected.card}
            setTitle={selected.set_title}
            setSlug={selected.set_slug}
            mark={selected.set_mark}
            packColour={selected.set_pack_colour}
            copies={selected.copies}
            onClose={() => setSelected(null)}
          />
        </InspectorModal>
      ) : null}
    </ScrollView>
  );
}

export default function CollectionScreen() {
  return (
    <LoginGate note="Every card you pull from a pack or trade for is kept here.">
      <Collection />
    </LoginGate>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: 14,
    padding: 14,
    marginBottom: 18,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderRadius: 10,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  figure: { alignItems: 'center', gap: 2 },
  figureValue: { color: colors.text, fontFamily: fonts.display, fontSize: 26 },
  figureLabel: { color: colors.faint, fontFamily: fonts.body, fontSize: 13 },
  tiers: { gap: 7, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.bdr },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tierName: { minWidth: 72, color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  tierTrack: {
    flex: 1,
    height: 7,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.bdr2,
    backgroundColor: colors.sur2,
    overflow: 'hidden',
  },
  tierFill: { height: '100%' },
  tierValue: {
    width: 26,
    textAlign: 'right',
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 15,
  },
  filter: { marginTop: 18, marginBottom: 4 },
  group: { marginTop: 16 },
  groupHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
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
