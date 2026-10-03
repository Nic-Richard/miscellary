import { cardCode, personName, countOf } from '@miscellary/shared';
import type { CardSetDetail } from '@miscellary/shared';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';
import CardPreview from './CardPreview';

export default function BinderDetails({
  set,
  inspect,
}: {
  set: CardSetDetail;
  inspect: (id: string) => void;
}) {
  const popular = [...set.cards]
    .filter((card) => card.like_count > 0)
    .sort((a, b) => b.like_count - a.like_count)
    .slice(0, 3);
  const panel = {
    backgroundColor: colors.sur,
    borderColor: colors.bdr,
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    gap: 10,
  };
  const heading = { fontFamily: fonts.display, fontSize: 23, color: colors.text };
  return (
    <View style={{ gap: 12 }}>
      <View style={panel}>
        <Text style={heading}>About this set</Text>
        <Text style={{ fontFamily: fonts.body, color: colors.muted }}>
          {countOf(set.card_count, 'card')} ·{' '}
          {countOf(new Set(set.cards.map((c) => c.rarity)).size, 'rarity', 'rarities')}
        </Text>
        <Text style={{ fontFamily: fonts.body, color: colors.muted }}>
          {countOf(set.opening_count, 'pack')} opened
        </Text>
      </View>
      {popular.length ? (
        <View style={panel}>
          <Text style={heading}>Popular pulls</Text>
          {popular.map((card) => (
            <Pressable
              key={card.id}
              accessibilityRole="button"
              accessibilityLabel={`Inspect ${card.title}`}
              onPress={() => inspect(card.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 6,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <CardPreview
                width={56}
                title={card.title}
                description={card.description}
                printedText={card.printed_text}
                mark={set.mark}
                rarity={card.rarity}
                imageUrl={card.image.url}
                templateKey={card.template_key}
                templateConfig={card.template_config}
                code={cardCode(card.printed_set_code, card.position, card.set_total)}
                render={card.render}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.medium, color: colors.text, fontSize: 16 }}>
                  {card.title}
                </Text>
                <Text style={{ fontFamily: fonts.body, color: colors.muted }}>
                  {card.like_count} {card.like_count === 1 ? 'like' : 'likes'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={panel}>
        <Text style={heading}>Made by</Text>
        <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 15 }}>
          {set.creator.deleted
            ? 'The account that made this set has been closed. The set stays so its collectors keep their cards.'
            : `${personName(set.creator)} keeps this set.`}{' '}
          Open a pack to collect your own copies.
        </Text>
        {set.creator.deleted ? null : (
          <Link
            href={{ pathname: '/users/[username]', params: { username: set.creator.username } }}
            style={{ color: colors.accent, fontFamily: fonts.medium, paddingVertical: 12 }}
          >
            View @{set.creator.username} →
          </Link>
        )}
      </View>
    </View>
  );
}
