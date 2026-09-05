import type { TradeOffer } from '@miscellary/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import LoginGate from '@/components/LoginGate';
import OfferCard from '@/components/OfferCard';
import { useAuth } from '@/lib/auth';
import { actOnOffer, listOffers } from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import { Button, Chip, ErrorText, Input, Muted, Tag, Title } from '@/components/ui';

type Box = 'inbox' | 'outbox' | 'history';

function Trades() {
  const { user } = useAuth();
  const [box, setBox] = useState<Box>('inbox');
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [partner, setPartner] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      <Tag>Trading</Tag>
      <Title>Trade offers</Title>
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
          <Chip
            key={b}
            label={b[0]!.toUpperCase() + b.slice(1)}
            active={b === box}
            onPress={() => setBox(b)}
          />
        ))}
      </View>
      <ErrorText>{error}</ErrorText>
      {offers.length === 0 ? <Muted>Nothing here.</Muted> : null}
      {offers.map((o) => (
        <OfferCard
          key={o.id}
          offer={o}
          me={user?.profile.username ?? ''}
          busy={busy}
          onAction={(a) => void act(o.id, a)}
        />
      ))}
    </ScrollView>
  );
}

export default function TradesScreen() {
  return (
    <LoginGate message="Log in to trade.">
      <Trades />
    </LoginGate>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 8, alignItems: 'center' } });
