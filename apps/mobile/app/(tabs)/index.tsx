import { useRef, useState } from 'react';
import type { CardSetSummary } from '@miscellary/shared';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BinderCover from '@/components/BinderCover';
import { Button, Chip, ErrorText, Input } from '@/components/ui';
import { useDiscovery } from '@/lib/discovery';
import type { DiscoverySort } from '@/lib/discovery';
import { colors, fonts } from '@/lib/theme';

export default function BrowseScreen() {
  const [sort, setSort] = useState<DiscoverySort>('new');
  const [query, setQuery] = useState('');
  const shelf = useDiscovery(sort);
  const list = useRef<FlatList<CardSetSummary>>(null);
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(width - insets.left - insets.right, 640);
  const columns = contentWidth < 350 || fontScale > 1.3 ? 1 : 2;
  const itemWidth = (contentWidth - 40 - (columns - 1) * 20) / columns;

  function search() {
    const q = query.trim();
    if (q.length < 2) return;
    Keyboard.dismiss();
    router.push({ pathname: '/search', params: { q } });
  }

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
              <Text style={styles.edition}>THE PUBLIC{'\n'}SHELF</Text>
            </View>
            <Text accessibilityRole="header" style={styles.heading}>
              Everything can{'\n'}be a collection.
            </Text>
            <Text style={styles.intro}>
              Small obsessions, carefully collected. Find a binder worth opening.
            </Text>
            <View style={styles.search}>
              <Feather name="search" size={18} color={colors.muted} />
              <Input
                accessibilityLabel="Search sets, cards, and people"
                placeholder="Sets, cards, people…"
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
            <View style={styles.shelfHeader}>
              <View>
                <Text accessibilityRole="header" style={styles.shelfTitle}>
                  On the shelf
                </Text>
                <Text style={styles.total}>
                  {shelf.loading
                    ? 'Finding your next curiosity'
                    : `${shelf.count} ${shelf.count === 1 ? 'binder' : 'binders'} to explore`}
                </Text>
              </View>
              <Feather name="bookmark" size={21} color={colors.gold} />
            </View>
            <View style={styles.filters}>
              <Chip label="Just added" active={sort === 'new'} onPress={() => pickSort('new')} />
              <Chip
                label="Collector favourites"
                active={sort === 'popular'}
                onPress={() => pickSort('popular')}
              />
            </View>
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
            <View accessibilityLabel="Loading binders" style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.stateText}>Looking along the shelf…</Text>
            </View>
          ) : shelf.error ? (
            <View style={styles.empty}>
              <Feather name="wifi-off" size={28} color={colors.muted} />
              <Text style={styles.stateTitle}>The shelf is out of reach</Text>
              <ErrorText>{shelf.error}</ErrorText>
              <Button title="Try again" onPress={shelf.retry} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather name="book-open" size={32} color={colors.cloth} />
              <Text style={styles.stateTitle}>Room for the first collection</Text>
              <Text style={styles.stateText}>
                Published binders will appear here. Have a collection in mind?
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
            <BinderCover set={item} />
          </View>
        )}
        ListFooterComponent={
          shelf.sets.length > 0 ? (
            <View style={styles.footer}>
              {shelf.loadingMore ? (
                <ActivityIndicator
                  accessibilityLabel="Loading more binders"
                  color={colors.accent}
                />
              ) : shelf.moreError ? (
                <>
                  <ErrorText>{shelf.moreError}</ErrorText>
                  <Button title="Retry more binders" kind="secondary" onPress={shelf.loadMore} />
                </>
              ) : shelf.hasMore ? (
                <Button title="More binders" kind="secondary" onPress={shelf.loadMore} />
              ) : (
                <>
                  <Feather name="book-open" size={20} color={colors.cloth} />
                  <Text style={styles.stateText}>You’ve reached the end of this shelf.</Text>
                </>
              )}
              <Text style={styles.progress}>
                {shelf.sets.length} of {shelf.count} binders
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
  shelfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
  },
  shelfTitle: { fontFamily: fonts.display, fontSize: 29, color: colors.text },
  total: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 23 },
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
