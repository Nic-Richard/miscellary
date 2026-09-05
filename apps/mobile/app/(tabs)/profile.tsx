import { SHOWCASE_SLOTS } from '@miscellary/shared';
import type { OwnedCard, ProfilePage } from '@miscellary/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CardPreview from '@/components/CardPreview';
import LoginGate from '@/components/LoginGate';
import ProfileView from '@/components/ProfileView';
import { useAuth } from '@/lib/auth';
import { getProfile, getShowcase, listMyCards, saveShowcase, updateProfile } from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import { Button, ErrorText, Input, Loading, Muted, Title } from '@/components/ui';

function Me() {
  const { user, logout, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfilePage | null>(null);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [slots, setSlots] = useState<(string | null)[]>(Array(SHOWCASE_SLOTS).fill(null));
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [p, page, showcase] = await Promise.all([
        getProfile(user.profile.username),
        listMyCards(),
        getShowcase(),
      ]);
      setProfile(p);
      setDisplayName(p.display_name);
      setBio(p.bio);
      setCards(page.results);
      const next: (string | null)[] = Array(SHOWCASE_SLOTS).fill(null);
      for (const s of showcase) next[s.position] = s.owned_card.id;
      setSlots(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your profile.');
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function saveProfile() {
    try {
      await updateProfile({ display_name: displayName, bio });
      await refreshUser();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  async function persistSlots(next: (string | null)[]) {
    setSlots(next);
    setPicking(null);
    try {
      await saveShowcase(
        next.flatMap((id, position) => (id ? [{ position, owned_card_id: id }] : [])),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the showcase.');
    }
  }

  if (!profile) return error ? <ErrorText>{error}</ErrorText> : <Loading />;
  const byId = new Map(cards.map((c) => [c.id, c]));

  if (editing)
    return (
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      >
        <Title>Edit profile</Title>
        <ErrorText>{error}</ErrorText>
        <Input
          placeholder="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={40}
        />
        <Input
          placeholder="Bio"
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={280}
          style={{ minHeight: 70 }}
        />
        <Button
          title="Save profile"
          onPress={async () => {
            await saveProfile();
            setEditing(false);
          }}
        />

        <Text style={styles.h2}>Showcase</Text>
        <Muted>Tap a slot to pick one of your cards.</Muted>
        <View style={styles.grid}>
          {slots.map((id, i) => {
            const owned = id ? byId.get(id) : undefined;
            return (
              <Pressable key={i} onPress={() => setPicking(i)} style={styles.slot}>
                {owned ? (
                  <CardPreview
                    width={140}
                    title={owned.card.title}
                    rarity={owned.card.rarity}
                    imageUrl={owned.card.image.url}
                    templateKey={owned.card.template_key}
                    templateConfig={owned.card.template_config}
                  />
                ) : (
                  <Muted>Slot {i + 1}</Muted>
                )}
              </Pressable>
            );
          })}
        </View>
        <Button title="Done" kind="secondary" onPress={() => setEditing(false)} />

        <Modal
          visible={picking !== null}
          animationType="slide"
          onRequestClose={() => setPicking(null)}
        >
          <ScrollView
            style={{ backgroundColor: colors.bg }}
            contentContainerStyle={{ padding: 16, gap: 12, paddingTop: 48 }}
          >
            <Title>{`Pick a card for slot ${(picking ?? 0) + 1}`}</Title>
            <View style={styles.row}>
              {picking !== null && slots[picking] ? (
                <Button
                  title="Clear slot"
                  kind="danger"
                  onPress={() => void persistSlots(slots.map((s, i) => (i === picking ? null : s)))}
                />
              ) : null}
              <Button title="Cancel" kind="secondary" onPress={() => setPicking(null)} />
            </View>
            <View style={styles.grid}>
              {cards
                .filter((c) => !slots.includes(c.id))
                .map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() =>
                      void persistSlots(slots.map((s, i) => (i === picking ? c.id : s)))
                    }
                  >
                    <CardPreview
                      width={140}
                      title={c.card.title}
                      rarity={c.card.rarity}
                      imageUrl={c.card.image.url}
                      templateKey={c.card.template_key}
                      templateConfig={c.card.template_config}
                    />
                  </Pressable>
                ))}
            </View>
          </ScrollView>
        </Modal>
      </ScrollView>
    );

  return (
    <ProfileView
      key={profile.display_name + profile.bio + String(profile.showcase.length)}
      profile={profile}
      headerExtra={
        <>
          <Button title="Edit profile" kind="secondary" onPress={() => setEditing(true)} />
          <Button title="Log out" kind="secondary" onPress={() => void logout()} />
        </>
      }
    />
  );
}

export default function ProfileScreen() {
  return (
    <LoginGate message="Log in to see your profile.">
      <Me />
    </LoginGate>
  );
}

const styles = StyleSheet.create({
  h2: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    width: 148,
    height: 208,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.bdr2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: 8 },
});
