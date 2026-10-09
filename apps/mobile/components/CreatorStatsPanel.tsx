import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { CreatorStats } from '@miscellary/shared';
import { creatorActivity, OPENING_LABELS, starAmount } from '@miscellary/shared';
import { ApiRequestError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { createThemedStyles, fonts } from '@/lib/theme';
import { Button, ErrorText, Muted } from './ui';
import PublishingNotice from './PublishingNotice';

export default function CreatorStatsPanel() {
  const styles = useStyles();
  const { user } = useAuth();
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setStats(null), [user?.id]);
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      setLoading(true);
      setError(null);
      if (user)
        void apiFetch<CreatorStats>('/api/v1/me/creator-stats/', { signal: controller.signal })
          .then((data) => {
            if (!controller.signal.aborted) setStats(data);
          })
          .catch((err: unknown) => {
            if (
              !controller.signal.aborted &&
              !(err instanceof ApiRequestError && err.status === 404)
            ) {
              setError(err instanceof Error ? err.message : 'Could not load creator stats.');
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      return () => controller.abort();
    }, [user?.id, retry]),
  );
  if (!user || (!loading && !stats?.enabled && !error)) return null;
  const details = stats?.details;
  const activity = details ? creatorActivity(details) : [];
  const peak = Math.max(1, ...activity.map((day) => day.openings));
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Creator stats</Text>
      <ErrorText>{error}</ErrorText>
      {stats?.enabled && (
        <>
          <Muted>
            {stats.totals.sets.toLocaleString()} published sets ·{' '}
            {stats.totals.openings.toLocaleString()} packs opened ·{' '}
            {stats.totals.collectors.toLocaleString()} collectors ·{' '}
            {stats.totals.follows.toLocaleString()} set follows
          </Muted>
          <PublishingNotice allowance={stats.publishing} />
          {details && (
            <Button
              kind="secondary"
              title={expanded ? 'Hide detailed stats' : 'View detailed stats'}
              onPress={() => setExpanded((value) => !value)}
            />
          )}
          {details && expanded && (
            <>
              <Muted>
                {details.recent_openings.toLocaleString()} packs opened in the last 30 days ·{' '}
                {starAmount(details.recent_stars_earned_units, 1000)} Stars earned
              </Muted>
              <Muted>{starAmount(details.stars_earned_units, 1000)} Stars earned overall</Muted>
              {details.recent_openings > 0 ? (
                <>
                  <View
                    style={styles.chart}
                    accessible
                    accessibilityLabel={activity
                      .map(({ day, openings }) => `${day}: ${openings} packs`)
                      .join('; ')}
                  >
                    {activity.map(({ day, openings }) => (
                      <View
                        key={day}
                        style={[styles.bar, { height: `${Math.max(2, (openings / peak) * 100)}%` }]}
                      />
                    ))}
                  </View>
                  <View style={styles.dates}>
                    <Muted>{activity[0]?.day}</Muted>
                    <Muted>{activity.at(-1)?.day}</Muted>
                  </View>
                </>
              ) : (
                <Muted>Daily activity will appear here when your packs are opened.</Muted>
              )}
              <Text style={styles.setTitle}>Pack openings</Text>
              {details.opening_types.length ? (
                details.opening_types.map((type) => (
                  <Muted key={type.kind}>
                    {OPENING_LABELS[type.kind] ?? type.kind}: {type.openings.toLocaleString()}
                  </Muted>
                ))
              ) : (
                <Muted>No packs opened yet.</Muted>
              )}
              {details.sets.length > 0 && <Text style={styles.setTitle}>Your sets</Text>}
              {details.sets.map((set) => (
                <View key={set.id} style={{ gap: 3 }}>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() =>
                      router.push(set.deleted ? `/studio/${set.id}` : `/sets/${set.slug}`)
                    }
                  >
                    <Text style={styles.link}>
                      {set.title}
                      {set.deleted ? ' (removed)' : ''}
                    </Text>
                  </Pressable>
                  <Muted>
                    {set.openings.toLocaleString()} packs · {set.collectors.toLocaleString()}{' '}
                    collectors · {set.follows.toLocaleString()} follows ·{' '}
                    {starAmount(set.stars_earned_units, 1000)} Stars earned
                  </Muted>
                  <Muted>
                    {set.holders.toLocaleString()} current collectors ·{' '}
                    {set.completed.toLocaleString()} complete binders ·{' '}
                    {set.average_completion_percent}% average completion
                  </Muted>
                </View>
              ))}
              <Text style={styles.setTitle}>Most liked cards</Text>
              {details.popular_cards.length ? (
                details.popular_cards.map((card) => (
                  <View key={card.id} style={{ gap: 3 }}>
                    <Pressable
                      accessibilityRole="link"
                      onPress={() =>
                        router.push({
                          pathname: '/sets/[slug]',
                          params: { slug: card.set_slug, card: card.id },
                        })
                      }
                    >
                      <Text style={styles.link}>{card.title}</Text>
                    </Pressable>
                    <Muted>
                      {card.set_title} · {card.likes.toLocaleString()}{' '}
                      {card.likes === 1 ? 'like' : 'likes'}
                    </Muted>
                  </View>
                ))
              ) : (
                <Muted>Card likes will appear here once collectors leave them.</Muted>
              )}
            </>
          )}
          {!details && (
            <Muted>
              Supporters also see activity, collection progress, card likes and Stars earned.
            </Muted>
          )}
          <Muted>
            Counts include your own collecting. Collector totals include closed accounts; set
            follows count current followers. Completion uses cards currently held, ignoring
            duplicates.
          </Muted>
        </>
      )}
      {loading && !stats && <Muted>Loading creator stats…</Muted>}
      <Button
        title={loading ? 'Refreshing…' : 'Refresh stats'}
        kind="secondary"
        disabled={loading}
        onPress={() => setRetry((value) => value + 1)}
      />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  panel: {
    padding: 16,
    gap: 10,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderRadius: 8,
  },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  setTitle: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  link: { color: colors.accent, fontFamily: fonts.medium, fontSize: 16, paddingVertical: 6 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 80 },
  bar: { flex: 1, backgroundColor: colors.accent, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  dates: { flexDirection: 'row', justifyContent: 'space-between' },
}));
