import { cardCode } from '@miscellary/shared';
import type { Card, CardSetDetail, OwnedCard, PackOpening, PackStatus } from '@miscellary/shared';
import Feather from '@expo/vector-icons/Feather';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import BinderPages from '@/components/BinderPages';
import CardInspector from '@/components/CardInspector';
import CardPreview from '@/components/CardPreview';
import Description from '@/components/Description';
import DemoBadge from '@/components/DemoBadge';
import PackPreview from '@/components/PackPreview';
import PackReveal from '@/components/PackReveal';
import PointGain from '@/components/PointGain';
import { useAuth } from '@/lib/auth';
import { CONTINUE_PARAM, loginRoute } from '@/lib/returnTo';
import {
  getPackStatus,
  getPublicSet,
  likeCard,
  likeSet,
  listMyCards,
  openPack,
  recycleCard,
  sendReport,
} from '@/lib/endpoints';
import { colors, fonts } from '@/lib/theme';
import { Button, Chip, ErrorText, Loading, Muted, Tag, Title } from '@/components/ui';

const PACK_ACTION = 'pack';

function stack(owned: OwnedCard[]): OwnedCard[] {
  const seen = new Map<string, OwnedCard>();
  for (const copy of owned) {
    const current = seen.get(copy.card.id);
    if (!current || (current.held && !copy.held)) seen.set(copy.card.id, copy);
  }
  return [...seen.values()];
}

export default function BinderScreen() {
  const params = useLocalSearchParams<{ slug: string; do?: string }>();
  const { slug } = params;
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const { user, loading } = useAuth();
  const [set, setSet] = useState<CardSetDetail | null>(null);
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [opening, setOpening] = useState<PackOpening | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'binder' | 'all' | 'collected'>('binder');
  const [owned, setOwned] = useState<OwnedCard[] | null>(null);
  const [selected, setSelected] = useState<{ card: Card; copies?: number } | null>(null);
  const [recycling, setRecycling] = useState<string | null>(null);
  const [gain, setGain] = useState<{ cardId: string; amount: number; key: number } | null>(null);

  const load = useCallback(async () => {
    const s = await getPublicSet(slug);
    setSet(s);
    if (user && s.status === 'published') setStatus(await getPackStatus(slug));
  }, [slug, user]);

  useEffect(() => {
    if (loading) return;
    load().catch((e: Error) => setError(e.message));
  }, [load, loading]);

  useEffect(() => {
    if (tab !== 'collected' || !user || owned !== null) return;
    listMyCards(slug)
      .then((page) => setOwned(page.results))
      .catch((e: Error) => {
        setOwned([]);
        setError(e.message);
      });
  }, [owned, slug, tab, user]);

  const open = useCallback(
    async (usePoints: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const result = await openPack(slug, usePoints);
        setOpening(result);
        setStatus(result.status);
        setOwned(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not open the pack.');
      } finally {
        setBusy(false);
      }
    },
    [slug],
  );

  const openFromPack = useCallback(() => {
    if (!user) {
      router.push(loginRoute(`/sets/${slug}`, PACK_ACTION));
      return;
    }
    if (!status || busy) return;
    if (status.free_available) void open(false);
    else if (status.points >= status.pack_cost) void open(true);
  }, [user, status, busy, slug, open]);

  const continued = useRef(false);
  useEffect(() => {
    if (continued.current || params[CONTINUE_PARAM] !== PACK_ACTION) return;
    if (!user || !status || busy) return;
    continued.current = true;
    router.setParams({ [CONTINUE_PARAM]: undefined });
    openFromPack();
  }, [busy, openFromPack, params, status, user]);

  async function recycle(copy: OwnedCard) {
    setRecycling(copy.id);
    setError(null);
    try {
      const result = await recycleCard(copy.id);
      setOwned((current) =>
        current
          ? current
              .filter((ownedCard) => ownedCard.id !== copy.id)
              .map((ownedCard) =>
                ownedCard.card.id === copy.card.id
                  ? { ...ownedCard, copies: ownedCard.copies - 1 }
                  : ownedCard,
              )
          : current,
      );
      setStatus((current) => (current ? { ...current, points: result.points } : current));
      setSelected((current) =>
        current?.card.id === copy.card.id && current.copies
          ? { ...current, copies: current.copies - 1 }
          : current,
      );
      const nextGain = { cardId: copy.card.id, amount: result.earned, key: Date.now() };
      setGain(nextGain);
      setTimeout(() => setGain((current) => (current?.key === nextGain.key ? null : current)), 750);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not recycle.');
    } finally {
      setRecycling(null);
    }
  }

  async function toggleSetLike() {
    if (!set || !user) return;
    const r = await likeSet(set.slug, !set.liked);
    setSet({ ...set, liked: r.liked, like_count: r.like_count });
  }

  async function toggleCardLike(cardId: string) {
    if (!set || !user) return;
    const liked = set.liked_card_ids.includes(cardId);
    const r = await likeCard(cardId, !liked);
    setSet({
      ...set,
      liked_card_ids: r.liked
        ? [...set.liked_card_ids, cardId]
        : set.liked_card_ids.filter((id) => id !== cardId),
      cards: set.cards.map((c) => (c.id === cardId ? { ...c, like_count: r.like_count } : c)),
    });
  }

  function report() {
    if (!set) return;
    Alert.alert('Report this set', 'Why are you reporting it?', [
      {
        text: 'Explicit content',
        onPress: () => void sendReport({ set_slug: set.slug, reason: 'explicit', details: '' }),
      },
      {
        text: 'Stolen photos',
        onPress: () => void sendReport({ set_slug: set.slug, reason: 'stolen', details: '' }),
      },
      {
        text: 'Real person misuse',
        onPress: () => void sendReport({ set_slug: set.slug, reason: 'real_person', details: '' }),
      },
      {
        text: 'Spam',
        onPress: () => void sendReport({ set_slug: set.slug, reason: 'spam', details: '' }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (error && !set) return <ErrorText>{error}</ErrorText>;
  if (!set) return <Loading />;

  const cardWidth = Math.min(
    160,
    Math.max(128, (viewportWidth - insets.left - insets.right - 46) / 2),
  );
  const collected = stack(owned ?? []);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: 16,
        paddingTop: 12 + insets.top,
        paddingLeft: 16 + insets.left,
        paddingRight: 16 + insets.right,
        paddingBottom: 40 + insets.bottom,
      }}
    >
      <View style={styles.topline}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.55 }]}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Tag>{set.status === 'draft' ? 'Draft preview' : 'Binder'}</Tag>
      </View>
      <Title>{set.title}</Title>
      <View style={styles.metaRow}>
        <Link href={{ pathname: '/users/[username]', params: { username: set.creator.username } }}>
          <Text style={{ color: colors.accent }}>@{set.creator.username}</Text>
        </Link>
        {set.creator.is_demo ? <DemoBadge /> : null}
        <Muted>
          {' '}
          · {set.card_count} cards · {set.opening_count} packs opened
        </Muted>
      </View>
      {set.description ? <Description text={set.description} /> : null}

      {set.status === 'published' ? (
        <View style={styles.social}>
          <Pressable
            onPress={() => void toggleSetLike()}
            style={[styles.like, set.liked && { borderColor: colors.danger }]}
          >
            <Text style={{ color: set.liked ? colors.danger : colors.muted }}>
              ♥ {set.like_count}
            </Text>
          </Pressable>
          {user ? (
            <Pressable onPress={report}>
              <Text style={{ color: colors.faint, fontSize: 12 }}>Report</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {set.status === 'published' ? (
        <View style={styles.packs}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open a ${set.title} pack`}
            disabled={busy || (!!user && !status)}
            onPress={openFromPack}
            style={({ pressed }) => [styles.packPress, pressed && { opacity: 0.82 }]}
          >
            <View pointerEvents="none">
              <PackPreview set={set} width={205} />
            </View>
          </Pressable>
          {!user ? (
            <Muted>Tap the pack to log in and open your daily pack.</Muted>
          ) : status ? (
            <>
              <Button
                title={
                  status.free_available
                    ? `Open today's free pack (${status.pack_size} cards)`
                    : 'Free pack opened. Back tomorrow.'
                }
                disabled={busy || !status.free_available}
                onPress={() => void open(false)}
              />
              <Button
                title={`Extra pack for ${status.pack_cost} points (you have ${status.points})`}
                kind="secondary"
                disabled={busy || status.points < status.pack_cost}
                onPress={() => void open(true)}
              />
            </>
          ) : null}
          <ErrorText>{error}</ErrorText>
        </View>
      ) : null}

      <View style={styles.tabs}>
        <Chip label="Binder" active={tab === 'binder'} onPress={() => setTab('binder')} />
        <Chip label="All cards" active={tab === 'all'} onPress={() => setTab('all')} />
        {user ? (
          <Chip
            label="Collected"
            active={tab === 'collected'}
            onPress={() => setTab('collected')}
          />
        ) : null}
      </View>

      {tab === 'binder' ? (
        <BinderPages
          key={set.id}
          set={set}
          cards={set.cards}
          likedIds={set.liked_card_ids}
          onLike={
            user && set.status === 'published'
              ? (id) => {
                  void toggleCardLike(id).catch((e: Error) => setError(e.message));
                }
              : undefined
          }
        />
      ) : null}

      {tab === 'all' ? (
        <View style={styles.cardSection}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>All cards</Text>
            <Muted style={{ fontSize: 12 }}>{set.card_count} in this set</Muted>
          </View>
          <View style={styles.grid}>
            {set.cards.map((card) => (
              <Pressable
                key={card.id}
                accessibilityRole="button"
                accessibilityLabel={`Inspect ${card.title}`}
                onPress={() => setSelected({ card })}
                style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
              >
                <CardPreview
                  width={cardWidth}
                  title={card.title}
                  description={card.description}
                  printedText={card.printed_text}
                  mark={set.mark}
                  rarity={card.rarity}
                  imageUrl={card.image.url}
                  templateKey={card.template_key}
                  templateConfig={card.template_config}
                  code={cardCode(card.printed_set_code, card.position, card.set_total)}
                  render={card.render}
                />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {tab === 'collected' ? (
        <View style={styles.cardSection}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Collected</Text>
            <Muted style={{ fontSize: 12 }}>
              {owned === null
                ? 'Loading'
                : `${collected.length} of ${set.card_count} · ${owned.length} copies`}
            </Muted>
          </View>
          {owned === null ? (
            <Loading />
          ) : collected.length === 0 ? (
            <Muted>Open a pack to start collecting this set.</Muted>
          ) : (
            <View style={styles.grid}>
              {collected.map((copy) => (
                <View key={copy.card.id} style={styles.collectedCard}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Inspect ${copy.card.title}`}
                    onPress={() => setSelected({ card: copy.card, copies: copy.copies })}
                    style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
                  >
                    <CardPreview
                      width={cardWidth}
                      title={copy.card.title}
                      description={copy.card.description}
                      printedText={copy.card.printed_text}
                      mark={set.mark}
                      rarity={copy.card.rarity}
                      imageUrl={copy.card.image.url}
                      templateKey={copy.card.template_key}
                      templateConfig={copy.card.template_config}
                      code={cardCode(
                        copy.card.printed_set_code,
                        copy.card.position,
                        copy.card.set_total,
                      )}
                      render={copy.card.render}
                    />
                  </Pressable>
                  <View style={styles.recycleRow}>
                    <View style={styles.recycleAnchor}>
                      <View style={styles.gainSlot} />
                      <View style={styles.recycleControl}>
                        {copy.held ? (
                          <Muted style={{ fontSize: 11 }}>In a pending trade</Muted>
                        ) : copy.copies > 1 ? (
                          <Pressable
                            disabled={recycling === copy.id}
                            onPress={() => void recycle(copy)}
                            style={({ pressed }) => [
                              styles.recycle,
                              (pressed || recycling === copy.id) && { opacity: 0.55 },
                            ]}
                          >
                            <Text style={styles.recycleText}>×{copy.copies} · Recycle one</Text>
                          </Pressable>
                        ) : (
                          <Muted style={{ fontSize: 11 }}>Only copy</Muted>
                        )}
                      </View>
                      <View style={styles.gainSlot}>
                        {gain?.cardId === copy.card.id ? (
                          <PointGain key={gain.key} amount={gain.amount} />
                        ) : null}
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {opening ? <PackReveal opening={opening} onClose={() => setOpening(null)} /> : null}
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
            setTitle={set.title}
            setSlug={set.slug}
            mark={set.mark}
            packColour={set.pack_colour}
            creator={set.creator}
            copies={selected.copies}
            onClose={() => setSelected(null)}
          />
        </Modal>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topline: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  back: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.bdr2,
    backgroundColor: colors.sur,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  social: { flexDirection: 'row', gap: 14, alignItems: 'center', marginVertical: 10 },
  like: {
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  packs: {
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  packPress: { alignSelf: 'center', alignItems: 'center', marginBottom: 4 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  cardSection: {
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomColor: colors.bdr,
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  collectedCard: { alignItems: 'center', gap: 5 },
  recycleRow: { minHeight: 29, alignItems: 'center', justifyContent: 'center' },
  recycleAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recycleControl: { alignItems: 'center', justifyContent: 'center' },
  gainSlot: { width: 38, alignItems: 'flex-start', justifyContent: 'center' },
  recycle: {
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recycleText: { color: colors.muted, fontSize: 11 },
});
