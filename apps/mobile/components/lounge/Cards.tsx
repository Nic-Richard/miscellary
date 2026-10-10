import { Pressable, View } from 'react-native';
import type { LoungeCard } from '@miscellary/shared';
import { cardCode } from '@miscellary/shared';
import CardPreview from '@/components/CardPreview';
import { Muted } from '@/components/ui';
import { createThemedStyles } from '@/lib/theme';

export default function Cards({
  cards,
  width,
  onInspect,
}: {
  cards: (LoungeCard | null)[];
  width: number;
  onInspect: (card: LoungeCard) => void;
}) {
  const styles = useStyles();
  if (!cards.length) return null;
  return (
    <View style={styles.cards}>
      {cards.map((card, index) =>
        card ? (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={`Inspect ${card.title}`}
            onPress={() => onInspect(card)}
          >
            <CardPreview
              width={width}
              title={card.title}
              rarity={card.rarity}
              imageUrl={card.image?.url ?? null}
              templateKey={card.template_key}
              templateConfig={card.template_config}
              code={cardCode(card.printed_set_code, card.position, card.set_total)}
              printedText={card.printed_text}
              render={card.render}
            />
          </Pressable>
        ) : (
          <View key={index} style={[styles.missing, { width, height: width * 1.4 }]}>
            <Muted style={styles.missingText}>No longer in this collection</Muted>
          </View>
        ),
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  missing: {
    padding: 8,
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.bdr2,
    backgroundColor: colors.sur2,
  },
  missingText: { fontSize: 13, lineHeight: 17, textAlign: 'center' },
}));
