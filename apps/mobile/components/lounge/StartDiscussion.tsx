import { useEffect, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Switch, Text, View, useWindowDimensions } from 'react-native';
import type {
  LoungeFeed,
  LoungePost,
  LoungeStyle,
  LoungeTopic,
  OwnedCard,
} from '@miscellary/shared';
import { LOUNGE_TOPICS, cardCode } from '@miscellary/shared';
import CardPreview from '@/components/CardPreview';
import FilterField from '@/components/FilterField';
import { Button, ErrorText, Input, Muted } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { listMyCards } from '@/lib/endpoints';
import { createThemedStyles, fonts, useColors } from '@/lib/theme';
import { useMutation } from './actions';
import { RULES, lounge } from './store';

export default function StartDiscussion() {
  const colors = useColors();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const [subscriber, setSubscriber] = useState(Boolean(lounge.subscriber));
  const maxCards = subscriber ? 6 : 1;
  const params = useLocalSearchParams<{ topic?: string }>();
  const [topic, setTopic] = useState<LoungeTopic>(
    LOUNGE_TOPICS.find((item) => item.id === params.topic)?.id ?? 'other',
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [style, setStyle] = useState<LoungeStyle>('plain');
  const [accepted, setAccepted] = useState(false);
  const [selected, setSelected] = useState<OwnedCard[]>([]);
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [cardQuery, setCardQuery] = useState('');
  const [cardPage, setCardPage] = useState(1);
  const [cardsNext, setCardsNext] = useState(false);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [cardsRetry, setCardsRetry] = useState(0);
  const posting = useMutation<LoungePost>((post) => {
    lounge.emit({ type: 'posted', post });
    router.replace(`/lounge/${post.id}`);
  });

  useEffect(() => {
    if (lounge.subscriber !== null) return;
    const controller = new AbortController();
    void apiFetch<LoungeFeed>('/api/v1/lounge/', { signal: controller.signal })
      .then((data) => {
        lounge.subscriber = data.subscriber;
        if (!controller.signal.aborted) setSubscriber(data.subscriber);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setCardsLoading(true);
    setCardsError(null);
    const timer = setTimeout(
      () => {
        void listMyCards(undefined, cardPage, {
          query: cardQuery.trim(),
          signal: controller.signal,
        })
          .then((data) => {
            if (controller.signal.aborted) return;
            setCards((current) => (cardPage === 1 ? data.results : [...current, ...data.results]));
            setCardsNext(Boolean(data.next));
          })
          .catch((err: unknown) => {
            if (!controller.signal.aborted)
              setCardsError(err instanceof Error ? err.message : 'Could not load cards.');
          })
          .finally(() => {
            if (!controller.signal.aborted) setCardsLoading(false);
          });
      },
      cardQuery ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cardPage, cardQuery, cardsRetry]);

  const isSelected = (owned: OwnedCard) => selected.some((copy) => copy.id === owned.id);
  // Screen padding, panel padding and borders, then two gaps between three cards.
  const pickWidth = Math.floor((width - 2 * 12 - 2 * 16 - 2 - 2 * 10) / 3);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Start a discussion' }} />
      <View style={styles.panel}>
        <Text style={styles.label}>Topic</Text>
        <View style={styles.topics} accessibilityRole="radiogroup">
          {LOUNGE_TOPICS.map((item) => {
            const active = topic === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setTopic(item.id)}
                style={[styles.topic, active && styles.topicActive]}
              >
                <Text style={[styles.topicText, active && styles.topicTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.label}>Title</Text>
        <Input accessibilityLabel="Title" maxLength={120} value={title} onChangeText={setTitle} />
        <Text style={styles.label}>Your post</Text>
        <Input
          accessibilityLabel="Your post"
          multiline
          maxLength={3000}
          value={body}
          onChangeText={setBody}
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>
          Cards <Text style={styles.hint}>(optional, up to {maxCards})</Text>
        </Text>
        <FilterField
          value={cardQuery}
          onChange={(value) => {
            setCardQuery(value);
            setCardPage(1);
          }}
          label="Find a card in your collection"
          placeholder="Find a card or set"
        />
        <ErrorText>{cardsError}</ErrorText>
        {cardsError ? (
          <Button
            kind="secondary"
            title="Try again"
            onPress={() => setCardsRetry((value) => value + 1)}
          />
        ) : !cardsLoading && !cards.length ? (
          <Muted>
            {cardQuery
              ? 'No cards match that search.'
              : 'Open a pack to start your collection, or post without a card.'}
          </Muted>
        ) : null}
        <View style={styles.picker}>
          {cards.map((owned) => {
            const on = isSelected(owned);
            const full = !on && selected.length >= maxCards;
            return (
              <Pressable
                key={owned.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`${owned.card.title}, ${owned.set_title}`}
                accessibilityState={{ checked: on, disabled: full }}
                disabled={full}
                onPress={() =>
                  setSelected((values) =>
                    on ? values.filter((copy) => copy.id !== owned.id) : [...values, owned],
                  )
                }
                style={[styles.pick, { width: pickWidth }, full && { opacity: 0.45 }]}
              >
                <View style={[styles.pickCard, on && styles.pickCardOn]}>
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
                <Text style={styles.pickTitle} numberOfLines={1}>
                  {owned.card.title}
                </Text>
                <Text style={styles.pickSet} numberOfLines={1}>
                  {owned.set_title}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {cardsLoading && <Muted>Loading cards…</Muted>}
        {cardsNext && !cardsLoading && (
          <Button
            kind="secondary"
            title="More cards"
            onPress={() => setCardPage((value) => value + 1)}
          />
        )}
        {subscriber && selected.length > 1 && (
          <>
            <Text style={styles.label}>Card layout</Text>
            <View style={styles.topics}>
              {(['plain', 'binder'] as const).map((value) => {
                const active = style === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setStyle(value)}
                    style={[styles.topic, active && styles.topicActive]}
                  >
                    <Text style={[styles.topicText, active && styles.topicTextActive]}>
                      {value === 'plain' ? 'Cards' : 'Binder'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      <View style={styles.panel}>
        <Muted>{RULES}</Muted>
        <View style={styles.agree}>
          <Switch
            accessibilityLabel="I agree to the Lounge rules"
            value={accepted}
            onValueChange={setAccepted}
            trackColor={{ true: colors.accent, false: colors.bdr2 }}
            thumbColor={colors.sur}
          />
          <Text style={styles.agreeText}>I agree to the Lounge rules.</Text>
        </View>
        <ErrorText>{posting.error}</ErrorText>
        <Button
          title={posting.busy ? 'Posting…' : 'Post discussion'}
          disabled={posting.busy || !accepted || !title.trim() || !body.trim()}
          onPress={() =>
            void posting.run('/api/v1/lounge/', 'POST', {
              title,
              body,
              topic,
              style: subscriber ? style : 'plain',
              card_ids: selected.map((card) => card.id),
              rules_accepted: accepted,
            })
          }
        />
      </View>
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  panel: {
    padding: 16,
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  label: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  hint: { color: colors.muted, fontFamily: fonts.body },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  topic: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.bdr2,
  },
  topicActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  topicText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
  topicTextActive: { color: colors.accentText },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pick: { gap: 3 },
  pickCard: {
    padding: 2,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  pickCardOn: { borderColor: colors.accent },
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
  pickTitle: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  pickSet: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  agree: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  agreeText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 16 },
}));
