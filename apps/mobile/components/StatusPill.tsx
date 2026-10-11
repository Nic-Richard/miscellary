import { useCallback, useEffect, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { router, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { AccountStatus } from '@miscellary/shared';
import { getTheme } from '@miscellary/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { onStatusChange, useMembership } from '@/lib/membership';
import { createThemedStyles, fonts, shadows, useColors } from '@/lib/theme';
import Avatar from './Avatar';
import ChoiceSheet from './ChoiceSheet';
import SupporterEmblem from './SupporterEmblem';

const TICKET =
  'M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4Z';

const MENU = {
  profile: '/profile',
  membership: '/membership',
  appearance: '/appearance',
  account: '/settings',
  blocked: '/blocked',
} as const;

/** Tickets, free packs, notifications and your account, in the header of every screen. */
export default function StatusPill() {
  const colors = useColors();
  const styles = useStyles();
  const { user, logout } = useAuth();
  const { supporter } = useMembership();
  const pathname = usePathname();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [menu, setMenu] = useState(false);

  const load = useCallback(() => {
    if (!user) {
      setStatus(null);
      return;
    }
    apiFetch<AccountStatus>('/api/v1/me/status/')
      .then(setStatus)
      .catch(() => undefined);
  }, [user]);

  useEffect(load, [load, pathname]);
  useEffect(() => onStatusChange(load), [load]);

  if (!user || !status) return null;
  const person = { ...user.profile, deleted: false, supporter_tier: status.supporter_tier };

  const link = (label: string, href: string, icon: React.ReactNode, count?: number) => (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={() => router.push(href as never)}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      {icon}
      {count !== undefined && <Text style={styles.count}>{count}</Text>}
    </Pressable>
  );

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={
          status.tickets < 0 ? `${-status.tickets} tickets owed` : `${status.tickets} tickets`
        }
        hitSlop={4}
        onPress={() => router.push('/membership')}
        style={({ pressed }) => [styles.chip, styles.ticket, pressed && styles.pressed]}
      >
        <Svg width={17} height={17} viewBox="0 0 24 24">
          <Path
            d={TICKET}
            fill="none"
            stroke={colors.accentInk}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={[styles.count, status.tickets < 0 && { color: colors.danger }]}>
          {status.tickets}
        </Text>
      </Pressable>
      {status.free_packs > 0 &&
        link(
          `${status.free_packs} free packs`,
          '/packs',
          <Feather name="package" size={16} color={colors.accentInk} />,
          status.free_packs,
        )}
      {status.offers > 0 &&
        link(
          `${status.offers} trade offers`,
          '/trades',
          <Feather name="repeat" size={16} color={colors.accentInk} />,
          status.offers,
        )}
      <View style={styles.rule} />
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={
          status.unread ? `Notifications, ${status.unread} unread` : 'Notifications'
        }
        hitSlop={4}
        onPress={() => router.push('/notifications')}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        <Feather name="bell" size={17} color={colors.accentInk} />
        {status.unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{status.unread > 99 ? '99+' : status.unread}</Text>
          </View>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Your account"
        hitSlop={6}
        onPress={() => setMenu(true)}
        style={({ pressed }) => [styles.me, pressed && styles.pressed]}
      >
        <Avatar person={person} badge={status.ring_style} size={18} />
      </Pressable>
      <ChoiceSheet
        visible={menu}
        title="Your account"
        header={
          <View style={styles.who}>
            <Avatar person={person} badge={status.ring_style} size={42} />
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.name}>
                  {user.profile.display_name || user.profile.username}
                </Text>
                <SupporterEmblem tier={status.supporter_tier} size={16} />
              </View>
              <Text style={styles.handle}>
                @{user.profile.username} · {status.tickets} tickets
              </Text>
            </View>
          </View>
        }
        choices={[
          { value: 'profile', label: 'Your profile', icon: 'user' },
          {
            value: 'membership',
            label: 'Membership',
            icon: 'star',
            note: supporter ? 'Supporter' : 'Become a supporter',
          },
          {
            value: 'appearance',
            label: 'Appearance',
            icon: 'droplet',
            note: getTheme(user.theme).name,
          },
          { value: 'account', label: 'Account', icon: 'settings' },
          { value: 'blocked', label: 'Blocked collectors', icon: 'slash' },
          { value: 'logout', label: 'Log out', icon: 'log-out' },
        ]}
        onClose={() => setMenu(false)}
        onChoose={(value) => {
          setMenu(false);
          if (value === 'logout') void logout();
          else router.push(MENU[value as keyof typeof MENU]);
        }}
      />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginRight: 12,
    padding: 3,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
    boxShadow: shadows(colors).lift,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 7,
    borderRadius: 8,
  },
  pressed: { backgroundColor: colors.sur2 },
  ticket: { backgroundColor: colors.sur2, borderWidth: 1, borderColor: colors.bdr2 },
  count: { color: colors.accentInk, fontFamily: fonts.display, fontSize: 19 },
  rule: { width: 1, height: 18, marginHorizontal: 1, backgroundColor: colors.bdr2 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  badgeText: { color: colors.accentText, fontFamily: fonts.medium, fontSize: 9 },
  me: { paddingHorizontal: 7, height: 30, justifyContent: 'center' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, color: colors.pageText, fontFamily: fonts.medium, fontSize: 17 },
  handle: { color: colors.pageMuted, fontFamily: fonts.body, fontSize: 14 },
}));
