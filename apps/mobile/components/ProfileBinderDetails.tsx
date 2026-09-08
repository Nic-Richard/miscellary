import { SHOWCASE_SLOTS } from '@miscellary/shared';
import type { OwnedCard } from '@miscellary/shared';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

export default function ProfileBinderDetails({
  cards,
}: {
  cards: Array<OwnedCard | null | undefined>;
}) {
  const filled = cards.filter(Boolean).length;
  const represented = new Map<string, { slug: string; title: string; count: number }>();
  for (const owned of cards) {
    if (!owned) continue;
    const current = represented.get(owned.set_slug);
    represented.set(owned.set_slug, {
      slug: owned.set_slug,
      title: owned.set_title,
      count: (current?.count ?? 0) + 1,
    });
  }
  const sets = [...represented.values()];
  const panel = {
    backgroundColor: colors.sur,
    borderColor: colors.bdr,
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    gap: 10,
  };
  const heading = { fontFamily: fonts.display, fontSize: 23, color: colors.text };
  const detail = { fontFamily: fonts.body, color: colors.muted, fontSize: 15 };

  return (
    <View style={{ gap: 12 }}>
      <View style={panel}>
        <Text style={heading}>About this binder</Text>
        <Text style={detail}>{filled} cards shown</Text>
        <Text style={detail}>{SHOWCASE_SLOTS - filled} open sleeves</Text>
        <Text style={detail}>10 pages</Text>
        <Text style={detail}>{sets.length} sets represented</Text>
      </View>
      <View style={panel}>
        <Text style={heading}>Set index</Text>
        {sets.length ? (
          sets.slice(0, 6).map((set) => (
            <Link
              key={set.slug}
              href={{ pathname: '/sets/[slug]', params: { slug: set.slug } }}
              style={{ color: colors.accent, fontFamily: fonts.medium, paddingVertical: 6 }}
            >
              {set.title} · {set.count}
            </Link>
          ))
        ) : (
          <Text style={detail}>Pinned cards will be indexed here.</Text>
        )}
        {sets.length > 6 ? (
          <Text style={{ fontFamily: fonts.body, color: colors.faint }}>
            +{sets.length - 6} more sets
          </Text>
        ) : null}
      </View>
    </View>
  );
}
