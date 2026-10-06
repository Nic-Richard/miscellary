import type { OwnedCard, Paginated } from './api';

export async function listOwnedCardPages(
  readPage: (setSlug?: string, page?: number) => Promise<Paginated<OwnedCard>>,
  setSlug?: string,
): Promise<OwnedCard[]> {
  const first = await readPage(setSlug);
  if (!first.next) return first.results;
  // A full first page gives the page size, so the rest can be asked for at once.
  const pages = Math.ceil(first.count / first.results.length);
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) => readPage(setSlug, index + 2)),
  );
  return [first.results, ...rest.map((page) => page.results)].flat();
}

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
