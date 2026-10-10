import { useState } from 'react';
import { Text, View } from 'react-native';
import type { LoungeCard, ProfilePage } from '@miscellary/shared';
import { cardCode } from '@miscellary/shared';
import CardPreview from '@/components/CardPreview';
import Sheet from '@/components/Sheet';
import SupporterPrompt from '@/components/SupporterPrompt';
import CardPicker from '@/components/lounge/CardPicker';
import { Button, ErrorText } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useMembership } from '@/lib/membership';
import { createThemedStyles, fonts } from '@/lib/theme';

type Featured = ProfilePage['featured_card'];

export default function FeaturedCardPicker({
  card,
  onChange,
}: {
  card: Featured;
  onChange: (card: Featured) => void;
}) {
  const styles = useStyles();
  const { enabled, supporter } = useMembership();
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) return null;

  async function save(ownedId: string | null) {
    setError(null);
    try {
      const result = await apiFetch<{ featured_card: LoungeCard | null }>(
        '/api/v1/me/featured-card/',
        { method: 'PUT', body: { owned_card_id: ownedId } },
      );
      onChange(result.featured_card);
      setChoosing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your featured card.');
    }
  }

  return (
    <View style={styles.featured}>
      <Text style={styles.label}>Featured card</Text>
      {!supporter ? (
        <SupporterPrompt>
          Supporters can feature a card on their profile and in their Lounge preview.
        </SupporterPrompt>
      ) : (
        <View style={styles.current}>
          {card ? (
            <CardPreview
              width={48}
              title={card.title}
              rarity={card.rarity}
              imageUrl={card.image?.url ?? null}
              templateKey={card.template_key}
              templateConfig={card.template_config}
              code={cardCode(card.printed_set_code, card.position, card.set_total)}
              printedText={card.printed_text}
              render={card.render}
            />
          ) : (
            <View style={styles.empty} />
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title}>{card ? card.title : 'No featured card'}</Text>
            <Text style={styles.note}>
              {card ? card.set_title : 'Shown on your profile and in the Lounge.'}
            </Text>
          </View>
        </View>
      )}
      {supporter && (
        <View style={styles.buttons}>
          <Button
            kind="secondary"
            title={card ? 'Change' : 'Choose a card'}
            onPress={() => setChoosing(true)}
          />
          {card && <Button kind="secondary" title="Remove" onPress={() => void save(null)} />}
        </View>
      )}
      <ErrorText>{error}</ErrorText>
      <Sheet visible={choosing} title="Featured card" onClose={() => setChoosing(false)}>
        <CardPicker
          max={1}
          selected={[]}
          onChange={(cards) => {
            if (cards[0]) void save(cards[0].id);
          }}
        />
      </Sheet>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  featured: {
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  label: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  current: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: {
    width: 48,
    height: 67,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.bdr2,
  },
  title: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  note: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
