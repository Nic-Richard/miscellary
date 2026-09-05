import type { OwnedCard } from '@miscellary/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CardPreview from '@/components/CardPreview';
import { counterOffer, createOffer, getOffer, listMyCards, listUserCards } from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import { Button, ErrorText, Input, Muted, Tag, Title } from '@/components/ui';

function Picker({
  title,
  cards,
  selected,
  onToggle,
}: {
  title: string;
  cards: OwnedCard[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.column}>
      <View style={styles.columnHeader}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{title}</Text>
        <Muted style={{ fontSize: 12 }}>{selected.size} selected</Muted>
      </View>
      <View style={styles.grid}>
        {cards.length === 0 ? <Muted>No cards.</Muted> : null}
        {cards.map((c) => {
          const on = selected.has(c.id);
          const blocked = c.held && !on;
          return (
            <Pressable
              key={c.id}
              disabled={blocked}
              onPress={() => onToggle(c.id)}
              style={[
                styles.pick,
                on && { borderColor: colors.accent },
                blocked && { opacity: 0.35 },
              ]}
            >
              <CardPreview
                width={100}
                title={c.card.title}
                rarity={c.card.rarity}
                imageUrl={c.card.image.url}
                templateKey={c.card.template_key}
                templateConfig={c.card.template_config}
              />
              {c.held ? <Text style={styles.held}>held</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function NewTradeScreen() {
  const params = useLocalSearchParams<{ with?: string; counter?: string }>();
  const [partner, setPartner] = useState(params.with ?? '');
  const [theirs, setTheirs] = useState<OwnedCard[]>([]);
  const [mine, setMine] = useState<OwnedCard[]>([]);
  const [want, setWant] = useState<Set<string>>(new Set());
  const [give, setGive] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      let who = params.with ?? '';
      if (params.counter) {
        const original = await getOffer(params.counter);
        who = original.sender.username;
        setPartner(who);
        setGive(new Set(original.want.map((c) => c.id)));
        setWant(new Set(original.give.map((c) => c.id)));
      }
      if (!who) return;
      const [t, m] = await Promise.all([listUserCards(who), listMyCards()]);
      setTheirs(t.results);
      setMine(m.results);
    })().catch((e: Error) => setError(e.message));
  }, [params.with, params.counter]);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function send() {
    setBusy(true);
    setError(null);
    const body = { recipient: partner, give: [...give], want: [...want], message };
    try {
      if (params.counter) await counterOffer(params.counter, body);
      else await createOffer(body);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the offer.');
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
    >
      <Tag>{params.counter ? 'Counter offer' : 'New offer'}</Tag>
      <Title>{`Trade with @${partner}`}</Title>
      <ErrorText>{error}</ErrorText>
      <Picker
        title={`@${partner}'s cards you want`}
        cards={theirs}
        selected={want}
        onToggle={(id) => toggle(want, setWant, id)}
      />
      <Picker
        title="Your cards to give"
        cards={mine}
        selected={give}
        onToggle={(id) => toggle(give, setGive, id)}
      />
      <Input
        placeholder="Message (optional)"
        value={message}
        onChangeText={setMessage}
        maxLength={200}
      />
      <Button
        title={busy ? 'Sending…' : params.counter ? 'Send counter offer' : 'Send offer'}
        disabled={busy || (want.size === 0 && give.size === 0)}
        onPress={() => void send()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  column: {
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  columnHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pick: { borderWidth: 2, borderColor: 'transparent', borderRadius: 10, padding: 2 },
  held: {
    position: 'absolute',
    top: 6,
    left: 6,
    color: colors.faint,
    fontSize: 10,
    backgroundColor: colors.bg,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});
