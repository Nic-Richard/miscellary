import { cache } from 'react';
import { personName } from '@miscellary/shared';
import type { Card, CardSetDetail } from '@miscellary/shared';
import { ApiRequestError } from './api';
import { snippet } from './seo';
import { getPublicSet } from './sets';

export const loadSet = cache(async (slug: string): Promise<CardSetDetail | null> => {
  try {
    return await getPublicSet(slug);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
});

export function setDescription(set: CardSetDetail): string {
  if (set.description) return snippet(set.description);
  return `${set.card_count} cards by ${personName(set.creator)}. Open a free pack every day and collect the set.`;
}

export function findCard(set: CardSetDetail | null, number: string): Card | null {
  if (!set || set.status !== 'published') return null;
  return set.cards.find((card) => String(card.position + 1) === number) ?? null;
}
