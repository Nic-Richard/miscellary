import { SHOWCASE_SLOTS } from '@miscellary/shared';
import type { OwnedCard, ProfilePage } from '@miscellary/shared';
import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { sendReport, setFollow } from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import NativeBinderPager from './binder/NativeBinderPager';
import ProfileBinderDetails from './ProfileBinderDetails';
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
  const { width, height } = useWindowDimensions();
  const [profile, setProfile] = useState(initial);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<OwnedCard | null>(null);
  const showcase = useMemo(
    () =>
      Array.from(
        { length: SHOWCASE_SLOTS },
        (_, index) => profile.showcase.find((slot) => slot.position === index + 1) ?? null,
      ),
    [profile.showcase],
  );
  const landscape = width > height;
  const rail = landscape && width >= 800;
  const shownPage = landscape ? Math.floor(page / 2) * 2 : page;
  const pages = SHOWCASE_SLOTS / 4;

  async function toggleFollow() {
    const r = await setFollow(profile.username, !profile.is_following);
    setProfile({ ...profile, is_following: r.following, follower_count: r.follower_count });
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
          <Muted>@{profile.username}</Muted>
        </View>
      </View>
      {profile.bio ? <Muted>{profile.bio}</Muted> : null}
      <Muted style={{ fontSize: 13 }}>
        {profile.follower_count} followers · {profile.following_count} following ·{' '}
        {profile.set_count} sets · {profile.card_count} cards
      </Muted>
      <View style={styles.actions}>
        {headerExtra}
        {!profile.is_me && user ? (
          <>
            <Button
              title={profile.is_following ? 'Following' : 'Follow'}
              kind={profile.is_following ? 'secondary' : 'primary'}
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
      <View style={{ flexDirection: rail ? 'row' : 'column', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <NativeBinderPager
            cards={showcase.map((slot) => slot?.owned_card.card)}
            marks={showcase.map((slot) => slot?.owned_card.set_mark)}
            page={shownPage}
            pages={pages}
            half={!landscape}
            colour={profile.binder_colour}
            onPageChange={setPage}
            onInspect={(_, index) => setSelected(showcase[index]?.owned_card ?? null)}
          />
          <View style={styles.pager}>
            <Button
              title="Previous"
              kind="secondary"
              disabled={shownPage === 0}
              onPress={() => setPage(Math.max(0, shownPage - (landscape ? 2 : 1)))}
            />
            <Muted>
              {shownPage + 1}
              {landscape ? `–${shownPage + 2}` : ''} / {pages}
            </Muted>
            <Button
              title="Next"
              kind="secondary"
              disabled={shownPage + (landscape ? 2 : 1) >= pages}
              onPress={() => setPage(shownPage + (landscape ? 2 : 1))}
            />
          </View>
        </View>
        <View style={{ width: rail ? 240 : '100%' }}>
          <ProfileBinderDetails cards={showcase.map((slot) => slot?.owned_card)} />
        </View>
      </View>

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
            <SharedSurface
              mode="inspect"
              data={{
                card: selected.card,
                setTitle: selected.set_title,
                setSlug: selected.set_slug,
                mark: selected.set_mark,
              }}
              onEvent={(type) => {
                if (type === 'close') setSelected(null);
              }}
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
  h2: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 8 },
  pager: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inspector: { flex: 1, backgroundColor: '#241d16' },
  setRow: {
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
  },
});
