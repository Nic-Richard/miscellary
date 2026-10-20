import {
  cardCode,
  personName,
  RARITY_LABELS,
  SITE_URL as PRODUCTION_SITE_URL,
} from '@miscellary/shared';
import type { Card, CardSetDetail } from '@miscellary/shared';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? PRODUCTION_SITE_URL;

/** Plain text short enough for a search snippet or a link preview. */
export function snippet(text: string, max = 160): string {
  const plain = text
    .replace(/[*_`#>[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

export function setDescription(set: CardSetDetail): string {
  if (set.description) return snippet(set.description);
  return `${set.card_count} cards by ${personName(set.creator)}. Open a free pack every day and collect the set.`;
}

export function cardDescription(card: Card, setTitle: string): string {
  if (card.description) return snippet(card.description);
  const code = cardCode(card.printed_set_code, card.position, card.set_total);
  return `${RARITY_LABELS[card.rarity]} card ${code} from ${setTitle}.`;
}
