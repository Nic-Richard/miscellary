import { useEffect, useRef, useState } from 'react';
import { cardCode } from '@miscellary/shared';
import type { CardSetDetail } from '@miscellary/shared';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import CardPreview from '@/components/CardPreview';
import SetTile from '@/components/SetTile';
import { BinderTabs, Board, Button, ErrorText, Input, Panel } from '@/components/ui';
import { getPublicSet } from '@/lib/endpoints';
import { useDiscovery } from '@/lib/discovery';
import { readPublicCache, writePublicCache } from '@/lib/publicCache';
import type { DiscoverySort } from '@/lib/discovery';
import { fonts, useColors, createThemedStyles } from '@/lib/theme';

const FEATURED_SET = 'film-cameras';
const SORTS = [
  { value: 'top', label: 'Top' },
  { value: 'new', label: 'New' },
  { value: 'hot', label: 'Hot' },
] as const;
const GRID_GAP = 12;
// How close to the bottom, in points, before the next page of sets loads.
const MORE_AHEAD = 500;

export default function BrowseScreen() {
  const colors = useColors();
  const styles = useStyles();
  const [sort, setSort] = useState<DiscoverySort>('new');
  const [query, setQuery] = useState('');
  const [featured, setFeatured] = useState<CardSetDetail | null>(null);
  const shelf = useDiscovery(sort);
  const list = useRef<ScrollView>(null);
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(width - insets.left - insets.right, 640);
  const columns = contentWidth < 350 || fontScale > 1.3 ? 1 : 2;
  // Page padding, board border and board padding on both sides, then the gaps between columns.
  const itemWidth = (contentWidth - 28 - 2 - 24 - (columns - 1) * GRID_GAP) / columns;
  const featuredSlug =
    shelf.sets.find((set) => set.slug.startsWith(FEATURED_SET))?.slug ?? shelf.sets[0]?.slug;

  function search() {
    const q = query.trim();
    if (q.length < 2) return;
    Keyboard.dismiss();
    router.push({ pathname: '/search', params: { q } });
  }

  useEffect(() => {
    if (!featuredSlug) return;
    let live = true;
    const cacheKey = `set:${featuredSlug}`;
    void (async () => {
      const cached = await readPublicCache<CardSetDetail>(cacheKey);
      if (!live) return;
      if (cached) setFeatured(cached);
      try {
        const detail = await getPublicSet(featuredSlug, false);
        void writePublicCache(cacheKey, detail);
        if (live) setFeatured(detail);
      } catch {
        if (live && !cached) setFeatured(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [featuredSlug]);

  function pickSort(next: DiscoverySort) {
    if (next === sort) return;
    list.current?.scrollTo({ y: 0, animated: false });
    setSort(next);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView
        ref={list}
        style={[styles.list, { width: contentWidth }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={200}
        onScroll={({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
          const near =
            layoutMeasurement.height + contentOffset.y >= contentSize.height - MORE_AHEAD;
          if (near && !shelf.moreError && !shelf.error) shelf.loadMore();
        }}
        refreshControl={
          <RefreshControl
            refreshing={shelf.refreshing}
            onRefresh={shelf.refresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
            progressBackgroundColor={colors.sur}
          />
        }
      >
        <View style={styles.masthead}>
          <View style={styles.brand}>
            <Feather name="book-open" size={25} color={colors.accent} />
            <Text style={styles.wordmark}>MISCELLARY</Text>
          </View>
          <Text style={styles.edition}>Collect, trade, create</Text>
        </View>

        <Panel>
          <Text accessibilityRole="header" style={styles.heading}>
            Turn collections into trading cards.
          </Text>
          <Text style={styles.intro}>
            Make your own set, open a free pack from every set you follow each day, and trade for
            the ones you are missing.
          </Text>
          <View style={styles.search}>
            <Feather name="search" size={18} color={colors.muted} />
            <Input
              accessibilityLabel="Search sets, cards, subjects and collectors"
              placeholder="Sets, cards, collectors"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              onSubmitEditing={search}
              style={styles.searchInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search"
              accessibilityState={{ disabled: query.trim().length < 2 }}
              disabled={query.trim().length < 2}
              onPress={search}
              style={({ pressed }) => [
                styles.searchButton,
                { opacity: query.trim().length < 2 ? 0.4 : pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="arrow-right" size={20} color={colors.accentInk} />
            </Pressable>
          </View>
        </Panel>

        {featured && featured.cards.length ? (
          <Panel>
            <View style={styles.bandHead}>
              <View style={{ flexShrink: 1 }}>
                <Text accessibilityRole="header" style={styles.bandTitle}>
                  Inside a set
                </Text>
                <Text style={styles.bandNote} numberOfLines={1}>
                  {featured.title} · {featured.card_count} cards
                </Text>
              </View>
              <Button
                title="Open it"
                kind="quiet"
                small
                onPress={() =>
                  router.push({ pathname: '/sets/[slug]', params: { slug: featured.slug } })
                }
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bandRow}
            >
              {featured.cards.slice(0, 8).map((card) => (
                <Pressable
                  key={card.id}
                  accessibilityRole="link"
                  accessibilityLabel={card.title}
                  onPress={() =>
                    router.push({ pathname: '/sets/[slug]', params: { slug: featured.slug } })
                  }
                  style={({ pressed }) => pressed && { opacity: 0.85 }}
                >
                  <CardPreview
                    width={96}
                    title={card.title}
                    rarity={card.rarity}
                    printedText={card.printed_text}
                    code={cardCode(card.printed_set_code, card.position, card.set_total)}
                    imageUrl={card.image.url}
                    templateKey={card.template_key}
                    templateConfig={card.template_config}
                    mark={featured.mark}
                    render={card.render}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </Panel>
        ) : null}

        <View>
          <BinderTabs label="Sort sets" options={SORTS} value={sort} onChange={pickSort} />
          <Board style={styles.board}>
            <Text style={styles.total}>
              {shelf.loading
                ? 'Looking for sets…'
                : `${shelf.count} published ${shelf.count === 1 ? 'set' : 'sets'}`}
            </Text>
            {shelf.error && shelf.sets.length > 0 ? (
              <View style={styles.notice}>
                <ErrorText>{shelf.error}</ErrorText>
                <Button title="Try again" kind="secondary" onPress={shelf.refresh} />
              </View>
            ) : null}
            {shelf.sets.length === 0 ? (
              shelf.loading ? (
                <View accessibilityLabel="Loading sets" style={styles.loading}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              ) : shelf.error ? (
                <View style={styles.empty}>
                  <Text style={styles.stateTitle}>Cannot reach the catalogue</Text>
                  <ErrorText>{shelf.error}</ErrorText>
                  <Button title="Try again" onPress={shelf.retry} />
                </View>
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.stateTitle}>Room for the first collection</Text>
                  <Text style={styles.stateText}>
                    Published sets will appear here. Have a collection in mind?
                  </Text>
                  <Button
                    title="Visit Studio"
                    kind="secondary"
                    onPress={() => router.push('/(tabs)/studio')}
                  />
                </View>
              )
            ) : (
              <View style={styles.grid}>
                {shelf.sets.map((set) => (
                  <View key={set.id} style={{ width: itemWidth }}>
                    <SetTile set={set} />
                  </View>
                ))}
              </View>
            )}
            {shelf.sets.length > 0 ? (
              <View style={styles.footer}>
                {shelf.loadingMore ? (
                  <ActivityIndicator accessibilityLabel="Loading more sets" color={colors.accent} />
                ) : shelf.moreError ? (
                  <>
                    <ErrorText>{shelf.moreError}</ErrorText>
                    <Button title="Retry more sets" kind="secondary" onPress={shelf.loadMore} />
                  </>
                ) : shelf.hasMore ? (
                  <Button title="More sets" kind="secondary" onPress={shelf.loadMore} />
                ) : (
                  <Text style={styles.stateText}>That is every published set.</Text>
                )}
                <Text style={styles.stateText}>
                  {shelf.sets.length} of {shelf.count} sets
                </Text>
              </View>
            ) : null}
          </Board>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { alignSelf: 'center' },
  content: { padding: 14, paddingTop: 0, paddingBottom: 24, gap: 14 },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: colors.bdr2,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wordmark: { fontFamily: fonts.display, fontSize: 28, letterSpacing: 1.7, color: colors.pageText },
  edition: { fontFamily: fonts.body, fontSize: 15, textAlign: 'right', color: colors.pageMuted },
  heading: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    color: colors.text,
    textTransform: 'uppercase',
  },
  intro: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.muted },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 13,
    marginTop: 4,
    backgroundColor: colors.sur2,
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    boxShadow: 'none',
    paddingHorizontal: 10,
  },
  searchButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  bandHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bandTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    textTransform: 'uppercase',
  },
  bandNote: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 2 },
  bandRow: { gap: 10, paddingVertical: 4, paddingRight: 4 },
  board: { padding: 12, gap: 12 },
  total: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  loading: { paddingVertical: 56, alignItems: 'center' },
  empty: { paddingVertical: 12, gap: 12 },
  stateTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
  stateText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.muted },
  notice: { gap: 6 },
  footer: { alignItems: 'center', gap: 12, paddingVertical: 8 },
}));
