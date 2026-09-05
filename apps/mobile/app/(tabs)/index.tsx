import type { CardSetSummary } from '@miscellary/shared';
import { Link, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { listPublicSets } from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import { Chip, ErrorText, Input, Screen } from '@/components/ui';

export default function BrowseScreen() {
  const [sort, setSort] = useState<'new' | 'popular'>('new');
  const [sets, setSets] = useState<CardSetSummary[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setSets((await listPublicSets(sort)).results);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sets.');
    }
  }, [sort]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <Input
        placeholder="Search sets, cards, people"
        value={q}
        onChangeText={setQ}
        returnKeyType="search"
        onSubmitEditing={() =>
          q.trim().length >= 2 && router.push({ pathname: '/search', params: { q: q.trim() } })
        }
      />
      <View style={styles.chips}>
        <Chip label="Newest" active={sort === 'new'} onPress={() => setSort('new')} />
        <Chip label="Popular" active={sort === 'popular'} onPress={() => setSort('popular')} />
      </View>
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={sets}
        keyExtractor={(s) => s.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={<Text style={{ color: colors.muted }}>Nothing published yet.</Text>}
        renderItem={({ item }) => (
          <Link href={{ pathname: '/sets/[slug]', params: { slug: item.slug } }} asChild>
            <Pressable style={styles.set}>
              <View style={styles.cover}>
                {item.cover ? (
                  <Image source={{ uri: item.cover.url }} style={StyleSheet.absoluteFill} />
                ) : null}
              </View>
              <Text style={styles.setTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.setMeta}>
                {item.card_count} cards · ♥ {item.like_count} · @{item.creator.username}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  set: {
    flex: 1,
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cover: { aspectRatio: 4 / 3, backgroundColor: colors.sur2 },
  setTitle: { color: colors.text, fontWeight: '600', paddingHorizontal: 10, paddingTop: 8 },
  setMeta: {
    color: colors.faint,
    fontSize: 11,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 2,
  },
});
