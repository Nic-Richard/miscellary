import { useCallback, useEffect, useRef, useState } from 'react';
import { cardCode } from '@miscellary/shared';
import type { CardSetDetail, CardSetSummary } from '@miscellary/shared';
import { router, useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import CardPreview from '@/components/CardPreview';
import SetTile from '@/components/SetTile';
import { Button, Chip, ErrorText, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getNotifications, getPublicSet } from '@/lib/endpoints';
import { useDiscovery } from '@/lib/discovery';
import type { DiscoverySort } from '@/lib/discovery';
import { colors, fonts } from '@/lib/theme';

const FEATURED_SET = 'film-cameras';

export default function BrowseScreen() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [sort, setSort] = useState<DiscoverySort>('new');
  const [query, setQuery] = useState('');
  const [featured, setFeatured] = useState<CardSetDetail | null>(null);
  const shelf = useDiscovery(sort);
  const list = useRef<FlatList<CardSetSummary>>(null);
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(width - insets.left - insets.right, 640);
  const columns = contentWidth < 350 || fontScale > 1.3 ? 1 : 2;
  const itemWidth = (contentWidth - 40 - (columns - 1) * 20) / columns;
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
    getPublicSet(featuredSlug)
      .then((detail) => {
        if (live) setFeatured(detail);
      })
      .catch(() => {
        if (live) setFeatured(null);
      });
    return () => {
      live = false;
    };
  }, [featuredSlug]);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setUnread(0);
        return;
      }
      getNotifications()
        .then((page) => setUnread(page.unread))
        .catch(() => setUnread(0));
    }, [user]),
  );

  function pickSort(next: DiscoverySort) {
    if (next === sort) return;
    list.current?.scrollToOffset({ offset: 0, animated: false });
    setSort(next);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <FlatList
        ref={list}
        key={columns}
        data={shelf.sets}
        keyExtractor={(set) => set.id}
        numColumns={columns}
        style={[styles.list, { width: contentWidth }]}
        contentContainerStyle={styles.content}
        columnWrapperStyle={columns === 2 ? styles.row : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (!shelf.moreError && !shelf.error) shelf.loadMore();
        }}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            refreshing={shelf.refreshing}
            onRefresh={shelf.refresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
            progressBackgroundColor={colors.sur}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.masthead}>
              <View style={styles.brand}>
                <Feather name="book-open" size={25} color={colors.accent} />
                <Text style={styles.wordmark}>MISCELLARY</Text>
              </View>
              {user ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
                  hitSlop={8}
                  onPress={() => router.push('/notifications')}
                  style={({ pressed }) => [styles.bell, pressed && { opacity: 0.7 }]}
                >
                  <Feather name="bell" size={20} color={colors.muted} />
                  {unread > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                    </View>
                  ) : null}
                </Pressable>
              ) : (
                <Text style={styles.edition}>COLLECT{'\n'}TRADE · CREATE</Text>
              )}
            </View>
            <Text accessibilityRole="header" style={styles.heading}>
              Turn collections{'\n'}into trading cards.
            </Text>
            <Text style={styles.intro}>
              Make your own set, open a free pack from every set each day, and trade for the ones
              you are missing.
            </Text>
            <View style={styles.search}>
              <Feather name="search" size={18} color={colors.muted} />
              <Input
                accessibilityLabel="Search sets, cards, subjects and users"
                placeholder="Sets, cards, users…"
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
                <Feather name="arrow-right" size={20} color={colors.accent} />
              </Pressable>
            </View>

            {featured && featured.cards.length ? (
              <View style={styles.band}>
                <View style={styles.bandHead}>
                  <View style={{ flexShrink: 1 }}>
                    <Text accessibilityRole="header" style={styles.bandTitle}>
                      Inside a set
                    </Text>
                    <Text style={styles.bandNote} numberOfLines={1}>
                      {featured.title} · {featured.card_count} cards
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="link"
                    hitSlop={8}
                    onPress={() =>
                      router.push({ pathname: '/sets/[slug]', params: { slug: featured.slug } })
                    }
                  >
                    <Text style={styles.bandLink}>Open it</Text>
                  </Pressable>
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
              </View>
            ) : null}

            <View style={styles.sectionHead}>
              <View style={{ flexShrink: 1 }}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  Sets
                </Text>
                <Text style={styles.total}>
                  {shelf.loading
                    ? 'Looking for sets…'
                    : `${shelf.count} published ${shelf.count === 1 ? 'set' : 'sets'}`}
                </Text>
              </View>
            </View>
            <View style={styles.filters}>
              <Chip label="Newest" active={sort === 'new'} onPress={() => pickSort('new')} />
              <Chip
                label="Popular"
                active={sort === 'popular'}
                onPress={() => pickSort('popular')}
              />
            </View>
            <View style={styles.filterGap} />
            {shelf.error && shelf.sets.length > 0 ? (
              <View style={styles.notice}>
                <ErrorText>{shelf.error}</ErrorText>
                <Button title="Try again" kind="secondary" onPress={shelf.refresh} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          shelf.loading ? (
            <View accessibilityLabel="Loading sets" style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.stateText}>Looking for sets…</Text>
            </View>
          ) : shelf.error ? (
            <View style={styles.empty}>
              <Feather name="wifi-off" size={28} color={colors.muted} />
              <Text style={styles.stateTitle}>Cannot reach the catalogue</Text>
              <ErrorText>{shelf.error}</ErrorText>
              <Button title="Try again" onPress={shelf.retry} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather name="book-open" size={32} color={colors.cloth} />
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
        }
        renderItem={({ item }) => (
          <View style={[styles.item, { width: itemWidth }]}>
            <SetTile set={item} />
          </View>
        )}
        ListFooterComponent={
          shelf.sets.length > 0 ? (
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
                <>
                  <Feather name="book-open" size={20} color={colors.cloth} />
                  <Text style={styles.stateText}>That is every published set.</Text>
                </>
              )}
              <Text style={styles.progress}>
                {shelf.sets.length} of {shelf.count} sets
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { alignSelf: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 19,
    borderBottomWidth: 1,
    borderColor: colors.bdr2,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  bell: { padding: 6 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 17,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  badgeText: { color: colors.accentText, fontFamily: fonts.medium, fontSize: 10 },
  wordmark: { fontFamily: fonts.display, fontSize: 28, letterSpacing: 1.7, color: colors.text },
  edition: {
    fontFamily: fonts.medium,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.6,
    textAlign: 'right',
    color: colors.muted,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 46,
    color: colors.text,
    marginTop: 23,
  },
  intro: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: colors.muted,
    marginTop: 8,
    maxWidth: 320,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 13,
    marginTop: 20,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 7,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 10,
  },
  searchButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  band: { marginTop: 24 },
  bandHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  bandTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  bandNote: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  bandLink: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  bandRow: { gap: 10, paddingVertical: 12, paddingRight: 4 },
  sectionHead: { marginTop: 26 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 29, color: colors.text },
  total: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  filterGap: { height: 14 },
  row: { gap: 20 },
  item: {
    paddingBottom: 20,
    marginBottom: 21,
    borderBottomWidth: 2,
    borderBottomColor: colors.bdr2,
  },
  loading: { paddingVertical: 56, alignItems: 'center', gap: 14 },
  empty: {
    padding: 24,
    gap: 15,
    marginBottom: 24,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderRadius: 8,
  },
  stateTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
  stateText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.muted },
  notice: {
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 6,
    gap: 6,
  },
  footer: { alignItems: 'center', gap: 12, paddingBottom: 16 },
  progress: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
});
