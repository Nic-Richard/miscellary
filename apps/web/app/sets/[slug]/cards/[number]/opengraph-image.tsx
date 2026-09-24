import { cardCode, RARITY_LABELS } from '@miscellary/shared';
import { OG_SIZE, pngFrom, shareImage } from '@/lib/og';
import { findCard, loadSet } from '@/lib/publicPages';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'A Miscellary trading card';

const CARD_WIDTH = 360;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; number: string }>;
}) {
  const { slug, number } = await params;
  const set = await loadSet(slug);
  const card = findCard(set, number);
  const face = await pngFrom(card?.render?.front?.url ?? card?.render?.thumbnail?.url, 720);
  return shareImage({
    object: face ? (
      <img
        src={face}
        width={CARD_WIDTH}
        height={(CARD_WIDTH * 7) / 5}
        style={{
          borderRadius: 14,
          transform: 'rotate(-4deg)',
          boxShadow: '0 22px 44px rgba(40, 28, 12, 0.32)',
        }}
      />
    ) : null,
    title: card?.title ?? set?.title ?? 'Miscellary',
    lines:
      set && card
        ? [
            `${RARITY_LABELS[card.rarity]} card ${cardCode(card.printed_set_code, card.position, card.set_total)}`,
            `From ${set.title}`,
          ]
        : [],
  });
}
