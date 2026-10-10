import { BLOCK_COPY, profilePath, SHOWCASE_SLOTS } from '@miscellary/shared';
import type { OwnedCard, ProfilePage } from '@miscellary/shared';
import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { setBlocked, setFollow } from '@/lib/endpoints';
import BinderViewer from './BinderViewer';
import VerifyEmailNotice from './VerifyEmailNotice';
import InspectorModal from './InspectorModal';
import MoreButton from '@/components/MoreButton';
import type { MoreItem } from '@/components/MoreButton';
import ReportSheet from '@/components/ReportSheet';
import ShareButton from '@/components/ShareButton';
import PeopleList from './PeopleList';
import { useColors, createThemedStyles } from '@/lib/theme';
import CardInspector from './CardInspector';
import Avatar from './Avatar';
import { confirmBlock } from './BlockedPeople';
import DemoBadge from './DemoBadge';
import SupporterBadge from './SupporterBadge';
import SharedSurface from './SharedSurface';
import { Button, Muted } from './ui';

export default function ProfileView({
  profile: initial,
  headerExtra,
  editBinder,
  ownItems = [],
}: {
  profile: ProfilePage;
  headerExtra?: React.ReactNode;
  editBinder?: { pick: (position: number) => void; remove: (position: number) => void };
  /** Menu items for your own profile, where there is nothing to report. */
  ownItems?: MoreItem[];
}) {
  const colors = useColors();
  const styles = useStyles();
  const { user } = useAuth();
  const [profile, setProfile] = useState(initial);
  useEffect(() => setProfile(initial), [initial]);
  const [selected, setSelected] = useState<OwnedCard | null>(null);
  const [binderOpen, setBinderOpen] = useState(false);
  const [people, setPeople] = useState<'followers' | 'following' | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const showcase = useMemo(
    () =>
      Array.from(
        { length: SHOWCASE_SLOTS },
        (_, index) => profile.showcase.find((slot) => slot.position === index + 1) ?? null,
      ),
    [profile.showcase],
  );
  const binderData = {
    slots: showcase,
    colour: profile.binder_colour,
    mine: profile.is_me,
  };
  async function toggleBlock(blocked: boolean) {
    if (blockBusy) return;
    setBlockBusy(true);
    try {
      await setBlocked(profile.username, blocked);
      setProfile((current) => ({
        ...current,
        is_blocked: blocked,
        is_following: blocked ? false : current.is_following,
        follower_count:
          blocked && current.is_following ? current.follower_count - 1 : current.follower_count,
      }));
    } catch (e) {
      Alert.alert('Could not update the block', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBlockBusy(false);
    }
  }

  async function toggleFollow() {
    if (followBusy) return;
    const next = !profile.is_following;
    setFollowBusy(true);
    setProfile((current) => ({
      ...current,
      is_following: next,
      follower_count: current.follower_count + (next ? 1 : -1),
    }));
    try {
      const result = await setFollow(profile.username, next);
      setProfile((current) => ({
        ...current,
        is_following: result.following,
        follower_count: result.follower_count,
      }));
    } catch (e) {
      setProfile((current) => ({
        ...current,
        is_following: !next,
        follower_count: current.follower_count + (next ? -1 : 1),
      }));
      Alert.alert('Could not update follow', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setFollowBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
    >
      <View style={styles.header}>
        <Avatar
          person={{ ...profile, deleted: false }}
          supporter={Boolean(profile.subscriber_badge)}
          size={56}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.pageText, fontSize: 22, fontWeight: '700' }}>
            {profile.display_name || profile.username}
          </Text>
          {profile.subscriber_badge && <SupporterBadge />}
          {profile.is_demo ? <DemoBadge /> : null}
          <Muted style={{ color: colors.pageMuted }}>@{profile.username}</Muted>
        </View>
      </View>
      {profile.bio ? <Muted style={{ color: colors.pageMuted }}>{profile.bio}</Muted> : null}
      {profile.is_demo ? (
        <Muted style={{ fontSize: 14 }}>
          This collector is fictional and is here to demonstrate Miscellary. The photographs are
          real work by the people credited on each card.
        </Muted>
      ) : null}
      <View style={styles.counts}>
        <Pressable
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => setPeople(people === 'followers' ? null : 'followers')}
        >
          <Text style={styles.countLink}>
            {profile.follower_count} {profile.follower_count === 1 ? 'follower' : 'followers'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => setPeople(people === 'following' ? null : 'following')}
        >
          <Text style={styles.countLink}>{profile.following_count} following</Text>
        </Pressable>
        <Muted style={styles.count}>
          {profile.set_count} {profile.set_count === 1 ? 'set' : 'sets'}
        </Muted>
        <Muted style={styles.count}>
          {profile.card_count} {profile.card_count === 1 ? 'card' : 'cards'}
        </Muted>
      </View>
      {people ? (
        <PeopleList
          username={profile.username}
          direction={people}
          onClose={() => setPeople(null)}
        />
      ) : null}
      <View style={styles.actions}>
        {headerExtra}
        {!profile.is_me && user && profile.is_blocked ? (
          <>
            <Muted style={{ flexBasis: '100%' }}>{BLOCK_COPY.blocked}</Muted>
            <Button
              title="Unblock"
              kind="secondary"
              disabled={blockBusy}
              onPress={() => void toggleBlock(false)}
            />
          </>
        ) : !profile.is_me && user ? (
          <>
            <Button
              title={profile.is_following ? 'Following' : 'Follow'}
              kind={profile.is_following ? 'secondary' : 'primary'}
              disabled={followBusy}
              onPress={() => void toggleFollow()}
            />
            <Button
              title="Offer a trade"
              kind="secondary"
              onPress={() =>
                router.push({ pathname: '/trades/new', params: { with: profile.username } })
              }
            />
          </>
        ) : null}
        <ShareButton
          path={profilePath(profile.username)}
          title={`${profile.display_name || profile.username} on Miscellary`}
        />
        <MoreButton
          title={`@${profile.username}`}
          items={
            profile.is_me
              ? ownItems
              : user
                ? [
                    {
                      label: 'Report this collector',
                      icon: 'flag',
                      onSelect: () => setReporting(true),
                    },
                    ...(profile.is_blocked
                      ? []
                      : [
                          {
                            label: `Block @${profile.username}`,
                            icon: 'slash' as const,
                            onSelect: () =>
                              confirmBlock(profile.username, () => void toggleBlock(true)),
                          },
                        ]),
                  ]
                : []
          }
        />
      </View>
      <ReportSheet
        visible={reporting}
        subject={`@${profile.username}`}
        target={{ username: profile.username }}
        onClose={() => setReporting(false)}
      />

      {profile.is_me ? (
        <VerifyEmailNotice>Verify your email address to trade and publish sets.</VerifyEmailNotice>
      ) : null}

      <Text style={styles.h2}>Binder</Text>
      <View style={styles.binder}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open binder"
          onPress={() => setBinderOpen(true)}
          style={({ pressed }) => [styles.binderPreview, { opacity: pressed ? 0.85 : 1 }]}
        >
          <SharedSurface
            mode="profile-binder"
            data={{ ...binderData, preview: true, page: 0 }}
            autoHeight
            passive
          />
        </Pressable>
        <Muted>
          {profile.showcase_title?.trim() || 'The pride of the collection'} ·{' '}
          {profile.showcase.length} of {SHOWCASE_SLOTS} sleeves filled
        </Muted>
        <Button title="Open binder" onPress={() => setBinderOpen(true)} />
      </View>
      {binderOpen ? (
        <BinderViewer
          title={profile.showcase_title?.trim() || 'The pride of the collection'}
          subtitle={`@${profile.username}`}
          spreads={SHOWCASE_SLOTS / 8}
          surface={(spread, editing) => ({
            mode: 'profile-binder',
            data: { ...binderData, fill: true, page: spread, editing },
          })}
          onEdit={editBinder}
          spreadOf={(page) => page}
          onClose={() => setBinderOpen(false)}
          onInspect={(id) =>
            setSelected(showcase.find((slot) => slot?.owned_card.id === id)?.owned_card ?? null)
          }
        />
      ) : null}

      <Text style={styles.h2}>Sets by @{profile.username}</Text>
      {profile.sets.length === 0 ? <Muted>No published sets.</Muted> : null}
      {profile.sets.map((s) => (
        <Link
          key={s.id}
          href={{ pathname: '/sets/[slug]', params: { slug: s.slug } }}
          style={styles.setRow}
        >
          <Text style={{ color: colors.accent }}>{s.title}</Text>
          <Text style={{ color: colors.faint, fontSize: 14 }}>
            {'  '}
            {s.card_count} cards · ♥ {s.like_count}
          </Text>
        </Link>
      ))}
      {selected ? (
        <InspectorModal open onClose={() => setSelected(null)}>
          <View style={styles.inspector}>
            <CardInspector
              card={selected.card}
              setTitle={selected.set_title}
              setSlug={selected.set_slug}
              mark={selected.set_mark}
              packColour={selected.set_pack_colour}
              copies={selected.copies}
              onClose={() => setSelected(null)}
            />
          </View>
        </InspectorModal>
      ) : null}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  header: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  binder: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  binderPreview: { borderRadius: 10, overflow: 'hidden' },
  counts: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 4,
  },
  count: { fontSize: 14 },
  countLink: { color: colors.pageAccent, fontSize: 14 },
  h2: { color: colors.pageText, fontSize: 16, fontWeight: '700', marginTop: 8 },
  inspector: { flex: 1, backgroundColor: '#241d16' },
  setRow: {
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
  },
}));
