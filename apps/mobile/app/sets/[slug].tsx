import {
  cardCode,
  createCollectionRequests,
  personHandle,
  personName,
  setPath,
  countOf,
  spareCount,
  stackOwnedCards,
} from '@miscellary/shared';
import type {
  Card,
  CardSetDetail,
  OwnedCard,
  PackOpening,
  PackStatus,
  PackPayment,
} from '@miscellary/shared';
import ExtraPackAction from '@/components/ExtraPackAction';
import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import InspectorModal from '@/components/InspectorModal';
import BinderPages from '@/components/BinderPages';
import CardInspector from '@/components/CardInspector';
import Comments from '@/components/Comments';
import CardPreview from '@/components/CardPreview';
import Description from '@/components/Description';
import PackPreview from '@/components/PackPreview';
import PackReveal from '@/components/PackReveal';
import { askForPackReminder, syncPackReminder } from '@/lib/packReminder';
import PointGain from '@/components/PointGain';
import ActionChip from '@/components/ActionChip';
import InspectorActions from '@/components/InspectorActions';
import MoreButton from '@/components/MoreButton';
import ReportSheet from '@/components/ReportSheet';
import ShareButton from '@/components/ShareButton';
import TagChips from '@/components/TagChips';
import { useAuth } from '@/lib/auth';
import { CONTINUE_PARAM, loginRoute } from '@/lib/returnTo';
import {
  getMyPacks,
  followSet,
  getPackStatus,
  getProfile,
  getPublicSet,
  likeCard,
  likeSet,
  listAllMyCards,
  listMyPoints,
  openPack,
  recycleCard,
  recycleDuplicates,
  setFollow,
} from '@/lib/endpoints';
import { readPublicCache, writePublicCache } from '@/lib/publicCache';
import { fonts, useColors, createThemedStyles } from '@/lib/theme';
import {
  Button,
  ErrorText,
  Loading,
  Muted,
  Panel,
  PanelTitle,
  Segmented,
  Tag,
} from '@/components/ui';
import Avatar from '@/components/Avatar';
import SupporterEmblem from '@/components/SupporterEmblem';

const PACK_ACTION = 'pack';
const FOLLOW_SET_ACTION = 'follow-set';

export default function BinderScreen() {
  const colors = useColors();
  const styles = useStyles();
  const params = useLocalSearchParams<{ slug: string; do?: string; tab?: string; card?: string }>();
  const { slug } = params;
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const { user, loading } = useAuth();
  const [reporting, setReporting] = useState(false);
  const [creatorFollowing, setCreatorFollowing] = useState<boolean | null>(null);
  const [set, setSet] = useState<CardSetDetail | null>(null);
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [opening, setOpening] = useState<PackOpening | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const openingPending = useRef(false);
  const [tab, setTab] = useState<'binder' | 'all' | 'collected'>(
    params.tab === 'collected' ? 'collected' : 'binder',
  );
  const [owned, setOwned] = useState<OwnedCard[] | null>(null);
  const [selected, setSelected] = useState<{ card: Card; copies?: number } | null>(null);
  const [recycling, setRecycling] = useState<string | null>(null);
  const [gain, setGain] = useState<{ cardId: string; amount: number; key: number } | null>(null);
  const [bulkGain, setBulkGain] = useState<{ amount: number; key: number } | null>(null);
  const [requests] = useState(() =>
    createCollectionRequests({ listAllMyCards, listMyPoints, recycleCard, recycleDuplicates }),
  );
  const setRequest = useRef(0);
  const statusRequest = useRef(0);
  const socialPending = useRef(new Set<string>());
  const inspectedLink = useRef<string | null>(null);

  useEffect(() => {
    setOwned(null);
    setSelected(null);
    setGain(null);
    return () => requests.invalidate();
  }, [slug, user, requests]);

  useEffect(() => {
    const key = `${slug}:${params.card ?? ''}`;
    if (!params.card) inspectedLink.current = null;
    if (!params.card || set?.slug !== slug || inspectedLink.current === key) return;
    const card = set.cards.find((item) => item.id === params.card);
    if (card) {
      inspectedLink.current = key;
      setSelected({ card });
    }
  }, [slug, params.card, set]);

  useEffect(() => {
    const request = ++setRequest.current;
    const cacheKey = `set:${slug}`;
    setSet(null);
    setStatus(null);
    setError(null);
    void readPublicCache<CardSetDetail>(cacheKey).then((cached) => {
      if (setRequest.current === request && cached) setSet(cached);
    });
    getPublicSet(slug, false)
      .then((next) => {
        void writePublicCache(cacheKey, next);
        if (setRequest.current === request) setSet(next);
      })
      .catch((e: Error) => {
        if (setRequest.current === request) setError(e.message);
      });
  }, [slug]);

  useEffect(() => {
    if (loading || !user) return;
    const detailRequest = ++setRequest.current;
    const packRequest = ++statusRequest.current;
    getPublicSet(slug)
      .then((next) => {
        if (setRequest.current === detailRequest) {
          setSet(next);
          setError(null);
        }
      })
      .catch(() => undefined);
    getPackStatus(slug)
      .then((next) => {
        if (statusRequest.current === packRequest) setStatus(next);
      })
      .catch((e: Error) => {
        if (statusRequest.current === packRequest) setError(e.message);
      });
  }, [loading, slug, user]);

  useEffect(() => {
    if (tab !== 'collected' || !user || owned !== null) return;
    void requests.loadCards(slug, setOwned, (e) => {
      setOwned([]);
      setError(e instanceof Error ? e.message : 'Could not load your cards.');
    });
  }, [owned, slug, tab, user, requests]);

  const open = useCallback(
    async (usePoints: PackPayment) => {
      if (openingPending.current) return false;
      openingPending.current = true;
      setBusy(true);
      setError(null);
      try {
        const result = await openPack(slug, usePoints);
        setOpening(result);
        setStatus(result.status);
        requests.invalidate();
        setOwned(null);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not open the pack.');
        return false;
      } finally {
        openingPending.current = false;
        setBusy(false);
      }
    },
    [slug, requests],
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

  const followContinued = useRef(false);
  useEffect(() => {
    if (followContinued.current || params[CONTINUE_PARAM] !== FOLLOW_SET_ACTION) return;
    if (!user || !set || set.following) return;
    followContinued.current = true;
    router.setParams({ [CONTINUE_PARAM]: undefined });
    void followSet(set.slug, true).then((r) =>
      setSet((current) =>
        current
          ? { ...current, following: r.following, follower_count: r.follower_count }
          : current,
      ),
    );
  }, [params, set, user]);

  async function recycle(copy: OwnedCard) {
    await requests.recycle(
      copy.id,
      (result) => {
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
        setTimeout(
          () => setGain((current) => (current?.key === nextGain.key ? null : current)),
          750,
        );
      },
      (e) => setError(e instanceof Error ? e.message : 'Could not recycle.'),
      (busy) => {
        setRecycling(busy ? copy.id : null);
        if (busy) setError(null);
      },
    );
  }

  async function recycleAll() {
    if (!set) return;
    await requests.recycleAll(
      set.slug,
      set.slug,
      (result) => {
        setOwned(result.cards);
      },
      (e) => setError(e instanceof Error ? e.message : 'Could not recycle.'),
      (busy) => {
        setRecycling(busy ? 'all' : null);
        if (busy) setError(null);
      },
      (result) => {
        setStatus((current) => (current ? { ...current, points: result.points } : current));
        if (!result.earned) return;
        const nextGain = { amount: result.earned, key: Date.now() };
        setBulkGain(nextGain);
        setTimeout(
          () => setBulkGain((current) => (current?.key === nextGain.key ? null : current)),
          750,
        );
      },
    );
  }

  async function toggleSetLike() {
    if (!set) return;
    if (!user) {
      router.push(loginRoute(`/sets/${set.slug}`));
      return;
    }
    if (socialPending.current.has('set-like')) return;
    const next = !set.liked;
    socialPending.current.add('set-like');
    setSet((current) =>
      current
        ? { ...current, liked: next, like_count: current.like_count + (next ? 1 : -1) }
        : current,
    );
    try {
      const result = await likeSet(set.slug, next);
      setSet((current) =>
        current ? { ...current, liked: result.liked, like_count: result.like_count } : current,
      );
    } catch (e) {
      setSet((current) =>
        current
          ? { ...current, liked: !next, like_count: current.like_count + (next ? -1 : 1) }
          : current,
      );
      setError(e instanceof Error ? e.message : 'Could not update like.');
    } finally {
      socialPending.current.delete('set-like');
    }
  }

  const creatorName = set?.creator.username ?? '';
  const creatorIsMe = user?.profile.username === creatorName;
  const creatorGone = set?.creator.deleted ?? true;
  useEffect(() => {
    if (!user || !creatorName || creatorIsMe || creatorGone) {
      setCreatorFollowing(null);
      return;
    }
    getProfile(creatorName)
      .then((profile) => setCreatorFollowing(profile.is_following))
      .catch(() => setCreatorFollowing(null));
  }, [user, creatorName, creatorIsMe, creatorGone]);

  async function changeCreatorFollow(next: boolean) {
    setCreatorFollowing(next);
    try {
      const result = await setFollow(creatorName, next);
      setCreatorFollowing(result.following);
    } catch (e) {
      setCreatorFollowing(!next);
      setError(e instanceof Error ? e.message : 'Could not update follow.');
    }
  }

  // No hover on a phone, so unfollowing asks first instead of revealing an x.
  function toggleCreatorFollow() {
    if (!set) return;
    if (!user) {
      router.push(loginRoute(`/sets/${set.slug}`));
      return;
    }
    if (!creatorFollowing) {
      void changeCreatorFollow(true);
      return;
    }
    Alert.alert(`Unfollow @${creatorName}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unfollow', style: 'destructive', onPress: () => void changeCreatorFollow(false) },
    ]);
  }

  async function toggleSetFollow() {
    if (!set) return;
    if (!user) {
      router.push(loginRoute(`/sets/${set.slug}`, FOLLOW_SET_ACTION));
      return;
    }
    if (socialPending.current.has('set-follow')) return;
    const next = !set.following;
    socialPending.current.add('set-follow');
    setSet((current) =>
      current
        ? { ...current, following: next, follower_count: current.follower_count + (next ? 1 : -1) }
        : current,
    );
    try {
      const result = await followSet(set.slug, next);
      setSet((current) =>
        current
          ? { ...current, following: result.following, follower_count: result.follower_count }
          : current,
      );
    } catch (e) {
      setSet((current) =>
        current
          ? {
              ...current,
              following: !next,
              follower_count: current.follower_count + (next ? -1 : 1),
            }
          : current,
      );
      setError(e instanceof Error ? e.message : 'Could not update follow.');
    } finally {
      socialPending.current.delete('set-follow');
    }
  }

  async function toggleCardLike(cardId: string) {
    if (!set || !user || socialPending.current.has(cardId)) return;
    const next = !set.liked_card_ids.includes(cardId);
    socialPending.current.add(cardId);
    setSet((current) =>
      current
        ? {
            ...current,
            liked_card_ids: next
              ? [...current.liked_card_ids, cardId]
              : current.liked_card_ids.filter((id) => id !== cardId),
            cards: current.cards.map((card) =>
              card.id === cardId
                ? { ...card, like_count: card.like_count + (next ? 1 : -1) }
                : card,
            ),
          }
        : current,
    );
    try {
      const result = await likeCard(cardId, next);
      setSet((current) =>
        current
          ? {
              ...current,
              liked_card_ids: result.liked
                ? [...new Set([...current.liked_card_ids, cardId])]
                : current.liked_card_ids.filter((id) => id !== cardId),
              cards: current.cards.map((card) =>
                card.id === cardId ? { ...card, like_count: result.like_count } : card,
              ),
            }
          : current,
      );
    } catch (e) {
      setSet((current) =>
        current
          ? {
              ...current,
              liked_card_ids: next
                ? current.liked_card_ids.filter((id) => id !== cardId)
                : [...current.liked_card_ids, cardId],
              cards: current.cards.map((card) =>
                card.id === cardId
                  ? { ...card, like_count: card.like_count + (next ? -1 : 1) }
                  : card,
              ),
            }
          : current,
      );
      setError(e instanceof Error ? e.message : 'Could not update like.');
    } finally {
      socialPending.current.delete(cardId);
    }
  }

  if (error && !set) return <ErrorText>{error}</ErrorText>;
  if (!set) return <Loading />;

  const cardWidth = Math.min(
    160,
    Math.max(128, (viewportWidth - insets.left - insets.right - 46) / 2),
  );
  const collected = stackOwnedCards(owned ?? []);

  const cover = set.cover?.url ?? set.cards[0]?.image.url ?? null;
  const tabs = [
    { value: 'binder' as const, label: 'Binder' },
    { value: 'all' as const, label: 'All cards' },
    ...(user ? [{ value: 'collected' as const, label: 'Collected' }] : []),
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: 14,
        gap: 14,
        paddingLeft: 14 + insets.left,
        paddingRight: 14 + insets.right,
        paddingBottom: 40 + insets.bottom,
      }}
    >
      <Panel>
        <View style={styles.identity}>
          <View style={styles.sleeve}>
            {cover ? (
              <Image source={{ uri: cover }} style={styles.coverImage} />
            ) : (
              <Text style={styles.coverLetter}>{set.title[0]}</Text>
            )}
          </View>
          <View style={styles.identityText}>
            {set.status === 'draft' ? (
              <View style={styles.topline}>
                <Tag>Draft preview</Tag>
              </View>
            ) : null}
            <Text accessibilityRole="header" style={styles.setTitle}>
              {set.title}
            </Text>
            <Muted style={styles.small}>
              {countOf(set.card_count, 'card')} · {countOf(set.opening_count, 'pack')} opened
            </Muted>
            <View style={styles.metaRow}>
              {set.creator.deleted ? (
                <Muted>{personHandle(set.creator)}</Muted>
              ) : (
                <Pressable
                  accessibilityRole="link"
                  onPress={() =>
                    router.push({
                      pathname: '/users/[username]',
                      params: { username: set.creator.username },
                    })
                  }
                  style={styles.creatorLink}
                >
                  <Avatar person={set.creator} size={22} />
                  <Text numberOfLines={1} style={styles.creator}>
                    {personName(set.creator)}
                  </Text>
                  <SupporterEmblem tier={set.creator.supporter_tier} size={14} />
                </Pressable>
              )}
              {creatorFollowing !== null || (!user && !set.creator.deleted) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${creatorFollowing ? 'Unfollow' : 'Follow'} @${set.creator.username}`}
                  onPress={toggleCreatorFollow}
                  style={({ pressed }) => [
                    styles.creatorFollow,
                    creatorFollowing && styles.creatorFollowing,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather
                    name={creatorFollowing ? 'user-check' : 'user-plus'}
                    size={15}
                    color={creatorFollowing ? colors.accent : colors.muted}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
        {set.description ? <Description text={set.description} /> : null}
        {set.tags.length ? <TagChips tags={set.tags} label={`Tags on ${set.title}`} /> : null}
        {set.status === 'published' ? (
          <>
            <View style={styles.social}>
              <ActionChip
                icon={set.following ? 'check' : 'package'}
                label={set.following ? 'Following' : 'Follow set'}
                count={set.follower_count || undefined}
                tone={set.following ? 'on' : 'plain'}
                onPress={() => void toggleSetFollow()}
              />
              <ActionChip
                icon="heart"
                count={set.like_count}
                tone={set.liked ? 'liked' : 'plain'}
                accessibilityLabel={`${set.liked ? 'Unlike' : 'Like'} ${set.title}`}
                onPress={() => void toggleSetLike()}
              />
              <ShareButton path={setPath(set.slug)} title={set.title} />
              <MoreButton
                title={set.title}
                items={
                  user && user.profile.username !== set.creator.username
                    ? [
                        {
                          label: 'Report this set',
                          icon: 'flag',
                          onSelect: () => setReporting(true),
                        },
                      ]
                    : []
                }
              />
            </View>
            {!set.following ? (
              <Muted style={styles.small}>
                Follow this set to get a free pack from it every day.
              </Muted>
            ) : null}
            <ReportSheet
              visible={reporting}
              subject="this set"
              target={{ set_slug: set.slug }}
              onClose={() => setReporting(false)}
            />
          </>
        ) : null}
      </Panel>

      {set.status === 'published' ? (
        <Panel plain>
          <PanelTitle>Open a pack</PanelTitle>
          <View style={styles.packRow}>
            <View style={styles.packActions}>
              <Muted style={styles.small}>
                {countOf(status?.pack_size ?? set.pack_size, 'card')} per pack
              </Muted>
              {!user ? (
                <Button
                  title="Log in to open"
                  onPress={() => router.push(loginRoute(`/sets/${slug}`, PACK_ACTION))}
                />
              ) : status ? (
                <>
                  {status.free_available ? (
                    <Button
                      title="Open free pack"
                      disabled={busy}
                      onPress={() => void open(false)}
                    />
                  ) : (
                    <Muted style={styles.small}>Free pack opened. Back tomorrow.</Muted>
                  )}
                  {status.points >= status.pack_cost ? (
                    <Button
                      title={`Spend ${status.pack_cost} points`}
                      kind="secondary"
                      disabled={busy}
                      onPress={() => void open(true)}
                    />
                  ) : null}
                </>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open a ${set.title} pack`}
              disabled={busy || (!!user && !status)}
              onPress={openFromPack}
              style={({ pressed }) => [styles.packPress, pressed && { opacity: 0.82 }]}
            >
              <View pointerEvents="none">
                <PackPreview set={set} width={112} />
              </View>
            </Pressable>
          </View>
          {status?.monetization_enabled ? (
            <ExtraPackAction
              slug={slug}
              points={status.points}
              packCost={status.pack_cost}
              busy={busy}
              onOpen={open}
            />
          ) : null}
          {status ? (
            <View style={styles.points}>
              <Text style={styles.pointsText}>
                {status.points >= status.pack_cost
                  ? `${status.points} set points saved`
                  : `${status.points}/${status.pack_cost} set points`}
              </Text>
              {bulkGain ? <PointGain key={bulkGain.key} amount={bulkGain.amount} /> : null}
            </View>
          ) : null}
          <ErrorText>{error}</ErrorText>
        </Panel>
      ) : null}

      <Panel>
        <Segmented fill options={tabs} value={tab} onChange={setTab} label="Show" />

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
        ) : null}

        {tab === 'collected' ? (
          <>
            <Muted style={styles.small}>
              {owned === null
                ? 'Loading'
                : `${collected.length} of ${set.card_count} · ${countOf(owned.length, 'copy', 'copies')}`}
            </Muted>
            {owned && spareCount(owned) > 0 ? (
              <Button
                title={
                  recycling === 'all' ? 'Recycling…' : `Recycle all spares (${spareCount(owned)})`
                }
                kind="secondary"
                small
                style={styles.recycleAll}
                disabled={recycling !== null}
                onPress={() => void recycleAll()}
              />
            ) : null}
            {owned === null ? (
              <Loading />
            ) : collected.length === 0 ? (
              <Muted>Open a pack to start collecting this set.</Muted>
            ) : (
              <View style={styles.grid}>
                {collected.map((copy) => (
                  <View key={copy.card.id} style={[styles.collectedCard, { width: cardWidth }]}>
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
                        <View style={styles.recycleControl}>
                          {copy.held ? (
                            <Muted style={{ fontSize: 13 }}>In a pending trade</Muted>
                          ) : copy.copies > 1 ? (
                            <Pressable
                              disabled={recycling !== null}
                              onPress={() => void recycle(copy)}
                              style={({ pressed }) => [
                                styles.recycle,
                                (pressed || recycling === copy.id) && { opacity: 0.55 },
                              ]}
                            >
                              <Text style={styles.recycleText}>Recycle (×{copy.copies})</Text>
                            </Pressable>
                          ) : null}
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
          </>
        ) : null}
      </Panel>

      {set.status === 'published' ? <Comments slug={set.slug} /> : null}

      {opening ? (
        <PackReveal
          opening={opening}
          onClose={() => {
            setOpening(null);
            void askForPackReminder()
              .then(getMyPacks)
              .then((page) => syncPackReminder(page.results))
              .catch(() => {});
          }}
        />
      ) : null}
      {selected ? (
        <InspectorModal open onClose={() => setSelected(null)}>
          <CardInspector
            card={selected.card}
            setTitle={set.title}
            setSlug={set.slug}
            mark={set.mark}
            packColour={set.pack_colour}
            creator={set.creator}
            copies={selected.copies}
            actions={
              set.status === 'published' ? (
                <InspectorActions
                  card={selected.card}
                  set={set}
                  liked={set.liked_card_ids.includes(selected.card.id)}
                  likeCount={
                    set.cards.find((entry) => entry.id === selected.card.id)?.like_count ?? 0
                  }
                  onLike={
                    user
                      ? () => {
                          void toggleCardLike(selected.card.id).catch((e: Error) =>
                            setError(e.message),
                          );
                        }
                      : undefined
                  }
                />
              ) : undefined
            }
            onClose={() => setSelected(null)}
          />
        </InspectorModal>
      ) : null}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  small: { fontSize: 14 },
  identity: { flexDirection: 'row', gap: 14 },
  identityText: { flex: 1, gap: 4 },
  sleeve: {
    width: 84,
    aspectRatio: 5 / 7,
    padding: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.bdr2,
    backgroundColor: colors.sur2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: { width: '100%', height: '100%', borderRadius: 4 },
  coverLetter: { color: colors.muted, fontFamily: fonts.display, fontSize: 30 },
  setTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  topline: { flexDirection: 'row' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  creatorLink: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  creator: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 15 },
  creatorFollow: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.bdr2,
  },
  creatorFollowing: { borderColor: colors.accent },
  social: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  packActions: { flex: 1, gap: 10 },
  packPress: { alignItems: 'center' },
  points: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  pointsText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
  recycleAll: { alignSelf: 'flex-start' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  collectedCard: { alignItems: 'center', gap: 5 },
  recycleRow: { minHeight: 29, alignItems: 'center', justifyContent: 'center' },
  recycleAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recycleControl: { alignItems: 'center', justifyContent: 'center' },
  gainSlot: { position: 'absolute', left: '100%', marginLeft: 4, justifyContent: 'center' },
  recycle: {
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recycleText: { color: colors.muted, fontSize: 13 },
}));
