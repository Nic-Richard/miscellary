import { SHOWCASE_SLOTS } from '@miscellary/shared';
import type { OwnedCard, ProfilePage } from '@miscellary/shared';
import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { sendReport, setFollow } from '@/lib/endpoints';
import PeopleList from './PeopleList';
import { colors } from '@/lib/theme';
import CardInspector from './CardInspector';
import DemoBadge from './DemoBadge';
import SharedSurface from './SharedSurface';
import { Button, Muted } from './ui';

export default function ProfileView({
  profile: initial,
  headerExtra,
}: {
  profile: ProfilePage;
  headerExtra?: React.ReactNode;
}) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(initial);
  const [selected, setSelected] = useState<OwnedCard | null>(null);
  const [people, setPeople] = useState<'followers' | 'following' | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const showcase = useMemo(
    () =>
      Array.from(
        { length: SHOWCASE_SLOTS },
        (_, index) => profile.showcase.find((slot) => slot.position === index + 1) ?? null,
      ),
    [profile.showcase],
  );
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

  function report() {
    Alert.alert(`Report @${profile.username}`, undefined, [
      {
        text: 'Harassment',
        onPress: () =>
          void sendReport({ username: profile.username, reason: 'harassment', details: '' }),
      },
      {
        text: 'Spam',
        onPress: () => void sendReport({ username: profile.username, reason: 'spam', details: '' }),
      },
      {
        text: 'Something else',
        onPress: () =>
          void sendReport({ username: profile.username, reason: 'other', details: '' }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>
            {profile.username[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
            {profile.display_name || profile.username}
          </Text>
          {profile.is_demo ? <DemoBadge /> : null}
          <Muted>@{profile.username}</Muted>
        </View>
      </View>
      {profile.bio ? <Muted>{profile.bio}</Muted> : null}
      <View style={styles.counts}>
        <Pressable
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => setPeople(people === 'followers' ? null : 'followers')}
        >
          <Text style={styles.countLink}>{profile.follower_count} followers</Text>
        </Pressable>
        <Muted style={styles.count}>·</Muted>
        <Pressable
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => setPeople(people === 'following' ? null : 'following')}
        >
          <Text style={styles.countLink}>{profile.following_count} following</Text>
        </Pressable>
        <Muted style={styles.count}>
          · {profile.set_count} sets · {profile.card_count} cards
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
        {!profile.is_me && user ? (
          <>
            <Button
              title={profile.is_following ? 'Following' : 'Follow'}
              kind={profile.is_following ? 'secondary' : 'primary'}
              disabled={followBusy}
              onPress={() => void toggleFollow()}
            />
            <Button
              title="Trade"
              kind="secondary"
              onPress={() =>
                router.push({ pathname: '/trades/new', params: { with: profile.username } })
              }
            />
            <Button title="Report" kind="secondary" onPress={report} />
          </>
        ) : null}
      </View>

      <Text style={styles.h2}>Binder</Text>
      <SharedSurface
        mode="profile-binder"
        data={{
          slots: showcase,
          title: profile.showcase_title,
          colour: profile.binder_colour,
          mine: profile.is_me,
        }}
        autoHeight
        onEvent={(type, id) => {
          if (type === 'inspect') {
            setSelected(showcase.find((slot) => slot?.owned_card.id === id)?.owned_card ?? null);
          }
        }}
      />

      <Text style={styles.h2}>Sets by @{profile.username}</Text>
      {profile.sets.length === 0 ? <Muted>No published sets.</Muted> : null}
      {profile.sets.map((s) => (
        <Link
          key={s.id}
          href={{ pathname: '/sets/[slug]', params: { slug: s.slug } }}
          style={styles.setRow}
        >
          <Text style={{ color: colors.accent }}>{s.title}</Text>
          <Text style={{ color: colors.faint, fontSize: 12 }}>
            {'  '}
            {s.card_count} cards · ♥ {s.like_count}
          </Text>
        </Link>
      ))}
      {selected ? (
        <Modal
          visible
          statusBarTranslucent
          navigationBarTranslucent
          supportedOrientations={['portrait', 'landscape']}
          onRequestClose={() => setSelected(null)}
        >
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
        </Modal>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.sur2,
    borderWidth: 2,
    borderColor: colors.bdr2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  counts: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  count: { fontSize: 13 },
  countLink: { color: colors.accent, fontSize: 13 },
  h2: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 8 },
  inspector: { flex: 1, backgroundColor: '#241d16' },
  setRow: {
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
  },
});
