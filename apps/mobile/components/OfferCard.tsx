import { cardCode, offerSides, personName, timeAgo } from '@miscellary/shared';
import type { OwnedCard, TradeOffer } from '@miscellary/shared';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts, useColors, createThemedStyles } from '@/lib/theme';
import Avatar from './Avatar';
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
  const styles = useStyles();
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
        {cards.length === 0 ? <Muted style={{ fontSize: 14 }}>nothing</Muted> : null}
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
              printedText={c.card.printed_text}
              mark={c.set_mark}
              rarity={c.card.rarity}
              imageUrl={c.card.image.url}
              templateKey={c.card.template_key}
              templateConfig={c.card.template_config}
              code={cardCode(c.card.printed_set_code, c.card.position, c.card.set_total)}
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

const STATUS_WORD: Record<string, string> = {
  pending: 'Waiting',
  accepted: 'Accepted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  countered: 'Countered',
};

export default function OfferCard({ offer, me, busy, onAction, onInspect }: OfferCardProps) {
  const colors = useColors();
  const styles = useStyles();
  const incoming = offer.recipient.username === me;
  const sides = offerSides(offer, incoming);
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
        <Avatar person={other} size={34} />
        <View style={styles.who}>
          <Text numberOfLines={1} style={styles.name}>
            {personName(other)}
          </Text>
          <Text style={styles.when}>
            {incoming ? 'Offered you' : 'You offered'} · {timeAgo(offer.created_at)}
            {offer.counter_of ? <Text style={{ color: colors.gold }}> · counter</Text> : null}
          </Text>
        </View>
        <Text style={[styles.status, { color: statusColor }]}>
          {STATUS_WORD[offer.status] ?? offer.status}
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
        <Side label="You give" cards={sides.youGive} onInspect={onInspect} />
        <Feather name="repeat" color={colors.accent} size={18} style={{ alignSelf: 'center' }} />
        <Side label="They give" cards={sides.youGet} onInspect={onInspect} />
      </View>
      {offer.status === 'pending' ? (
        <View style={styles.actions}>
          {incoming ? (
            <>
              <Button
                title="Accept"
                small
                style={styles.action}
                disabled={busy}
                onPress={() => onAction('accept')}
              />
              <Button
                title="Counter"
                kind="secondary"
                small
                style={styles.action}
                disabled={busy}
                onPress={() =>
                  router.push({ pathname: '/trades/new', params: { counter: offer.id } })
                }
              />
              <Button
                title="Decline"
                kind="quiet"
                small
                style={styles.action}
                disabled={busy}
                onPress={() => onAction('reject')}
              />
            </>
          ) : (
            <Button
              title="Cancel offer"
              kind="danger"
              small
              style={styles.action}
              disabled={busy}
              onPress={() => onAction('cancel')}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  root: {
    backgroundColor: colors.sur2,
    borderColor: colors.bdr,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  who: { flex: 1 },
  name: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  when: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  status: { fontFamily: fonts.medium, fontSize: 13 },
  sideLabel: {
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  sides: { flexDirection: 'row', gap: 8 },
  cards: { gap: 8, paddingBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
}));
