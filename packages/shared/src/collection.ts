import type { OwnedCard } from './api';

export function stackOwnedCards(owned: readonly OwnedCard[]): OwnedCard[] {
  const seen = new Map<string, OwnedCard>();
  for (const copy of owned) {
    const current = seen.get(copy.card.id);
    // Prefer a free copy so recycling does not target one held in a trade.
    if (!current || (current.held && !copy.held)) seen.set(copy.card.id, copy);
  }
  return [...seen.values()];
}

export function groupOwnedCards(owned: readonly OwnedCard[]): Map<string, OwnedCard[]> {
  const grouped = new Map<string, OwnedCard[]>();
  for (const copy of owned) {
    const group = grouped.get(copy.set_slug) ?? [];
    group.push(copy);
    grouped.set(copy.set_slug, group);
  }
  return grouped;
}
