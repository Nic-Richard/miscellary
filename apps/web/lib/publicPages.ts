import { cache } from 'react';
import type { Card, CardSetDetail } from '@miscellary/shared';
import { ApiRequestError } from './api';
import { getPublicSet } from './sets';

export { setDescription } from './seo';

export const loadSet = cache(async (slug: string): Promise<CardSetDetail | null> => {
  try {
    return await getPublicSet(slug);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
});

export function findCard(set: CardSetDetail | null, number: string): Card | null {
  if (!set || set.status !== 'published') return null;
  return set.cards.find((card) => String(card.position + 1) === number) ?? null;
}
