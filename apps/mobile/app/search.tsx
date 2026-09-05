import type { SearchResults } from '@miscellary/shared';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import CardPreview from '@/components/CardPreview';
import { search } from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import { Loading, Muted, Title } from '@/components/ui';

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q: string }>();
  const [results, setResults] = useState<SearchResults | null>(null);

  useEffect(() => {
    if (q)
      search(q)
        .then(setResults)
        .catch(() => setResults(null));
  }, [q]);

  if (!results) return <Loading />;
  const empty = !results.users.length && !results.sets.length && !results.cards.length;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 8 }}
    >
      <Title>{`“${results.query}”`}</Title>
      {empty ? <Muted>No matches.</Muted> : null}
      {results.users.length ? <Text style={styles.h2}>People</Text> : null}
      {results.users.map((u) => (
        <Link
          key={u.username}
          href={{ pathname: '/users/[username]', params: { username: u.username } }}
          style={styles.row}
        >
          <Text style={{ color: colors.accent }}>@{u.username}</Text>
          <Text style={{ color: colors.faint }}> {u.display_name}</Text>
        </Link>
      ))}
      {results.sets.length ? <Text style={styles.h2}>Sets</Text> : null}
      {results.sets.map((s) => (
        <Link
          key={s.id}
          href={{ pathname: '/sets/[slug]', params: { slug: s.slug } }}
          style={styles.row}
        >
          <Text style={{ color: colors.accent }}>{s.title}</Text>
          <Text style={{ color: colors.faint }}>
            {' '}
            {s.card_count} cards · @{s.creator.username}
          </Text>
        </Link>
      ))}
      {results.cards.length ? <Text style={styles.h2}>Cards</Text> : null}
      <View style={styles.grid}>
        {results.cards.map((c) => (
          <Link key={c.id} href={{ pathname: '/sets/[slug]', params: { slug: c.set_slug } }}>
            <CardPreview
              width={150}
              title={c.title}
              rarity={c.rarity}
              imageUrl={c.image.url}
              templateKey={c.template_key}
              templateConfig={c.template_config}
            />
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h2: { color: colors.muted, fontSize: 14, fontWeight: '700', marginTop: 12 },
  row: { paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
