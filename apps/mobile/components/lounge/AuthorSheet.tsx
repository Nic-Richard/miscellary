import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import type { UserSummary } from '@miscellary/shared';
import { cardCode } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import CardPreview from '@/components/CardPreview';
import Sheet from '@/components/Sheet';
import StatRows from '@/components/StatRows';
import SupporterEmblem from '@/components/SupporterEmblem';
import { Button, ErrorText, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { setFollow } from '@/lib/endpoints';
import { userSummary } from '@/lib/lounge';
import { createThemedStyles, fonts } from '@/lib/theme';

/** A collector at a glance from a Lounge post, like the website's hover card. */
export default function AuthorSheet({
  username,
  onClose,
  onFollowChange,
}: {
  username: string | null;
  onClose: () => void;
  onFollowChange?: (summary: UserSummary) => void;
}) {
  const styles = useStyles();
  const { user } = useAuth();
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSummary(null);
    setError(null);
    if (!username) return;
    let active = true;
    userSummary(username)
      .then((next) => active && setSummary(next))
      .catch(() => active && setError('This profile could not load.'));
    return () => {
      active = false;
    };
  }, [username]);

  async function follow() {
    if (!summary || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await setFollow(summary.username, !summary.is_following);
      const next = {
        ...summary,
        is_following: result.following,
        follower_count: result.follower_count,
      };
      setSummary(next);
      onFollowChange?.(next);
      void userSummary(summary.username, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not follow that collector.');
    } finally {
      setBusy(false);
    }
  }

  function go(path: Parameters<typeof router.push>[0]) {
    onClose();
    router.push(path);
  }

  const featured = summary?.featured_card;
  const other = Boolean(user && summary && !summary.is_me && !summary.is_blocked);
  return (
    <Sheet
      visible={username !== null}
      onClose={onClose}
      header={
        summary ? (
          <View style={styles.head}>
            <Avatar person={summary} badge={summary.badge_style} size={52} />
            <View style={styles.headText}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.name}>
                  {summary.display_name || summary.username}
                </Text>
                <SupporterEmblem
                  tier={summary.supporter_tier}
                  months={summary.supporter_months}
                  size={16}
                />
              </View>
              <Text style={styles.muted}>
                @{summary.username}, collecting since{' '}
                {new Date(summary.created_at).toLocaleDateString(undefined, {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>
        ) : undefined
      }
      footer={
        summary ? (
          <Button
            title="View profile"
            kind="secondary"
            style={styles.wide}
            onPress={() => go(`/users/${summary.username}`)}
          />
        ) : undefined
      }
    >
      {!summary ? (
        error ? (
          <ErrorText>{error}</ErrorText>
        ) : (
          <Loading />
        )
      ) : (
        <>
          {summary.bio ? <Text style={styles.bio}>{summary.bio}</Text> : null}
          {featured && (
            <View style={styles.featured}>
              <CardPreview
                width={44}
                title={featured.title}
                rarity={featured.rarity}
                imageUrl={featured.image?.url ?? null}
                templateKey={featured.template_key}
                templateConfig={featured.template_config}
                code={cardCode(featured.printed_set_code, featured.position, featured.set_total)}
                printedText={featured.printed_text}
                render={featured.render}
              />
              <View style={styles.headText}>
                <Text style={styles.small}>Featured card</Text>
                <Text numberOfLines={1} style={styles.featuredTitle}>
                  {featured.title}
                </Text>
                <Text numberOfLines={1} style={styles.small}>
                  {featured.set_title}
                </Text>
              </View>
            </View>
          )}
          <View style={styles.stats}>
            <StatRows
              stats={[
                { icon: 'followers', value: summary.follower_count, label: 'Followers' },
                { icon: 'sets', value: summary.set_count, label: 'Sets created' },
                { icon: 'cards', value: summary.card_count, label: 'Cards collected' },
              ]}
            />
          </View>
          {other && (
            <View style={styles.actions}>
              <Button
                title={summary.is_following ? 'Following' : 'Follow'}
                kind={summary.is_following ? 'secondary' : 'primary'}
                style={styles.wide}
                disabled={busy}
                onPress={() => void follow()}
              />
              <Button
                title="Offer a trade"
                kind="secondary"
                style={styles.wide}
                onPress={() => go({ pathname: '/trades/new', params: { with: summary.username } })}
              />
            </View>
          )}
          <ErrorText>{error}</ErrorText>
        </>
      )}
    </Sheet>
  );
}

const useStyles = createThemedStyles((colors) => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, color: colors.pageText, fontFamily: fonts.display, fontSize: 26 },
  muted: { color: colors.pageMuted, fontFamily: fonts.body, fontSize: 14 },
  small: { color: colors.pageMuted, fontFamily: fonts.body, fontSize: 13 },
  bio: { color: colors.pageText, fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  featured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  featuredTitle: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  stats: { paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.bdr },
  actions: { flexDirection: 'row', gap: 10 },
  wide: { flex: 1 },
}));
