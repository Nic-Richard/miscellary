import { useEffect, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import type { OwnedCard } from '@miscellary/shared';
import { cardCode } from '@miscellary/shared';
import CardPreview from '@/components/CardPreview';
import FilterField from '@/components/FilterField';
import { Button, ErrorText, Muted } from '@/components/ui';
import { listMyCards } from '@/lib/endpoints';
import { createThemedStyles, fonts, useColors } from '@/lib/theme';

const GAP = 10;

export default function CardPicker({
  max,
  selected,
  onChange,
}: {
  max: number;
  selected: OwnedCard[];
  onChange: (cards: OwnedCard[]) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = setTimeout(
      () => {
        void listMyCards(undefined, page, { query: query.trim(), signal: controller.signal })
          .then((data) => {
            if (controller.signal.aborted) return;
            setCards((current) => (page === 1 ? data.results : [...current, ...data.results]));
            setHasNext(Boolean(data.next));
          })
          .catch((err: unknown) => {
            if (!controller.signal.aborted)
              setError(err instanceof Error ? err.message : 'Could not load cards.');
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      query ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, query, retry]);

  const isSelected = (owned: OwnedCard) => selected.some((copy) => copy.id === owned.id);
  const pickWidth = width ? Math.floor((width - GAP * 2) / 3) : 0;

  return (
    <View style={styles.picker} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.head}>
        <FilterField
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          label="Find a card in your collection"
          placeholder="Find a card or set"
          style={{ flex: 1 }}
        />
        <Text style={styles.counter}>
          <Text style={styles.counterStrong}>{selected.length}</Text> of {max}
        </Text>
      </View>
      <ErrorText>{error}</ErrorText>
      {error ? (
        <Button kind="secondary" title="Try again" onPress={() => setRetry((value) => value + 1)} />
      ) : !loading && !cards.length ? (
        <Muted>
          {query ? 'No cards match that search.' : 'Open a pack to start your collection.'}
        </Muted>
      ) : null}
      <View style={styles.grid}>
        {pickWidth > 0 &&
          cards.map((owned) => {
            const on = isSelected(owned);
            const full = !on && selected.length >= max;
            return (
              <Pressable
                key={owned.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`${owned.card.title}, ${owned.set_title}`}
                accessibilityState={{ checked: on, disabled: full }}
                disabled={full}
                onPress={() =>
                  onChange(
                    on ? selected.filter((copy) => copy.id !== owned.id) : [...selected, owned],
                  )
                }
                style={[{ width: pickWidth, gap: 3 }, full && { opacity: 0.45 }]}
              >
                <View style={[styles.card, on && styles.cardOn]}>
                  <CardPreview
                    width={pickWidth - 8}
                    title={owned.card.title}
                    rarity={owned.card.rarity}
                    imageUrl={owned.card.image?.url ?? null}
                    templateKey={owned.card.template_key}
                    templateConfig={owned.card.template_config}
                    code={cardCode(
                      owned.card.printed_set_code,
                      owned.card.position,
                      owned.card.set_total,
                    )}
                    printedText={owned.card.printed_text}
                    render={owned.card.render}
                  />
                  {on && (
                    <View style={styles.check}>
                      <Feather name="check" size={14} color={colors.accentText} />
                    </View>
                  )}
                </View>
                <Text style={styles.title} numberOfLines={1}>
                  {owned.card.title}
                </Text>
                <Text style={styles.set} numberOfLines={1}>
                  {owned.set_title}
                </Text>
              </Pressable>
            );
          })}
      </View>
      {loading && <Muted>Loading cards…</Muted>}
      {hasNext && !loading && (
        <Button kind="secondary" title="More cards" onPress={() => setPage((value) => value + 1)} />
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  picker: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  counter: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  counterStrong: { color: colors.text, fontFamily: fonts.medium },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: {
    padding: 2,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  cardOn: { borderColor: colors.accent },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  title: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  set: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
}));
