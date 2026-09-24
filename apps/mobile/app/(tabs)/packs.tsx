import { cardCode, personName } from '@miscellary/shared';
import type { PackEntry, PackOpening } from '@miscellary/shared';
import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import CardPreview from '@/components/CardPreview';
import DemoBadge from '@/components/DemoBadge';
import FilterField from '@/components/FilterField';
import LoginGate from '@/components/LoginGate';
import PackPreview from '@/components/PackPreview';
import PackReveal from '@/components/PackReveal';
import TagChips from '@/components/TagChips';
import { Button, ErrorText, Loading, Muted } from '@/components/ui';
import { followSet, getMyPacks, openPack } from '@/lib/endpoints';
import { colors, fonts } from '@/lib/theme';

function countdown(until: string, now: number): string {
  const ms = Math.max(0, new Date(until).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function Progress({ owned, total }: { owned: number; total: number }) {
  const done = total > 0 && owned >= total;
  const percent = total ? Math.min(100, (owned / total) * 100) : 0;
  return (
    <View style={styles.progress}>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${percent}%`, backgroundColor: done ? colors.gold : colors.cloth },
          ]}
        />
      </View>
      <Text style={styles.count}>{done ? 'Complete' : `${owned}/${total}`}</Text>
    </View>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  value: number;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Feather name={icon} size={13} color={colors.faint} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Post({
  entry,
  now,
  onUnfollow,
  onOpen,
  busy,
}: {
  entry: PackEntry;
  now: number;
  onUnfollow: () => void;
  onOpen: (usePoints: boolean) => void;
  busy: boolean;
}) {
  const set = entry.card_set;
  const creator = personName(set.creator);
  const affordable = entry.points >= entry.pack_cost;
  const open = () => router.push({ pathname: '/sets/[slug]', params: { slug: set.slug } });

  function more() {
    Alert.alert(set.title, undefined, [
      { text: 'Open the binder', onPress: open },
      { text: 'Stop following', style: 'destructive', onPress: onUnfollow },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={[styles.post, entry.free_available && styles.ready]}>
      <View style={styles.byline}>
        <Pressable
          accessibilityRole="link"
          disabled={set.creator.deleted}
          onPress={() =>
            router.push({
              pathname: '/users/[username]',
              params: { username: set.creator.username },
            })
          }
          style={styles.bylineLink}
        >
          <View style={styles.monogram}>
            <Text style={styles.monogramText}>{creator[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flexShrink: 1 }}>
            <View style={styles.bylineName}>
              <Text style={styles.bylineStrong} numberOfLines={1}>
                {creator}
              </Text>
              {set.creator.is_demo ? <DemoBadge /> : null}
            </View>
            {set.creator.deleted ? null : (
              <Text style={styles.bylineHandle}>@{set.creator.username}</Text>
            )}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More for ${set.title}`}
          hitSlop={10}
          onPress={more}
          style={({ pressed }) => [styles.more, pressed && { opacity: 0.6 }]}
        >
          <Feather name="more-horizontal" size={19} color={colors.faint} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Pressable
          accessibilityRole={entry.free_available ? 'button' : 'link'}
          accessibilityLabel={entry.free_available ? `Open a ${set.title} pack` : set.title}
          disabled={busy}
          onPress={entry.free_available ? () => onOpen(false) : open}
          style={({ pressed }) => [styles.packPress, pressed && { opacity: 0.85 }]}
        >
          <View pointerEvents="none">
            <PackPreview set={set} width={118} />
          </View>
          {entry.free_available ? (
            <View style={styles.seal}>
              <Text style={styles.sealText}>FREE</Text>
            </View>
          ) : null}
        </Pressable>

        <View style={styles.detail}>
          <Pressable accessibilityRole="link" onPress={open}>
            <Text style={styles.name} numberOfLines={2}>
              {set.title}
            </Text>
          </Pressable>
          <Text style={styles.sub}>
            {set.card_count} cards · {set.pack_size} a pack
          </Text>
          {set.tags.length ? <TagChips tags={set.tags.slice(0, 3)} /> : null}
          <Progress owned={entry.owned_count} total={entry.card_count} />
          <View style={styles.stats}>
            <Stat icon="package" value={set.opening_count} label="opened" />
            <Stat icon="users" value={set.follower_count} label="following" />
            <Stat icon="heart" value={set.like_count} label="likes" />
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {entry.free_available ? (
          <Button title="Open today's pack" disabled={busy} onPress={() => onOpen(false)} />
        ) : affordable ? (
          <Button
            title={`Spend ${entry.pack_cost} points`}
            kind="secondary"
            disabled={busy}
            onPress={() => onOpen(true)}
          />
        ) : (
          <View style={styles.waiting}>
            <Text style={styles.clock}>{countdown(entry.resets_at, now)}</Text>
            <Text style={styles.waitingLabel}>until the next free pack</Text>
          </View>
        )}
        <View style={styles.points}>
          {entry.points > 0 ? (
            <Text style={styles.pointsText}>
              {affordable ? `${entry.points} pts saved` : `${entry.points}/${entry.pack_cost} pts`}
            </Text>
          ) : null}
          {entry.duplicate_count > 0 ? (
            <Text style={styles.pointsLink}>
              {entry.duplicate_count} spare{entry.duplicate_count === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.pulls}>
        <Text style={styles.pullsLabel}>
          {entry.recent_cards.length
            ? 'YOUR LATEST FROM THIS SET'
            : entry.free_available
              ? 'NOTHING YET — TODAY’S PACK IS WAITING'
              : 'NOTHING FROM THIS SET YET'}
        </Text>
        {entry.recent_cards.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pullsRow}>
            {entry.recent_cards.map((card) => (
              <View key={card.id} style={styles.pull}>
                <CardPreview
                  width={72}
                  title={card.title}
                  rarity={card.rarity}
                  printedText={card.printed_text}
                  code={cardCode(card.printed_set_code, card.position, card.set_total)}
                  imageUrl={card.image.url}
                  templateKey={card.template_key}
                  templateConfig={card.template_config}
                  mark={set.mark}
                  render={card.render}
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.facedownRow}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[styles.facedown, { transform: [{ rotate: `${i * 4 - 4}deg` }] }]}
              >
                {set.render_back?.image?.url ? (
                  <Image
                    source={{ uri: set.render_back.image.url }}
                    resizeMode="cover"
                    style={styles.facedownImage}
                  />
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function Packs() {
  const [entries, setEntries] = useState<PackEntry[] | null>(null);
  const [freeCount, setFreeCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<PackOpening | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const page = await getMyPacks();
      setEntries(page.results);
      setFreeCount(page.free_count);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your packs.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!entries?.some((e) => !e.free_available)) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [entries]);

  async function open(slug: string, usePoints: boolean) {
    setBusy(true);
    setError(null);
    try {
      setOpening(await openPack(slug, usePoints));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that pack.');
    } finally {
      setBusy(false);
    }
  }

  async function unfollow(slug: string) {
    setEntries((current) => current?.filter((e) => e.card_set.slug !== slug) ?? null);
    try {
      await followSet(slug, false);
    } finally {
      await load();
    }
  }

  if (entries === null) return error ? <ErrorText>{error}</ErrorText> : <Loading />;

  const collected = entries.reduce((n, e) => n + e.owned_count, 0);
  const total = entries.reduce((n, e) => n + e.card_count, 0);
  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? entries.filter(
        (e) =>
          e.card_set.title.toLowerCase().includes(needle) ||
          e.card_set.creator.username.toLowerCase().includes(needle),
      )
    : entries;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          colors={[colors.accent]}
          tintColor={colors.accent}
        />
      }
    >
      <Text accessibilityRole="header" style={styles.heading}>
        {freeCount > 0
          ? `${freeCount} free ${freeCount === 1 ? 'pack' : 'packs'} waiting`
          : 'Sets you follow'}
      </Text>
      {entries.length ? (
        <Text style={styles.standing}>
          {collected} of {total} cards collected across {entries.length}{' '}
          {entries.length === 1 ? 'set' : 'sets'}
        </Text>
      ) : null}
      <ErrorText>{error}</ErrorText>

      {entries.length > 1 ? (
        <FilterField
          style={styles.filter}
          value={filter}
          onChange={setFilter}
          placeholder="Filter by set or creator"
          label="Filter the sets you follow"
        />
      ) : null}

      {entries.length > 0 && shown.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="search" size={28} color={colors.cloth} />
          <Text style={styles.emptyTitle}>Nothing matches</Text>
          <Muted>None of the sets you follow match “{filter}”.</Muted>
          <Button title="Show every set" kind="secondary" onPress={() => setFilter('')} />
        </View>
      ) : null}

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="package" size={30} color={colors.cloth} />
          <Text style={styles.emptyTitle}>No sets followed yet</Text>
          <Muted>
            Follow a set and it waits here: its free pack each day, the points you have saved
            towards another, and how much of it you have collected.
          </Muted>
          <Button title="Browse sets" onPress={() => router.push('/(tabs)')} />
        </View>
      ) : (
        shown.map((entry) => (
          <Post
            key={entry.card_set.id}
            entry={entry}
            now={now}
            busy={busy}
            onOpen={(usePoints) => void open(entry.card_set.slug, usePoints)}
            onUnfollow={() => void unfollow(entry.card_set.slug)}
          />
        ))
      )}

      {opening ? (
        <PackReveal
          opening={opening}
          onClose={() => {
            setOpening(null);
            void load();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

export default function PacksScreen() {
  return (
    <LoginGate>
      <Packs />
    </LoginGate>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  heading: { color: colors.text, fontFamily: fonts.display, fontSize: 30 },
  filter: { marginTop: 14 },
  standing: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: -8 },

  post: {
    padding: 14,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderRadius: 12,
  },
  ready: { borderLeftWidth: 3, borderLeftColor: colors.accent },

  byline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.bdr,
  },
  bylineLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  monogram: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.sur,
    backgroundColor: colors.cloth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: { color: colors.sur, fontFamily: fonts.display, fontSize: 17 },
  bylineName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bylineStrong: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  bylineHandle: { color: colors.faint, fontFamily: fonts.body, fontSize: 12 },
  more: { padding: 4 },

  body: { flexDirection: 'row', gap: 14, paddingTop: 14 },
  packPress: { position: 'relative' },
  seal: {
    position: 'absolute',
    top: -6,
    right: -8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: colors.accent,
    transform: [{ rotate: '4deg' }],
  },
  sealText: {
    color: colors.accentText,
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 1.2,
  },

  detail: { flex: 1, minWidth: 0, gap: 7 },
  name: { color: colors.text, fontFamily: fonts.display, fontSize: 25, lineHeight: 27 },
  sub: { color: colors.faint, fontFamily: fonts.body, fontSize: 12, marginTop: -4 },

  progress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: {
    flex: 1,
    height: 9,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.bdr2,
    backgroundColor: colors.sur2,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
  count: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12 },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { color: colors.text, fontFamily: fonts.display, fontSize: 15 },
  statLabel: { color: colors.faint, fontFamily: fonts.body, fontSize: 11 },

  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  waiting: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  clock: { color: colors.muted, fontFamily: fonts.display, fontSize: 22 },
  waitingLabel: { color: colors.faint, fontFamily: fonts.body, fontSize: 11 },
  points: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  pointsText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12 },
  pointsLink: { color: colors.accent, fontFamily: fonts.body, fontSize: 12 },

  pulls: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.bdr },
  pullsLabel: { color: colors.faint, fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1.1 },
  pullsRow: { marginTop: 10 },
  pull: { marginRight: 8 },
  facedownRow: { flexDirection: 'row', gap: 8, marginTop: 10, opacity: 0.5 },
  facedown: {
    width: 62,
    aspectRatio: 5 / 7,
    borderRadius: 4,
    backgroundColor: colors.sur2,
    borderWidth: 1,
    borderColor: colors.bdr2,
    overflow: 'hidden',
  },
  facedownImage: { width: '100%', height: '100%' },

  empty: {
    padding: 24,
    gap: 14,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderRadius: 8,
  },
  emptyTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 26 },
});
