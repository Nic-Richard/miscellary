import type { Creator, OwnedCard, TradeOffer } from '@miscellary/shared';
import { countOf, personName } from '@miscellary/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Avatar from '@/components/Avatar';
import InspectorModal from '@/components/InspectorModal';
import CardInspector from '@/components/CardInspector';
import FilterField from '@/components/FilterField';
import LoginGate from '@/components/LoginGate';
import OfferCard from '@/components/OfferCard';
import SupporterEmblem from '@/components/SupporterEmblem';
import { useAuth } from '@/lib/auth';
import { actOnOffer, listOffers, search } from '@/lib/endpoints';
import { fonts, useColors, createThemedStyles } from '@/lib/theme';
import { Button, ErrorText, Muted, Panel, PanelTitle, Segmented } from '@/components/ui';
import VerifyEmailNotice from '@/components/VerifyEmailNotice';

type Box = 'inbox' | 'outbox' | 'history';

const BOXES: { value: Box; label: string }[] = [
  { value: 'inbox', label: 'Received' },
  { value: 'outbox', label: 'Sent' },
  { value: 'history', label: 'History' },
];

const NOTHING: Record<Box, string> = {
  inbox: 'Nothing on the table. When another collector offers you a trade, it lands here.',
  outbox: 'You have not put anything on the table yet. Find a collector and pick from their cards.',
  history: 'Nothing settled yet. Accepted, rejected and cancelled offers are kept here.',
};

function DealMat({ box }: { box: Box }) {
  const styles = useStyles();
  return (
    <View style={styles.mat}>
      <View style={styles.matSides}>
        {['You give', 'They give'].map((label) => (
          <View key={label} style={styles.matSide}>
            <Text style={styles.matLabel}>{label}</Text>
            <View style={styles.matSlots}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.matSlot} />
              ))}
            </View>
          </View>
        ))}
      </View>
      <Muted style={styles.matNote}>{NOTHING[box]}</Muted>
    </View>
  );
}

/** Any collector by name, people you follow first, each one a tap from a new offer. */
function FindCollector({ me }: { me: string }) {
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Creator[] | null>(null);

  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    setFound(null);
    if (q.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      search(q)
        .then((results) => {
          if (active) setFound(results.users.filter((u) => u.username !== me));
        })
        .catch(() => active && setFound([]));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, me]);

  return (
    <Panel>
      <PanelTitle>Start a trade</PanelTitle>
      <FilterField
        value={query}
        onChange={setQuery}
        placeholder="Find a collector"
        label="Find a collector to trade with"
      />
      {found?.length === 0 ? <Muted style={styles.small}>No collectors match that.</Muted> : null}
      {found?.map((person) => (
        <View key={person.username} style={styles.result}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${personName(person)}'s profile`}
            onPress={() =>
              router.push({ pathname: '/users/[username]', params: { username: person.username } })
            }
            style={styles.who}
          >
            <Avatar person={person} size={34} />
            <View style={styles.whoText}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.name}>
                  {personName(person)}
                </Text>
                <SupporterEmblem tier={person.supporter_tier} size={14} />
              </View>
              <Text numberOfLines={1} style={styles.handle}>
                @{person.username}
              </Text>
            </View>
          </Pressable>
          <Button
            title="Trade"
            kind="secondary"
            small
            onPress={() =>
              router.push({ pathname: '/trades/new', params: { with: person.username } })
            }
          />
        </View>
      ))}
    </Panel>
  );
}

function Trades() {
  const colors = useColors();
  const styles = useStyles();
  const { user } = useAuth();
  const me = user?.profile.username ?? '';
  const [box, setBox] = useState<Box>('inbox');
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<OwnedCard | null>(null);

  const load = useCallback(
    () =>
      listOffers(box)
        .then(setOffers)
        .catch((e: Error) => setError(e.message)),
    [box],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function act(id: string, action: 'accept' | 'reject' | 'cancel') {
    setBusy(true);
    setError(null);
    try {
      await actOnOffer(id, action);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <VerifyEmailNotice>Verify your email address to send or accept offers.</VerifyEmailNotice>
      <FindCollector me={me} />
      <Panel>
        <View style={styles.boxRow}>
          <Segmented options={BOXES} value={box} onChange={setBox} label="Offers" />
          {offers.length > 0 ? (
            <Muted style={styles.small}>{countOf(offers.length, 'offer')}</Muted>
          ) : null}
        </View>
        <ErrorText>{error}</ErrorText>
        {offers.length === 0 ? <DealMat box={box} /> : null}
        {offers.map((o) => (
          <OfferCard
            key={o.id}
            offer={o}
            me={me}
            busy={busy}
            onInspect={setSelected}
            onAction={(a) => void act(o.id, a)}
          />
        ))}
      </Panel>
      {selected ? (
        <InspectorModal open onClose={() => setSelected(null)}>
          <CardInspector
            card={selected.card}
            setTitle={selected.set_title}
            setSlug={selected.set_slug}
            mark={selected.set_mark}
            packColour={selected.set_pack_colour}
            copies={selected.copies}
            onClose={() => setSelected(null)}
          />
        </InspectorModal>
      ) : null}
    </ScrollView>
  );
}

export default function TradesScreen() {
  return (
    <LoginGate note="Swap your spare cards with other collectors for the ones you are missing.">
      <Trades />
    </LoginGate>
  );
}

const useStyles = createThemedStyles((colors) => ({
  content: { padding: 14, gap: 14, paddingBottom: 40 },
  small: { fontSize: 14 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  whoText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { flexShrink: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  handle: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mat: { gap: 16, paddingVertical: 14 },
  matSides: { flexDirection: 'row', justifyContent: 'space-around', gap: 14 },
  matSide: { alignItems: 'center', gap: 8 },
  matLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 15 },
  matSlots: { flexDirection: 'row', gap: 6 },
  matSlot: {
    width: 40,
    aspectRatio: 5 / 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderStyle: 'dashed',
  },
  matNote: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
}));
