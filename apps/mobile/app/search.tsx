import type { SearchResults, TagSummary } from '@miscellary/shared';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { cardCode, personHandle } from '@miscellary/shared';
import CardPreview from '@/components/CardPreview';
import FilterField from '@/components/FilterField';
import { listTags, search } from '@/lib/endpoints';
import { readPublicCache, writePublicCache } from '@/lib/publicCache';
import { useColors, createThemedStyles, fonts } from '@/lib/theme';
import { Chip, ErrorText, Loading, Muted, Panel, PanelTitle } from '@/components/ui';

const SUBJECTS = 12;

export default function SearchScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const query = q?.trim() ?? '';
  const [draft, setDraft] = useState(query);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [subjects, setSubjects] = useState<TagSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Typing settles for a moment before it becomes the searched query.
  useEffect(() => {
    const next = draft.trim();
    if (next === query) return;
    const timer = setTimeout(() => router.setParams({ q: next }), 350);
    return () => clearTimeout(timer);
  }, [draft, query]);

  useEffect(() => {
    if (query) return;
    void listTags()
      .then((tags) =>
        setSubjects([...tags].sort((a, b) => b.set_count - a.set_count).slice(0, SUBJECTS)),
      )
      .catch(() => undefined);
  }, [query]);

  useEffect(() => {
    setResults(null);
    setError(null);
    if (query.length < 2) return;
    let active = true;
    const cacheKey = `search:${query.toLowerCase()}`;
    void (async () => {
      const cached = await readPublicCache<SearchResults>(cacheKey);
      if (!active) return;
      if (cached) setResults(cached);
      try {
        const next = await search(query);
        void writePublicCache(cacheKey, next);
        if (active) setResults(next);
      } catch (err) {
        if (active && !cached)
          setError(err instanceof Error ? err.message : 'Search is unavailable right now.');
      }
    })();
    return () => {
      active = false;
    };
  }, [query]);

  const empty = results && !results.users.length && !results.sets.length && !results.cards.length;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <FilterField
        value={draft}
        onChange={setDraft}
        placeholder="Sets, cards, collectors"
        label="Search sets, cards, subjects and collectors"
      />
      {query.length < 2 ? (
        subjects.length > 0 && (
          <Panel>
            <PanelTitle>Popular subjects</PanelTitle>
            <View style={styles.chips}>
              {subjects.map((tag) => (
                <Chip
                  key={tag.slug}
                  label={tag.label}
                  count={tag.set_count}
                  active={false}
                  onPress={() => setDraft(tag.label)}
                />
              ))}
            </View>
          </Panel>
        )
      ) : error ? (
        <ErrorText>{error}</ErrorText>
      ) : !results ? (
        <Loading />
      ) : empty ? (
        <Muted>Nothing matches “{query}”.</Muted>
      ) : (
        <>
          {results.users.length > 0 && (
            <Panel>
              <PanelTitle>Collectors</PanelTitle>
              {results.users.map((u) => (
                <Link
                  key={u.username}
                  href={{ pathname: '/users/[username]', params: { username: u.username } }}
                  style={styles.row}
                >
                  <Text style={styles.link}>@{u.username}</Text>
                  <Text style={styles.meta}> {u.display_name}</Text>
                </Link>
              ))}
            </Panel>
          )}
          {results.sets.length > 0 && (
            <Panel>
              <PanelTitle>Sets</PanelTitle>
              {results.sets.map((s) => (
                <Link
                  key={s.id}
                  href={{ pathname: '/sets/[slug]', params: { slug: s.slug } }}
                  style={styles.row}
                >
                  <Text style={styles.link}>{s.title}</Text>
                  <Text style={styles.meta}>
                    {' '}
                    {s.card_count} cards · {personHandle(s.creator)}
                  </Text>
                </Link>
              ))}
            </Panel>
          )}
          {results.cards.length > 0 && (
            <Panel>
              <PanelTitle>Cards</PanelTitle>
              <View style={styles.grid}>
                {results.cards.map((c) => (
                  <Link
                    key={c.id}
                    href={{ pathname: '/sets/[slug]', params: { slug: c.set_slug } }}
                  >
                    <CardPreview
                      width={150}
                      title={c.title}
                      description={c.description}
                      printedText={c.printed_text}
                      code={cardCode(c.printed_set_code, c.position, c.set_total)}
                      rarity={c.rarity}
                      imageUrl={c.image.url}
                      templateKey={c.template_key}
                      templateConfig={c.template_config}
                      render={c.render}
                    />
                  </Link>
                ))}
              </View>
            </Panel>
          )}
        </>
      )}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  content: { padding: 14, gap: 14, paddingBottom: 40 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { paddingVertical: 6 },
  link: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 16 },
  meta: { color: colors.muted, fontFamily: fonts.body, fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
}));
