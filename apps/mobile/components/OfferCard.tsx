import type { OwnedCard, TradeOffer } from '@miscellary/shared';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fonts } from '@/lib/theme';
import CardPreview from './CardPreview';
import { Button, Muted } from './ui';

function Side({
  label,
  cards,
  onInspect,
}: {
  label: string;
  cards: OwnedCard[];
  onInspect?: (owned: OwnedCard) => void;
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Muted style={styles.sideLabel}>
        {label} · {cards.length}
      </Muted>
      <ScrollView
        horizontal
        contentContainerStyle={styles.cards}
        showsHorizontalScrollIndicator={false}
      >
        {cards.length === 0 ? <Muted style={{ fontSize: 12 }}>nothing</Muted> : null}
        {cards.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`Inspect ${c.card.title}`}
            disabled={!onInspect}
            onPress={() => onInspect?.(c)}
            style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
          >
            <CardPreview
              width={104}
              title={c.card.title}
              description={c.card.description}
              mark={c.set_mark}
              rarity={c.card.rarity}
              imageUrl={c.card.image.url}
              templateKey={c.card.template_key}
              templateConfig={c.card.template_config}
              number={c.card.position + 1}
              render={c.card.render}
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

interface OfferCardProps {
  offer: TradeOffer;
  me: string;
  busy?: boolean;
  onAction: (action: 'accept' | 'reject' | 'cancel') => void;
  onInspect?: (owned: OwnedCard) => void;
}

export default function OfferCard({ offer, me, busy, onAction, onInspect }: OfferCardProps) {
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
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 16, flexShrink: 1 }}>
          {incoming ? 'From' : 'To'}{' '}
          <Text style={{ color: colors.text, fontWeight: '700' }}>@{other.username}</Text>
          {offer.counter_of ? <Text style={{ color: colors.gold }}> · counter</Text> : null}
        </Text>
        <Text
          style={{
            color: statusColor,
            fontSize: 11,
            fontFamily: fonts.medium,
            backgroundColor: colors.sur2,
            paddingHorizontal: 8,
            paddingVertical: 5,
            borderRadius: 4,
            textTransform: 'uppercase',
          }}
        >
          {offer.status}
        </Text>
      </View>
      {offer.message ? (
        <Muted
          style={{
            fontSize: 15,
            padding: 12,
            backgroundColor: colors.bg,
            borderLeftWidth: 2,
            borderLeftColor: colors.bdr2,
          }}
        >
          “{offer.message}”
        </Muted>
      ) : null}
      <View style={styles.sides}>
        <Side
          label={incoming ? 'They give' : 'You give'}
          cards={offer.give}
          onInspect={onInspect}
        />
        <Feather name="repeat" color={colors.accent} size={18} style={{ alignSelf: 'center' }} />
        <Side label={incoming ? 'They want' : 'You get'} cards={offer.want} onInspect={onInspect} />
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
    borderRadius: 6,
    borderTopWidth: 3,
    borderTopColor: colors.accent,
    padding: 16,
    gap: 16,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sideLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  sides: { flexDirection: 'row', gap: 8 },
  cards: { gap: 8, paddingBottom: 8 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
