import type { ProfilePage } from '@miscellary/shared';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { sendReport, setFollow } from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import CardPreview from './CardPreview';
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

      <Text style={styles.h2}>Showcase</Text>
      {profile.showcase.length === 0 ? <Muted>Nothing showcased yet.</Muted> : null}
      <View style={styles.grid}>
        {profile.showcase.map((slot) => (
          <CardPreview
            key={slot.position}
            width={150}
            title={slot.owned_card.card.title}
            rarity={slot.owned_card.card.rarity}
            imageUrl={slot.owned_card.card.image.url}
            templateKey={slot.owned_card.card.template_key}
            templateConfig={slot.owned_card.card.template_config}
          />
        ))}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  setRow: {
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
  },
});
