import { useCallback, useEffect, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { router, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { AccountStatus } from '@miscellary/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { onStatusChange } from '@/lib/membership';
import { createThemedStyles, fonts, useColors } from '@/lib/theme';

const TICKET =
  'M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4Z';

/** Tickets, free packs, offers and notifications, shown in each main tab's header. */
export default function StatusPill() {
  const colors = useColors();
  const styles = useStyles();
  const { user } = useAuth();
  const pathname = usePathname();
  const [status, setStatus] = useState<AccountStatus | null>(null);

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

  if (!status) return null;
  const item = (
    label: string,
    href: string,
    icon: React.ReactNode,
    count: number | null,
    highlight = false,
  ) => (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={() => router.push(href as never)}
      style={({ pressed }) => [
        styles.chip,
        highlight && styles.ticket,
        pressed && { backgroundColor: colors.sur2 },
      ]}
    >
      {icon}
      {count !== null && (
        <Text style={[styles.count, count < 0 && { color: colors.danger }]}>{count}</Text>
      )}
    </Pressable>
  );
  return (
    <View style={styles.bar}>
      {status.tickets !== null &&
        item(
          status.tickets < 0 ? `${-status.tickets} tickets owed` : `${status.tickets} tickets`,
          '/membership',
          <Svg width={17} height={17} viewBox="0 0 24 24">
            <Path
              d={TICKET}
              fill="none"
              stroke={colors.accentInk}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          </Svg>,
          status.tickets,
          true,
        )}
      {status.free_packs > 0 &&
        item(
          `${status.free_packs} free packs`,
          '/packs',
          <Feather name="package" size={16} color={colors.accentInk} />,
          status.free_packs,
        )}
      {status.offers > 0 &&
        item(
          `${status.offers} trade offers`,
          '/trades',
          <Feather name="repeat" size={16} color={colors.accentInk} />,
          status.offers,
        )}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={
          status.unread ? `Notifications, ${status.unread} unread` : 'Notifications'
        }
        hitSlop={4}
        onPress={() => router.push('/notifications')}
        style={({ pressed }) => [styles.chip, pressed && { backgroundColor: colors.sur2 }]}
      >
        <Feather name="bell" size={17} color={colors.accentInk} />
        {status.unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{status.unread > 99 ? '99+' : status.unread}</Text>
          </View>
        )}
      </Pressable>
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  ticket: { backgroundColor: colors.sur2, borderWidth: 1, borderColor: colors.bdr2 },
  count: { color: colors.accentInk, fontFamily: fonts.display, fontSize: 19 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  badgeText: { color: colors.accentText, fontFamily: fonts.medium, fontSize: 10 },
}));
