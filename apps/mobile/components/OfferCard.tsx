import type { OwnedCard, TradeOffer } from '@miscellary/shared';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';
import CardPreview from './CardPreview';
import { Button, Muted } from './ui';

function Side({ label, cards }: { label: string; cards: OwnedCard[] }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Muted style={styles.sideLabel}>{label}</Muted>
      <View style={styles.cards}>
        {cards.length === 0 ? <Muted style={{ fontSize: 12 }}>nothing</Muted> : null}
        {cards.map((c) => (
          <CardPreview
            key={c.id}
            width={90}
            title={c.card.title}
            rarity={c.card.rarity}
            imageUrl={c.card.image.url}
            templateKey={c.card.template_key}
            templateConfig={c.card.template_config}
          />
        ))}
      </View>
    </View>
  );
}

interface OfferCardProps {
  offer: TradeOffer;
  me: string;
  busy?: boolean;
  onAction: (action: 'accept' | 'reject' | 'cancel') => void;
}

export default function OfferCard({ offer, me, busy, onAction }: OfferCardProps) {
  const incoming = offer.recipient.username === me;
  const other = incoming ? offer.sender : offer.recipient;
  const statusColor =
    offer.status === 'accepted'
      ? colors.green
      : offer.status === 'pending'
        ? colors.muted
        : offer.status === 'countered'
          ? colors.gold
          : colors.danger;
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={{ color: colors.muted }}>
          {incoming ? 'From' : 'To'}{' '}
          <Text style={{ color: colors.text, fontWeight: '700' }}>@{other.username}</Text>
          {offer.counter_of ? <Text style={{ color: colors.gold }}> · counter</Text> : null}
        </Text>
        <Text
          style={{
            color: statusColor,
            fontSize: 10,
            fontWeight: '700',
            textTransform: 'uppercase',
          }}
        >
          {offer.status}
        </Text>
      </View>
      {offer.message ? (
        <Muted style={{ fontStyle: 'italic', fontSize: 13 }}>“{offer.message}”</Muted>
      ) : null}
      <View style={styles.sides}>
        <Side label={incoming ? 'They give' : 'You give'} cards={offer.give} />
        <Text style={{ color: colors.faint, fontSize: 18, alignSelf: 'center' }}>⇄</Text>
        <Side label={incoming ? 'They want' : 'You get'} cards={offer.want} />
      </View>
      {offer.status === 'pending' ? (
        <View style={styles.actions}>
          {incoming ? (
            <>
              <Button title="Accept" disabled={busy} onPress={() => onAction('accept')} />
              <Button
                title="Counter"
                kind="secondary"
                disabled={busy}
                onPress={() =>
                  router.push({ pathname: '/trades/new', params: { counter: offer.id } })
                }
              />
              <Button
                title="Reject"
                kind="danger"
                disabled={busy}
                onPress={() => onAction('reject')}
              />
            </>
          ) : (
            <Button
              title="Cancel offer"
              kind="danger"
              disabled={busy}
              onPress={() => onAction('cancel')}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.sur,
    borderColor: colors.bdr2,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sideLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sides: { flexDirection: 'row', gap: 8 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
