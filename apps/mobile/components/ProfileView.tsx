import { BLOCK_COPY, cardCode, profilePath, SHOWCASE_SLOTS } from '@miscellary/shared';
import type { OwnedCard, ProfilePage } from '@miscellary/shared';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { setBlocked, setFollow } from '@/lib/endpoints';
import BinderViewer from './BinderViewer';
import VerifyEmailNotice from './VerifyEmailNotice';
import InspectorModal from './InspectorModal';
import MoreButton from '@/components/MoreButton';
import ReportSheet from '@/components/ReportSheet';
import ShareButton from '@/components/ShareButton';
import PeopleList from './PeopleList';
import { clothTexture, fonts, useColors, createThemedStyles } from '@/lib/theme';
import CardInspector from './CardInspector';
import CardPreview from './CardPreview';
import { confirmBlock } from './BlockedPeople';
import DemoBadge from './DemoBadge';
import SupporterBadge from './SupporterBadge';
import SharedSurface from './SharedSurface';
import SetTile from './SetTile';
import StatRows from './StatRows';
import { Button, Muted, Panel } from './ui';
import SupporterEmblem from '@/components/SupporterEmblem';

export default function ProfileView({
  profile: initial,
  headerExtra,
  editBinder,
}: {
  profile: ProfilePage;
  headerExtra?: React.ReactNode;
  editBinder?: { pick: (position: number) => void; remove: (position: number) => void };
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
  const capacity = profile.showcase_slots ?? SHOWCASE_SLOTS;
  const showcase = useMemo(
    () =>
      Array.from(
        { length: capacity },
        (_, index) => profile.showcase.find((slot) => slot.position === index + 1) ?? null,
      ),
    [profile.showcase, capacity],
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
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Panel style={styles.hero}>
        <View style={styles.header}>
          <View style={styles.idSleeve} accessible={false}>
            <View style={styles.idCard}>
              <Image source={clothTexture} resizeMode="repeat" style={styles.cloth} />
              <View style={styles.idTint} />
              <Text style={styles.idLabel}>
                {profile.subscriber_badge ? 'SUPPORTER' : 'COLLECTOR'}
              </Text>
              <View style={styles.monogram}>
                <Text style={styles.monogramText}>{profile.username[0]?.toUpperCase()}</Text>
              </View>
              <Text numberOfLines={1} style={styles.idHandle}>
                @{profile.username}
              </Text>
            </View>
          </View>
          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile.display_name || profile.username}</Text>
              <SupporterEmblem
                tier={profile.supporter_tier}
                months={profile.supporter_months}
                size={20}
              />
            </View>
            {profile.subscriber_badge && <SupporterBadge badge={profile.badge_style} />}
            {profile.is_demo ? <DemoBadge /> : null}
            <Muted style={styles.small}>
              @{profile.username}, collecting since{' '}
              {new Date(profile.created_at).toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })}
            </Muted>
          </View>
        </View>
        {profile.bio ? <Muted>{profile.bio}</Muted> : null}
        {profile.featured_card ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Featured card, ${profile.featured_card.title}`}
            onPress={() =>
              router.push({
                pathname: '/sets/[slug]',
                params: { slug: profile.featured_card!.set_slug },
              })
            }
            style={({ pressed }) => [styles.featured, pressed && { opacity: 0.8 }]}
          >
            <CardPreview
              width={44}
              title={profile.featured_card.title}
              rarity={profile.featured_card.rarity}
              imageUrl={profile.featured_card.image?.url ?? null}
              templateKey={profile.featured_card.template_key}
              templateConfig={profile.featured_card.template_config}
              code={cardCode(
                profile.featured_card.printed_set_code,
                profile.featured_card.position,
                profile.featured_card.set_total,
              )}
              printedText={profile.featured_card.printed_text}
              render={profile.featured_card.render}
            />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={styles.featuredLabel}>Featured card</Text>
              <Text style={styles.featuredTitle} numberOfLines={1}>
                {profile.featured_card.title}
              </Text>
              <Text style={styles.featuredSet} numberOfLines={1}>
                {profile.featured_card.set_title}
              </Text>
            </View>
          </Pressable>
        ) : null}
        {profile.is_demo ? (
          <Muted style={styles.small}>
            This collector is fictional and is here to demonstrate Miscellary. The photographs are
            real work by the people credited on each card.
          </Muted>
        ) : null}
        <View style={styles.actions}>
          {headerExtra}
          {!profile.is_me && user && profile.is_blocked ? (
            <>
              <Muted style={{ flexBasis: '100%' }}>{BLOCK_COPY.blocked}</Muted>
              <Button
                title="Unblock"
                kind="secondary"
                small
                disabled={blockBusy}
                onPress={() => void toggleBlock(false)}
              />
            </>
          ) : !profile.is_me && user ? (
            <>
              <Button
                title={profile.is_following ? 'Following' : 'Follow'}
                kind={profile.is_following ? 'secondary' : 'primary'}
                small
                disabled={followBusy}
                onPress={() => void toggleFollow()}
              />
              <Button
                title="Offer a trade"
                kind="secondary"
                small
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
                ? []
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
        <View style={styles.stats}>
          <StatRows
            stats={[
              {
                icon: 'followers',
                value: profile.follower_count,
                label: 'Followers',
                expanded: people === 'followers',
                onPress: () => setPeople(people === 'followers' ? null : 'followers'),
              },
              {
                icon: 'following',
                value: profile.following_count,
                label: 'Following',
                expanded: people === 'following',
                onPress: () => setPeople(people === 'following' ? null : 'following'),
              },
              { icon: 'sets', value: profile.set_count, label: 'Sets created' },
              { icon: 'cards', value: profile.card_count, label: 'Cards collected' },
            ]}
          />
        </View>
        {people ? (
          <PeopleList
            username={profile.username}
            direction={people}
            onClose={() => setPeople(null)}
          />
        ) : null}
      </Panel>
      <ReportSheet
        visible={reporting}
        subject={`@${profile.username}`}
        target={{ username: profile.username }}
        onClose={() => setReporting(false)}
      />

      {profile.is_me ? (
        <VerifyEmailNotice>Verify your email address to trade and publish sets.</VerifyEmailNotice>
      ) : null}

      <Panel>
        <View style={styles.binderHead}>
          <Text style={styles.panelTitle}>
            {profile.showcase_title?.trim() || 'The pride of the collection'}
          </Text>
          <Muted style={styles.small}>
            {profile.showcase.length} of {capacity} sleeves filled
          </Muted>
        </View>
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
        <Button title="Open the binder" kind="secondary" onPress={() => setBinderOpen(true)} />
      </Panel>
      {binderOpen ? (
        <BinderViewer
          title={profile.showcase_title?.trim() || 'The pride of the collection'}
          subtitle={`@${profile.username}`}
          spreads={Math.ceil(capacity / 8)}
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

      <Panel>
        <Text style={styles.panelTitle}>
          {profile.is_me ? 'Your sets' : `Sets by @${profile.username}`}
        </Text>
        {profile.sets.length === 0 ? (
          profile.is_me ? (
            <View style={styles.emptySets}>
              <Muted>Nothing published yet.</Muted>
              <Button
                title="Open the studio"
                kind="quiet"
                small
                onPress={() => router.push('/studio')}
              />
            </View>
          ) : (
            <Muted>No published sets.</Muted>
          )
        ) : null}
        <View style={styles.setGrid}>
          {profile.sets.map((s) => (
            <View key={s.id} style={styles.setCell}>
              <SetTile set={s} />
            </View>
          ))}
        </View>
      </Panel>
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
  content: { padding: 14, gap: 14, paddingBottom: 40 },
  hero: { gap: 14 },
  header: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  idSleeve: {
    width: 104,
    padding: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(255,255,255,0.5)',
    boxShadow: '0 0 0 1px rgba(120,105,80,0.18), 0 8px 18px rgba(40,30,16,0.16)',
    transform: [{ rotate: '-2deg' }],
  },
  idCard: {
    aspectRatio: 5 / 7,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#6c948e',
    overflow: 'hidden',
    boxShadow: 'inset 0 0 0 3px rgba(246,240,228,0.9), inset 0 0 0 4px rgba(90,120,115,0.4)',
  },
  cloth: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  idTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    experimental_backgroundImage: 'linear-gradient(rgba(150,187,181,0.86), rgba(110,158,150,0.9))',
  },
  idLabel: { color: '#f6f0e4', fontFamily: fonts.medium, fontSize: 8, letterSpacing: 1.6 },
  monogram: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f0e4',
    boxShadow: '0 0 0 2px #c9a24a, 0 0 0 4px rgba(246,240,228,0.5)',
  },
  monogramText: { color: '#2f6e67', fontFamily: fonts.display, fontSize: 28 },
  idHandle: { color: '#f6f0e4', fontFamily: fonts.display, fontSize: 12, letterSpacing: 0.8 },
  identity: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  name: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 32,
    textTransform: 'uppercase',
  },
  small: { fontSize: 14 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  stats: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: colors.bdr2,
  },
  binderHead: { gap: 2 },
  binderPreview: { borderRadius: 10, overflow: 'hidden' },
  panelTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 24,
    textTransform: 'uppercase',
  },
  emptySets: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  setGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  setCell: { width: '47%', flexGrow: 1 },
  featured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur2,
  },
  featuredLabel: { color: colors.faint, fontSize: 12 },
  featuredTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  featuredSet: { color: colors.accentInk, fontSize: 13 },
  inspector: { flex: 1, backgroundColor: '#241d16' },
}));
