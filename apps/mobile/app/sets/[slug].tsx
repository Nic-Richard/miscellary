import type { CardSetDetail, PackOpening, PackStatus } from '@miscellary/shared';
import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CardPreview from '@/components/CardPreview';
import Description from '@/components/Description';
import PackReveal from '@/components/PackReveal';
import { useAuth } from '@/lib/auth';
import {
  getPackStatus,
  getPublicSet,
  likeCard,
  likeSet,
  openPack,
  sendReport,
} from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import { Button, ErrorText, Loading, Muted, Tag, Title } from '@/components/ui';

export default function BinderScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user, loading } = useAuth();
  const [set, setSet] = useState<CardSetDetail | null>(null);
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [opening, setOpening] = useState<PackOpening | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const s = await getPublicSet(slug);
    setSet(s);
    if (user && s.status === 'published') setStatus(await getPackStatus(slug));
  }, [slug, user]);

  useEffect(() => {
    if (loading) return;
    load().catch((e: Error) => setError(e.message));
  }, [load, loading]);

  async function open(usePoints: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await openPack(slug, usePoints);
      setOpening(result);
      setStatus(result.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the pack.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleSetLike() {
    if (!set || !user) return;
    const r = await likeSet(set.slug, !set.liked);
    setSet({ ...set, liked: r.liked, like_count: r.like_count });
  }

  async function toggleCardLike(cardId: string) {
    if (!set || !user) return;
    const liked = set.liked_card_ids.includes(cardId);
    const r = await likeCard(cardId, !liked);
    setSet({
      ...set,
      liked_card_ids: r.liked
        ? [...set.liked_card_ids, cardId]
        : set.liked_card_ids.filter((id) => id !== cardId),
      cards: set.cards.map((c) => (c.id === cardId ? { ...c, like_count: r.like_count } : c)),
    });
  }

  function report() {
    if (!set) return;
    Alert.alert('Report this set', 'Why are you reporting it?', [
      {
        text: 'Explicit content',
        onPress: () => void sendReport({ set_slug: set.slug, reason: 'explicit', details: '' }),
      },
      {
        text: 'Stolen photos',
        onPress: () => void sendReport({ set_slug: set.slug, reason: 'stolen', details: '' }),
      },
      {
        text: 'Real person misuse',
        onPress: () => void sendReport({ set_slug: set.slug, reason: 'real_person', details: '' }),
      },
      {
        text: 'Spam',
        onPress: () => void sendReport({ set_slug: set.slug, reason: 'spam', details: '' }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (error && !set) return <ErrorText>{error}</ErrorText>;
  if (!set) return <Loading />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Tag>{set.status === 'draft' ? 'Draft preview' : 'Binder'}</Tag>
      <Title>{set.title}</Title>
      <View style={styles.metaRow}>
        <Link href={{ pathname: '/users/[username]', params: { username: set.creator.username } }}>
          <Text style={{ color: colors.accent }}>@{set.creator.username}</Text>
        </Link>
        <Muted>
          {' '}
          · {set.card_count} cards · {set.opening_count} packs opened
        </Muted>
      </View>
      {set.description ? <Description text={set.description} /> : null}

      {set.status === 'published' ? (
        <View style={styles.social}>
          <Pressable
            onPress={() => void toggleSetLike()}
            style={[styles.like, set.liked && { borderColor: colors.danger }]}
          >
            <Text style={{ color: set.liked ? colors.danger : colors.muted }}>
              ♥ {set.like_count}
            </Text>
          </Pressable>
          {user ? (
            <Pressable onPress={report}>
              <Text style={{ color: colors.faint, fontSize: 12 }}>Report</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {set.status === 'published' ? (
        <View style={styles.packs}>
          {!user ? (
            <Muted>Log in to open a free pack from this set every day.</Muted>
          ) : status ? (
            <>
              <Button
                title={
                  status.free_available
                    ? `Open today's free pack (${status.pack_size} cards)`
                    : 'Free pack opened. Back tomorrow.'
                }
                disabled={busy || !status.free_available}
                onPress={() => void open(false)}
              />
              <Button
                title={`Extra pack for ${status.pack_cost} points (you have ${status.points})`}
                kind="secondary"
                disabled={busy || status.points < status.pack_cost}
                onPress={() => void open(true)}
              />
            </>
          ) : null}
          <ErrorText>{error}</ErrorText>
        </View>
      ) : null}

      <View style={styles.grid}>
        {set.cards.map((c) => (
          <View key={c.id} style={{ alignItems: 'center', gap: 6 }}>
            <CardPreview
              width={165}
              title={c.title}
              rarity={c.rarity}
              imageUrl={c.image.url}
              templateKey={c.template_key}
              templateConfig={c.template_config}
            />
            {set.status === 'published' ? (
              <Pressable
                onPress={() => void toggleCardLike(c.id)}
                style={[
                  styles.like,
                  set.liked_card_ids.includes(c.id) && { borderColor: colors.danger },
                ]}
              >
                <Text
                  style={{
                    color: set.liked_card_ids.includes(c.id) ? colors.danger : colors.muted,
                    fontSize: 12,
                  }}
                >
                  ♥ {c.like_count}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      {opening ? <PackReveal opening={opening} onClose={() => setOpening(null)} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  social: { flexDirection: 'row', gap: 14, alignItems: 'center', marginVertical: 10 },
  like: {
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  packs: {
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
});
