import type { OwnedCard, TradeOffer } from '@miscellary/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import InspectorModal from '@/components/InspectorModal';
import CardInspector from '@/components/CardInspector';
import LoginGate from '@/components/LoginGate';
import OfferCard from '@/components/OfferCard';
import { useAuth } from '@/lib/auth';
import { actOnOffer, listOffers } from '@/lib/endpoints';
import { colors, fonts } from '@/lib/theme';
import { Button, Chip, ErrorText, Input, Muted } from '@/components/ui';
import VerifyEmailNotice from '@/components/VerifyEmailNotice';

type Box = 'inbox' | 'outbox' | 'history';

const BOX_LABELS: Record<Box, string> = {
  inbox: 'Received',
  outbox: 'Sent',
  history: 'History',
};

const NOTHING: Record<Box, string> = {
  inbox: 'Nothing on the table. When another collector offers you a trade, it lands here.',
  outbox: 'You have not put anything on the table yet. Find a collector and pick from their cards.',
  history: 'Nothing settled yet. Accepted, rejected and cancelled offers are kept here.',
};

function DealMat({ box }: { box: Box }) {
  return (
    <View style={styles.mat}>
      <View style={styles.matSides}>
        <View style={styles.matSide}>
          <Text style={styles.matLabel}>You give</Text>
          <View style={styles.matSlots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.matSlot} />
            ))}
          </View>
        </View>
        <View style={styles.matSide}>
          <Text style={styles.matLabel}>They give</Text>
          <View style={styles.matSlots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.matSlot} />
            ))}
          </View>
        </View>
      </View>
      <Muted style={styles.matNote}>{NOTHING[box]}</Muted>
    </View>
  );
}

function Trades() {
  const { user } = useAuth();
  const [box, setBox] = useState<Box>('inbox');
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [partner, setPartner] = useState('');
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
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
    >
      <View style={styles.row}>
        <Input
          placeholder="Start a trade with @username"
          autoCapitalize="none"
          value={partner}
          onChangeText={setPartner}
          style={{ flex: 1 }}
        />
        <Button
          title="Go"
          disabled={!partner.trim()}
          onPress={() =>
            router.push({
              pathname: '/trades/new',
              params: { with: partner.trim().replace(/^@/, '') },
            })
          }
        />
      </View>
      <View style={styles.row}>
        {(['inbox', 'outbox', 'history'] as Box[]).map((b) => (
          <Chip key={b} label={BOX_LABELS[b]} active={b === box} onPress={() => setBox(b)} />
        ))}
      </View>
      <ErrorText>{error}</ErrorText>
      <VerifyEmailNotice>Verify your email address to send or accept offers.</VerifyEmailNotice>
      {offers.length === 0 ? <DealMat box={box} /> : null}
      {offers.map((o) => (
        <OfferCard
          key={o.id}
          offer={o}
          me={user?.profile.username ?? ''}
          busy={busy}
          onInspect={setSelected}
          onAction={(a) => void act(o.id, a)}
        />
      ))}
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
    <LoginGate>
      <Trades />
    </LoginGate>
  );
}

const styles = StyleSheet.create({
  mat: {
    gap: 16,
    paddingVertical: 26,
    paddingHorizontal: 14,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderRadius: 10,
  },
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
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
