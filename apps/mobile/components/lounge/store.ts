import type { LoungePost } from '@miscellary/shared';

type LoungeEvent =
  | { type: 'patch'; id: string; patch: Partial<LoungePost> }
  | { type: 'hide'; username: string }
  | { type: 'posted'; post: LoungePost };

const listeners = new Set<(event: LoungeEvent) => void>();

// Discussions open as their own screens, so changes made there reach the list through here.
export const lounge = {
  subscriber: null as boolean | null,
  emit(event: LoungeEvent) {
    listeners.forEach((listener) => listener(event));
  },
  listen(listener: (event: LoungeEvent) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const RULES =
  'Keep it kind and about collecting. No harassment, adult content, spam or stolen work. Share only cards you own, and report problems for a moderator to review.';
