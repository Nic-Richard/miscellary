import type { CardSetDetail } from '@miscellary/shared';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';
import Description from './Description';
import DemoBadge from './DemoBadge';

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
        <Description text={set.description} />
        <Text style={{ fontFamily: fonts.body, color: colors.muted }}>
          {set.card_count} cards · {new Set(set.cards.map((c) => c.rarity)).size} rarities
        </Text>
        <Text style={{ fontFamily: fonts.body, color: colors.muted }}>
          {set.opening_count} packs opened
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
              style={({ pressed }) => ({ paddingVertical: 8, opacity: pressed ? 0.65 : 1, gap: 4 })}
            >
              <Text style={{ fontFamily: fonts.medium, color: colors.text, fontSize: 16 }}>
                {card.title}
              </Text>
              <Text style={{ fontFamily: fonts.body, color: colors.muted }}>
                {card.like_count} {card.like_count === 1 ? 'like' : 'likes'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={panel}>
        <Text style={heading}>Collector</Text>
        {set.creator.is_demo ? <DemoBadge /> : null}
        <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 15 }}>
          {set.creator.display_name || set.creator.username} keeps this set. Open a pack to collect
          your own copies.
        </Text>
        <Link
          href={{ pathname: '/users/[username]', params: { username: set.creator.username } }}
          style={{ color: colors.accent, fontFamily: fonts.medium, paddingVertical: 12 }}
        >
          View @{set.creator.username} →
        </Link>
      </View>
    </View>
  );
}
