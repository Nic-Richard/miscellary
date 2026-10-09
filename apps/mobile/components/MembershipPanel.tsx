import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Switch, Text, View } from 'react-native';
import type { Membership } from '@miscellary/shared';
import { starAmount } from '@miscellary/shared';
import { ApiRequestError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { createThemedStyles, fonts } from '@/lib/theme';
import { Button, ErrorText, Muted } from './ui';

export default function MembershipPanel() {
  const styles = useStyles();
  const { user } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveController = useRef<AbortController | null>(null);
  useEffect(() => setMembership(null), [user?.id]);
  async function toggleBadge(show_badge: boolean) {
    if (saveController.current && !saveController.current.signal.aborted) return;
    const controller = new AbortController();
    saveController.current = controller;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await apiFetch<Membership>('/api/v1/me/membership/', {
        method: 'PATCH',
        body: { show_badge },
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setMembership(updated);
    } catch (err: unknown) {
      if (!controller.signal.aborted)
        setSaveError(err instanceof Error ? err.message : 'Could not save badge preference.');
    } finally {
      controller.abort();
      if (saveController.current === controller) setSaving(false);
    }
  }
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      setRefreshing(true);
      setError(null);
      setSaveError(null);
      setSaving(false);
      if (user)
        void apiFetch<Membership>('/api/v1/me/membership/', { signal: controller.signal })
          .then((data) => {
            if (!controller.signal.aborted) setMembership(data);
          })
          .catch((err: unknown) => {
            if (
              !controller.signal.aborted &&
              !(err instanceof ApiRequestError && err.status === 404)
            ) {
              setError(err instanceof Error ? err.message : 'Could not load membership.');
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setRefreshing(false);
          });
      return () => {
        controller.abort();
        saveController.current?.abort();
      };
    }, [user?.id, retry]),
  );

  if (error && !membership)
    return (
      <View style={styles.panel}>
        <ErrorText>{error}</ErrorText>
        <Button
          title="Retry membership"
          kind="secondary"
          onPress={() => setRetry((value) => value + 1)}
        />
      </View>
    );
  if (!membership)
    return refreshing && user ? (
      <View style={styles.panel}>
        <Text style={styles.title}>Supporter membership</Text>
        <Muted>Loading membership…</Muted>
      </View>
    ) : null;
  if (!membership.enabled) return null;
  const sub = membership.subscription;
  const publications = membership.publishing;
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Supporter membership</Text>
      <Text style={styles.status}>{sub.active ? 'Active supporter' : 'Free collector'}</Text>
      {membership.preview && (
        <Muted>Local preview. These are sample benefits; purchases are disabled.</Muted>
      )}
      {sub.active ? (
        <>
          <Muted>
            {sub.bonus_packs_remaining} monthly bonus packs left · available until{' '}
            {new Date(sub.paid_through!).toLocaleDateString()}
          </Muted>
          <Muted>
            {sub.auto_renews
              ? 'Your subscription renews at the end of this paid period.'
              : 'Renewal is cancelled. Your benefits stay until the paid period ends; your Stars remain afterward.'}
          </Muted>
        </>
      ) : null}
      <Muted>
        {new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: sub.currency,
          currencyDisplay: 'code',
        }).format(sub.price_cents / 100)}{' '}
        / month
      </Muted>
      <View style={styles.section}>
        <Text style={styles.perk}>
          {sub.monthly_bonus_packs} bonus packs · {sub.monthly_stars} Stars
        </Text>
        <Muted>
          Each paid month, across any sets. Daily free packs stay unchanged; Stars never expire.
        </Muted>
        <Text style={styles.perk}>10 published sets a month</Text>
        <Muted>Instead of 3. Existing sets stay published after expiry.</Muted>
        <Text style={styles.perk}>Detailed creator stats</Text>
        <Muted>Activity, collection progress and Stars earned in Studio.</Muted>
        <Text style={styles.perk}>6-card Lounge showcases</Text>
        <Muted>Binder layouts, plus an optional membership badge on your profile and posts.</Muted>
        <View style={styles.actions}>
          <Button title="Packs" kind="secondary" onPress={() => router.push('/packs')} />
          <Button title="Studio" kind="secondary" onPress={() => router.push('/studio')} />
          <Button title="Lounge" kind="secondary" onPress={() => router.push('/lounge')} />
        </View>
      </View>
      <Muted>Purchases and subscription management are not available yet.</Muted>
      {sub.active && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Muted style={{ flex: 1 }}>Show supporter badge on my profile and in the Lounge</Muted>
          <Switch
            accessibilityLabel="Show supporter badge"
            value={membership.show_badge !== false}
            disabled={saving}
            onValueChange={(value) => void toggleBadge(value)}
          />
        </View>
      )}
      <View style={styles.section}>
        <Text style={styles.title}>Stars</Text>
        <Text style={styles.balance}>
          {starAmount(membership.star_units, membership.units_per_star)} Stars
        </Text>
        <Muted>
          Extra packs cost 50 points. A set's recycled points are used first, then your Stars cover
          the rest.
        </Muted>
      </View>
      <View style={styles.section}>
        <Text style={styles.perk}>Publishing this month</Text>
        <Muted>
          {publications.used} of {publications.limit} sets published. Resets{' '}
          {new Date(publications.resets_at).toLocaleDateString(undefined, { timeZone: 'UTC' })}{' '}
          (UTC).
        </Muted>
      </View>
      <ErrorText>{saveError}</ErrorText>
      <ErrorText>{error}</ErrorText>
      <Button
        title={refreshing ? 'Refreshing…' : 'Refresh membership'}
        kind="secondary"
        disabled={refreshing || saving}
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
  status: { color: colors.accent, fontFamily: fonts.medium, fontSize: 15 },
  section: { paddingTop: 16, marginTop: 6, borderTopWidth: 1, borderTopColor: colors.bdr, gap: 10 },
  perk: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  balance: { color: colors.text, fontFamily: fonts.medium, fontSize: 22 },
}));
