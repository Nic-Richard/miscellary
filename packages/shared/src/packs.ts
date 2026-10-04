import type { OwnedCard } from './api';
export const PACK_SIZE = 10;
export const EXTRA_PACK_POINT_COST = 50;
export const FREE_PACKS_PER_DAY = 1;
// Mirrored in apps/api/social/models.py.
export const SHOWCASE_SLOTS = 40;
// Mirrored in apps/api/trades/actions.py.
export const TRADE_MAX_PER_SIDE = 20;
// Mirrored in apps/api/cards/tags.py.
export const SET_TAG_MAX = 8;
export const CARD_TAG_MAX = 5;
export const TAG_LABEL_MAX = 30;

/** Copies that can be recycled: every copy of a card beyond the first, leaving out any held in a trade. */
export function spareCount(owned: Pick<OwnedCard, 'held' | 'card'>[]): number {
  const free = new Map<string, number>();
  for (const copy of owned)
    if (!copy.held) free.set(copy.card.id, (free.get(copy.card.id) ?? 0) + 1);
  return [...free.values()].reduce((total, n) => total + Math.max(0, n - 1), 0);
}
