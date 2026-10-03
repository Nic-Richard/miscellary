import type { OwnedCard, TradeOffer } from './api';

// Wording shared by the website and the app, so the two say the same thing.

/** "1 card", "3 cards"; irregular plurals pass their own. */
export function countOf(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export const COMMENT_COPY = {
  placeholder: 'Say something about this set…',
  empty: 'Nothing here yet. Ask the collector about a card, or say which one you pulled.',
  removed: 'Comment removed',
  removePrompt: 'Remove this comment?',
  logInToComment: 'Log in to comment',
  replyTo: (name: string) => `Reply to ${name}…`,
};

/** An offer from the viewer's side: what they would get and what they would give. */
export function offerSides(
  offer: Pick<TradeOffer, 'give' | 'want'>,
  incoming: boolean,
): { youGet: OwnedCard[]; youGive: OwnedCard[] } {
  return incoming
    ? { youGet: offer.give, youGive: offer.want }
    : { youGet: offer.want, youGive: offer.give };
}
