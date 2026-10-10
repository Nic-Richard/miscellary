import { useEffect, useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Switch, Text, View } from 'react-native';
import type {
  LoungeFeed,
  LoungePost,
  LoungeStyle,
  LoungeTopic,
  OwnedCard,
} from '@miscellary/shared';
import { LOUNGE_LIMITS, LOUNGE_TOPICS } from '@miscellary/shared';
import SupporterPrompt from '@/components/SupporterPrompt';
import { Button, Chip, ErrorText, Input, Muted, Segmented } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useMembership } from '@/lib/membership';
import { createThemedStyles, fonts, useColors } from '@/lib/theme';
import { useMutation } from './actions';
import CardPicker from './CardPicker';
import { RULES, lounge } from './store';

export default function StartDiscussion() {
  const colors = useColors();
  const styles = useStyles();
  const membership = useMembership();
  const [subscriber, setSubscriber] = useState(Boolean(lounge.subscriber));
  const params = useLocalSearchParams<{ topic?: string }>();
  const [topic, setTopic] = useState<LoungeTopic>(
    LOUNGE_TOPICS.find((item) => item.id === params.topic)?.id ?? 'other',
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [style, setStyle] = useState<LoungeStyle>('plain');
  const [locked, setLocked] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [selected, setSelected] = useState<OwnedCard[]>([]);
  const max = style === 'binder' ? LOUNGE_LIMITS.binderCards : LOUNGE_LIMITS.postCards;
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

  function chooseStyle(next: LoungeStyle) {
    if (next === 'binder' && !subscriber) {
      setLocked(true);
      return;
    }
    setLocked(false);
    setStyle(next);
    if (next === 'plain') setSelected((cards) => cards.slice(0, LOUNGE_LIMITS.postCards));
  }

  const ready = !posting.busy && accepted && Boolean(title.trim()) && Boolean(body.trim());
  const submit = (draft: boolean) =>
    void posting.run('/api/v1/lounge/', 'POST', {
      title,
      body,
      topic,
      style,
      draft,
      card_ids: selected.map((card) => card.id),
      rules_accepted: accepted,
    });

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
          {LOUNGE_TOPICS.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={topic === item.id}
              onPress={() => setTopic(item.id)}
            />
          ))}
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
          Cards <Text style={styles.hint}>(optional)</Text>
        </Text>
        <Segmented
          label="Card layout"
          options={[
            { value: 'plain', label: 'Cards' },
            {
              value: 'binder',
              label: subscriber || !membership.enabled ? 'Binder' : 'Binder (supporters)',
            },
          ]}
          value={style}
          onChange={chooseStyle}
        />
        {locked && (
          <SupporterPrompt>
            Supporters can fill binder pages with up to {LOUNGE_LIMITS.binderCards} cards.
          </SupporterPrompt>
        )}
        <CardPicker max={max} selected={selected} onChange={setSelected} />
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
          disabled={!ready}
          onPress={() => submit(false)}
        />
        {subscriber && (
          <Button
            kind="secondary"
            title="Save as draft"
            disabled={!ready}
            onPress={() => submit(true)}
          />
        )}
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
  agree: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  agreeText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 16 },
}));
