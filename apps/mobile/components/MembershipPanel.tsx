import { useCallback, useEffect, useRef, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, Switch, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Membership } from '@miscellary/shared';
import { starAmount } from '@miscellary/shared';
import { ApiRequestError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { createThemedStyles, fonts, useColors } from '@/lib/theme';
import { STAR_PATH } from './Avatar';
import { Button, ErrorText, Muted } from './ui';

export default function MembershipPanel() {
  const colors = useColors();
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
        <Button title="Try again" kind="secondary" onPress={() => setRetry((value) => value + 1)} />
      </View>
    );
  if (!membership)
    return refreshing && user ? (
      <View style={styles.panel}>
        <Muted>Loading membership…</Muted>
      </View>
    ) : null;
  if (!membership.enabled) return null;
  const sub = membership.subscription;
  const publications = membership.publishing;
  const name = user?.profile.display_name || user?.profile.username || '';
  const renewal = sub.paid_through
    ? new Date(sub.paid_through).toLocaleDateString(undefined, { dateStyle: 'long' })
    : 'at the end of your paid period';
  const perks: {
    count: string;
    title: string;
    note: string;
    link?: [string, string];
  }[] = [
    {
      count: String(sub.monthly_bonus_packs),
      title: 'Bonus packs a month',
      note: sub.active ? `${sub.bonus_packs_remaining} left` : 'Any set',
      ...(sub.active ? { link: ['/packs', 'Open one'] as [string, string] } : {}),
    },
    {
      count: String(sub.monthly_stars),
      title: 'Stars a month',
      note: 'Never expire',
    },
    {
      count: '10',
      title: 'Sets published a month',
      note: 'Instead of 3',
      link: ['/studio', 'Studio'],
    },
    {
      count: '6',
      title: 'Cards per Lounge post',
      note: 'Instead of 1',
      link: ['/lounge', 'Lounge'],
    },
  ];

  return (
    <View style={styles.wrap}>
      {membership.preview && (
        <Text style={styles.notice}>
          Local preview. Purchases are switched off and these are sample benefits.
        </Text>
      )}
      <View style={styles.panel}>
        <View style={styles.member}>
          <View style={styles.sleeve} importantForAccessibility="no-hide-descendants">
            <LinearGradient
              colors={[colors.clothSoft, colors.accent]}
              locations={[0, 0.7]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.card}
            >
              <Text style={styles.cardLabel}>{sub.active ? 'Supporter' : 'Collector'}</Text>
              <View style={[styles.seal, sub.active && styles.sealGold]}>
                <Text style={styles.sealText}>{name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.cardHandle} numberOfLines={1}>
                @{user?.profile.username}
              </Text>
            </LinearGradient>
          </View>
          <View style={styles.statusBlock}>
            <Text accessibilityRole="header" style={styles.title}>
              {sub.active ? 'Supporter' : 'Become a supporter'}
            </Text>
            {sub.active && (
              <View style={styles.state}>
                <View style={styles.dot} />
                <Text style={styles.stateText}>{sub.auto_renews ? 'Active' : 'Ending'}</Text>
              </View>
            )}
          </View>
        </View>
        <Muted>
          {sub.active
            ? sub.auto_renews
              ? `Renews ${renewal} for ${price(sub.price_cents, sub.currency)}.`
              : `Ends ${renewal}. You keep your Stars afterwards.`
            : `${price(sub.price_cents, sub.currency)} a month. A little extra for your collection, and a little support for Miscellary.`}
        </Muted>
        <View>
          {perks.map((perk) => (
            <View key={perk.title} style={styles.perk}>
              <View style={styles.perkCount}>
                <Text style={styles.perkCountText}>{perk.count}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.perkTitle}>{perk.title}</Text>
                <Text style={styles.perkNote}>{perk.note}</Text>
              </View>
              {perk.link && (
                <PerkLink
                  label={perk.link[1]}
                  onPress={() => router.push(perk.link![0] as never)}
                />
              )}
            </View>
          ))}
          <View style={styles.perk}>
            <View style={styles.perkCount}>
              <Feather name="bar-chart-2" size={16} color={colors.accentInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.perkTitle}>Detailed creator stats</Text>
            </View>
            <PerkLink label="View" onPress={() => router.push('/studio')} />
          </View>
          <View style={[styles.perk, styles.perkLast]}>
            <View style={styles.perkCount}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path
                  d={STAR_PATH}
                  fill="none"
                  stroke={colors.accentInk}
                  strokeWidth={1.8}
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.perkTitle}>Supporter badge</Text>
              <Text style={styles.perkNote}>On your profile and in the Lounge</Text>
            </View>
            {sub.active && (
              <Switch
                accessibilityLabel="Show supporter badge"
                value={membership.show_badge !== false}
                disabled={saving}
                onValueChange={(value) => void toggleBadge(value)}
                trackColor={{ true: colors.accent, false: colors.bdr2 }}
                thumbColor={colors.sur}
              />
            )}
          </View>
        </View>
        <ErrorText>{saveError}</ErrorText>
        {!sub.active && <Muted style={styles.small}>Joining in the app isn’t available yet.</Muted>}
      </View>

      <View style={styles.panel}>
        <View style={styles.walletHead}>
          <Text accessibilityRole="header" style={styles.title}>
            Stars
          </Text>
          <Text style={styles.balance}>
            {starAmount(membership.star_units, membership.units_per_star)}
            <Text style={styles.balanceUnit}> Stars</Text>
          </Text>
        </View>
        {membership.star_units < 0 && (
          <Text style={styles.notice}>
            A refunded purchase took back Stars you’d already spent. Trading is paused until your
            balance is back to zero. Your cards stay yours.
          </Text>
        )}
        <Muted>
          Extra packs cost 50 points. A set’s recycled points go first, then Stars cover the rest.
        </Muted>
      </View>

      <View style={styles.panel}>
        <View style={styles.walletHead}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={styles.subtitle}>
              Publishing this month
            </Text>
            <Muted>
              {publications.used} of {publications.limit} sets published. Resets{' '}
              {new Date(publications.resets_at).toLocaleDateString(undefined, {
                timeZone: 'UTC',
                dateStyle: 'long',
              })}
              .
            </Muted>
          </View>
          <Button title="Your sets" kind="secondary" onPress={() => router.push('/studio')} />
        </View>
      </View>
      <ErrorText>{error}</ErrorText>
      <Button
        title={refreshing ? 'Refreshing…' : 'Refresh'}
        kind="secondary"
        disabled={refreshing || saving}
        onPress={() => setRetry((value) => value + 1)}
      />
    </View>
  );
}

function PerkLink({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.6 }}
    >
      <Text style={styles.perkLink}>{label}</Text>
    </Pressable>
  );
}

function price(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(cents / 100);
}

const useStyles = createThemedStyles((colors) => ({
  wrap: { gap: 12 },
  panel: {
    padding: 16,
    gap: 12,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderRadius: 12,
  },
  notice: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur2,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
  },
  member: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  sleeve: {
    width: 104,
    padding: 6,
    borderRadius: 10,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    elevation: 6,
    transform: [{ rotate: '-2.5deg' }],
  },
  card: {
    aspectRatio: 5 / 7,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cardLabel: {
    color: colors.accentText,
    fontFamily: fonts.medium,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  seal: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sur,
    borderWidth: 2,
    borderColor: colors.accentText,
  },
  sealGold: { borderWidth: 3, borderColor: colors.gold },
  sealText: { color: colors.accentInk, fontFamily: fonts.display, fontSize: 26 },
  cardHandle: {
    maxWidth: '90%',
    color: colors.accentText,
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 0.6,
  },
  statusBlock: { flex: 1, gap: 6 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 32, lineHeight: 34 },
  subtitle: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  stateText: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 15 },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: colors.bdr2,
  },
  perkLast: { borderBottomWidth: 0 },
  perkCount: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sur2,
  },
  perkCountText: { color: colors.accentInk, fontFamily: fonts.display, fontSize: 18 },
  perkTitle: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  perkNote: { color: colors.faint, fontFamily: fonts.body, fontSize: 13 },
  perkLink: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 15 },
  small: { fontSize: 14 },
  walletHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  balance: { color: colors.accentInk, fontFamily: fonts.display, fontSize: 40 },
  balanceUnit: { color: colors.muted, fontFamily: fonts.medium, fontSize: 15 },
}));
