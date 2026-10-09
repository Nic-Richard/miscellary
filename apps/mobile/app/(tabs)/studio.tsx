import { SET_TITLE_MAX_LENGTH, countOf } from '@miscellary/shared';
import type { CardSetSummary } from '@miscellary/shared';
import Feather from '@expo/vector-icons/Feather';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import LoginGate from '@/components/LoginGate';
import { createSet, listMySets } from '@/lib/endpoints';
import { fonts, useColors, createThemedStyles } from '@/lib/theme';
import { Button, ErrorText, Input, Muted } from '@/components/ui';

const STEPS: [React.ComponentProps<typeof Feather>['name'], string, string][] = [
  [
    'camera',
    'Photograph your things',
    'Each card is one thing you collect: a camera, a rock, a rubber duck.',
  ],
  ['edit-3', 'Make the cards', 'Give each one a title, a few lines of text and a rarity.'],
  [
    'package',
    'Design the pack and publish',
    'Collectors then open a free pack of your set every day.',
  ],
];

function Studio() {
  const colors = useColors();
  const styles = useStyles();
  const [sets, setSets] = useState<CardSetSummary[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      listMySets()
        .then(setSets)
        .catch((e: Error) => setError(e.message));
    }, []),
  );

  async function create() {
    if (!title.trim()) return;
    try {
      const set = await createSet({ title: title.trim(), description: '' });
      setTitle('');
      router.push({ pathname: '/studio/[id]', params: { id: set.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the set.');
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
    >
      <Muted>Your sets. Drafts stay private until you publish.</Muted>
      <Input
        placeholder="New set title (e.g. Rocks from the backyard)"
        value={title}
        onChangeText={setTitle}
        maxLength={SET_TITLE_MAX_LENGTH}
      />
      <Button title="Create draft" onPress={() => void create()} disabled={!title.trim()} />
      <ErrorText>{error}</ErrorText>
      {sets.length === 0 ? (
        <View style={styles.howTo}>
          <Text style={styles.howToTitle}>How a set works</Text>
          {STEPS.map(([icon, title, note], index) => (
            <View key={title} style={styles.step}>
              <View style={styles.stepIcon}>
                <Feather name={icon} size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.stepTitle}>
                  {index + 1}. {title}
                </Text>
                <Muted style={{ fontSize: 14 }}>{note}</Muted>
              </View>
            </View>
          ))}
          <Link
            href={{ pathname: '/sets/[slug]', params: { slug: 'film-cameras' } }}
            style={styles.example}
          >
            See an example set →
          </Link>
        </View>
      ) : null}
      {sets.map((s) => (
        <Link key={s.id} href={{ pathname: '/studio/[id]', params: { id: s.id } }} asChild>
          <Pressable style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{s.title}</Text>
              <Muted style={{ fontSize: 14 }}>{countOf(s.card_count, 'card')}</Muted>
            </View>
            <Text
              style={[
                styles.status,
                s.status === 'published' && { color: colors.green, borderColor: colors.green },
              ]}
            >
              {s.status === 'published' ? 'Published' : 'Draft'}
            </Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

export default function StudioScreen() {
  return (
    <LoginGate note="Photograph the things you collect and turn them into a set of cards.">
      <Studio />
    </LoginGate>
  );
}

const useStyles = createThemedStyles((colors) => ({
  howTo: {
    gap: 14,
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  howToTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.bdr,
  },
  stepTitle: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  example: { color: colors.accent, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
  },
  status: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
}));
