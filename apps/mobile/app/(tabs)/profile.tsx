import { cardCode, SHOWCASE_SLOTS } from '@miscellary/shared';
import type { OwnedCard, ProfilePage } from '@miscellary/shared';
import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CardPreview from '@/components/CardPreview';
import FeaturedCardPicker from '@/components/FeaturedCardPicker';
import FilterField from '@/components/FilterField';
import LoginGate from '@/components/LoginGate';
import ProfileView from '@/components/ProfileView';
import { useAuth } from '@/lib/auth';
import { getProfile, getShowcase, listMyCards, saveShowcase, updateProfile } from '@/lib/endpoints';
import { fonts, useColors, createThemedStyles } from '@/lib/theme';
import { Button, ErrorText, Input, Loading, Muted } from '@/components/ui';

function Me() {
  const colors = useColors();
  const styles = useStyles();
  const { user, logout, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfilePage | null>(null);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [slots, setSlots] = useState<(string | null)[]>(Array(SHOWCASE_SLOTS).fill(null));
  const [picking, setPicking] = useState<number | null>(null);
  const [pickFilter, setPickFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pickerScrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const pickColumns = screenWidth >= 700 ? 5 : 3;
  const pickWidth = Math.floor((screenWidth - 32 - 10 * (pickColumns - 1)) / pickColumns);

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
      const next: (string | null)[] = Array(p.showcase_slots ?? SHOWCASE_SLOTS).fill(null);
      for (const s of showcase) next[s.position - 1] = s.owned_card.id;
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
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      return false;
    }
  }

  // The binder changes at once and saves in the background, putting things back if the save fails.
  async function persistSlots(next: (string | null)[]) {
    if (!profile) return;
    const before = { slots, showcase: profile.showcase };
    const known = new Map(
      [...cards, ...profile.showcase.map((slot) => slot.owned_card)].map((c) => [c.id, c]),
    );
    const showcase = next.flatMap((id, index) => {
      const owned = id ? known.get(id) : undefined;
      return owned ? [{ position: index + 1, owned_card: owned }] : [];
    });
    setSlots(next);
    setPicking(null);
    setProfile({ ...profile, showcase });
    try {
      const saved = await saveShowcase(
        next.flatMap((id, position) => (id ? [{ position, owned_card_id: id }] : [])),
      );
      setProfile((current) => (current ? { ...current, showcase: saved } : current));
    } catch (e) {
      setSlots(before.slots);
      setProfile((current) => (current ? { ...current, showcase: before.showcase } : current));
      Alert.alert(e instanceof Error ? e.message : 'Could not save the binder.');
    }
  }

  const dirty = !!profile && (displayName !== profile.display_name || bio !== profile.bio);
  const leaveEditing = useCallback(() => {
    if (!dirty) {
      setEditing(false);
      return;
    }
    Alert.alert('Save your changes?', undefined, [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setDisplayName(profile?.display_name ?? '');
          setBio(profile?.bio ?? '');
          setEditing(false);
        },
      },
      {
        text: 'Save',
        onPress: () =>
          void saveProfile().then((saved) => {
            if (saved) setEditing(false);
          }),
      },
    ]);
  }, [dirty, profile]);

  useEffect(() => {
    navigation.setOptions(
      editing
        ? {
            title: 'Edit profile',
            headerLeft: () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={10}
                onPress={leaveEditing}
                style={{ marginLeft: 16, marginRight: 8 }}
              >
                <Feather name="arrow-left" size={24} color={colors.text} />
              </Pressable>
            ),
          }
        : { title: 'Profile', headerLeft: undefined },
    );
    if (!editing) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leaveEditing();
      return true;
    });
    return () => sub.remove();
  }, [editing, leaveEditing, navigation]);

  if (!profile) return error ? <ErrorText>{error}</ErrorText> : <Loading />;

  const pickNeedle = pickFilter.trim().toLowerCase();
  const choosable = cards
    .filter((c) => !slots.includes(c.id))
    .filter(
      (c) =>
        !pickNeedle ||
        c.card.title.toLowerCase().includes(pickNeedle) ||
        c.set_title.toLowerCase().includes(pickNeedle),
    );

  if (editing)
    return (
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      >
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
            if (await saveProfile()) setEditing(false);
          }}
        />
        <FeaturedCardPicker
          card={profile.featured_card ?? null}
          onChange={(featured_card) => setProfile({ ...profile, featured_card })}
        />
      </ScrollView>
    );

  return (
    <>
      <ProfileView
        key={profile.display_name + profile.bio}
        profile={profile}
        editBinder={{
          pick: setPicking,
          remove: (position) =>
            void persistSlots(slots.map((slot, index) => (index === position ? null : slot))),
        }}
        headerExtra={
          <Button title="Edit profile" kind="secondary" onPress={() => setEditing(true)} />
        }
        ownItems={[
          { label: 'Account settings', icon: 'settings', onSelect: () => router.push('/settings') },
          { label: 'Log out', icon: 'log-out', onSelect: () => void logout() },
        ]}
      />
      <Modal
        visible={picking !== null}
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onShow={() => pickerScrollRef.current?.scrollTo({ y: 0, animated: false })}
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={() => setPicking(null)}
      >
        <ScrollView
          ref={pickerScrollRef}
          style={{ backgroundColor: colors.bg }}
          contentContainerStyle={{
            padding: 16,
            gap: 12,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <View style={styles.pickerHead}>
            <Text style={styles.pickerTitle}>{`Pick a card for sleeve ${(picking ?? 0) + 1}`}</Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setPicking(null)}
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Text style={styles.pickerCancel}>Cancel</Text>
            </Pressable>
          </View>
          {picking !== null && slots[picking] ? (
            <Button
              title="Empty this sleeve"
              kind="danger"
              onPress={() => void persistSlots(slots.map((s, i) => (i === picking ? null : s)))}
            />
          ) : null}
          <FilterField
            value={pickFilter}
            onChange={setPickFilter}
            placeholder="Filter by card or set"
            label="Filter your cards by card or set"
          />
          {choosable.length === 0 ? (
            <Muted>
              {pickFilter.trim()
                ? `None of your cards match “${pickFilter}”.`
                : 'Every card you hold is already pinned.'}
            </Muted>
          ) : null}
          <View style={styles.grid}>
            {choosable.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => void persistSlots(slots.map((s, i) => (i === picking ? c.id : s)))}
              >
                <CardPreview
                  width={pickWidth}
                  title={c.card.title}
                  printedText={c.card.printed_text}
                  code={cardCode(c.card.printed_set_code, c.card.position, c.card.set_total)}
                  rarity={c.card.rarity}
                  imageUrl={c.card.image.url}
                  templateKey={c.card.template_key}
                  templateConfig={c.card.template_config}
                  render={c.card.render}
                />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Modal>
    </>
  );
}

export default function ProfileScreen() {
  return (
    <LoginGate note="Your binder, your sets and the collectors you follow live here.">
      <Me />
    </LoginGate>
  );
}

const useStyles = createThemedStyles((colors) => ({
  h2: { color: colors.pageText, fontSize: 16, fontWeight: '700', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pickerHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickerTitle: { flex: 1, color: colors.text, fontFamily: fonts.display, fontSize: 28 },
  pickerCancel: { color: colors.accent, fontFamily: fonts.medium, fontSize: 16 },
  row: { flexDirection: 'row', gap: 8 },
}));
