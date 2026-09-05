import type { CardSetDetail } from '@miscellary/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CardPreview from '@/components/CardPreview';
import {
  deleteCard,
  deleteSet,
  getMySet,
  publishProblems,
  publishSet,
  updateSet,
} from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import { Button, ErrorText, Input, Loading, Muted, Tag, Title } from '@/components/ui';

export default function SetEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [set, setSet] = useState<CardSetDetail | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([getMySet(id), publishProblems(id)]);
      setSet(s);
      setTitle(s.title);
      setDescription(s.description);
      setProblems(p.problems);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the set.');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function saveDetails() {
    if (!set) return;
    try {
      setSet(await updateSet(set.id, { title, description }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  function publish() {
    if (!set) return;
    Alert.alert('Publish this set?', 'Cards can never be edited after publishing.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Publish',
        onPress: async () => {
          try {
            setSet(await publishSet(set.id));
            setProblems([]);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not publish.');
          }
        },
      },
    ]);
  }

  function removeCard(cardId: string, cardTitle: string) {
    if (!set) return;
    Alert.alert(`Delete "${cardTitle}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteCard(set.id, cardId).then(load),
      },
    ]);
  }

  function removeSet() {
    if (!set) return;
    Alert.alert('Delete this set?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteSet(set.id).then(() => router.back()),
      },
    ]);
  }

  if (!set) return error ? <ErrorText>{error}</ErrorText> : <Loading />;
  const isDraft = set.status === 'draft';

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
    >
      <Tag>{set.status}</Tag>
      {isDraft ? (
        <>
          <Input
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            style={{ fontSize: 20, fontWeight: '700' }}
          />
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the set (optional)"
            multiline
            maxLength={600}
          />
          <View style={styles.row}>
            <Button title="Save details" kind="secondary" onPress={() => void saveDetails()} />
            <Button title="Delete draft" kind="danger" onPress={removeSet} />
          </View>
        </>
      ) : (
        <>
          <Title>{set.title}</Title>
          <Muted>Published sets are locked.</Muted>
        </>
      )}
      <ErrorText>{error}</ErrorText>

      {isDraft ? (
        <View style={styles.publish}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Publish</Text>
          {problems.length ? (
            problems.map((p) => <Muted key={p}>• {p}</Muted>)
          ) : (
            <Text style={{ color: colors.green }}>Ready to publish.</Text>
          )}
          <Button title="Publish set" disabled={problems.length > 0} onPress={publish} />
        </View>
      ) : null}

      <View style={styles.cardsHeader}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
          Cards ({set.cards.length})
        </Text>
        {isDraft ? (
          <Button
            title="📷 Add card"
            onPress={() => router.push({ pathname: '/studio/card', params: { setId: set.id } })}
          />
        ) : null}
      </View>
      <View style={styles.grid}>
        {set.cards.map((c) => (
          <View key={c.id} style={{ alignItems: 'center', gap: 6 }}>
            <CardPreview
              width={150}
              title={c.title}
              rarity={c.rarity}
              imageUrl={c.image.url}
              templateKey={c.template_key}
              templateConfig={c.template_config}
            />
            {isDraft ? (
              <View style={styles.row}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/studio/card',
                      params: { setId: set.id, cardId: c.id },
                    })
                  }
                >
                  <Text style={{ color: colors.accent, fontSize: 13 }}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => removeCard(c.id, c.title)}>
                  <Text style={{ color: colors.danger, fontSize: 13 }}>Delete</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  publish: {
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  cardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
});
