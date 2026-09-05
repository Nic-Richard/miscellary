import type { CardSetSummary } from '@miscellary/shared';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import LoginGate from '@/components/LoginGate';
import { createSet, listMySets } from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import { Button, ErrorText, Input, Muted, Tag, Title } from '@/components/ui';

function Studio() {
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
      <Tag>Studio</Tag>
      <Title>Your sets</Title>
      <Input
        placeholder="New set title (e.g. Rocks from the backyard)"
        value={title}
        onChangeText={setTitle}
        maxLength={80}
      />
      <Button title="Create draft" onPress={() => void create()} disabled={!title.trim()} />
      <ErrorText>{error}</ErrorText>
      {sets.length === 0 ? <Muted>No sets yet.</Muted> : null}
      {sets.map((s) => (
        <Link key={s.id} href={{ pathname: '/studio/[id]', params: { id: s.id } }} asChild>
          <Pressable style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{s.title}</Text>
              <Muted style={{ fontSize: 12 }}>{s.card_count} cards</Muted>
            </View>
            <Text
              style={[
                styles.status,
                s.status === 'published' && { color: colors.green, borderColor: colors.green },
              ]}
            >
              {s.status}
            </Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

export default function StudioScreen() {
  return (
    <LoginGate message="Log in to create sets.">
      <Studio />
    </LoginGate>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
