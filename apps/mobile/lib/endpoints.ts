import type {
  Card,
  CardSetDetail,
  CardSetSummary,
  CardTemplate,
  CardWrite,
  Comment,
  CommentThread,
  Creator,
  CurrentUser,
  NotificationList,
  OwnedCard,
  PackOpening,
  PacksPage,
  PackStatus,
  Paginated,
  ProfilePage,
  ReportReason,
  SearchResults,
  SetPointsBalance,
  ShowcaseSlot,
  Tag,
  TagSummary,
  TradeOffer,
  TradeOfferWrite,
} from '@miscellary/shared';
import { apiFetch, saveRefreshToken, setAccessToken } from './api';

export const listPublicSets = (
  sort: 'new' | 'popular' = 'new',
  next: string | null = null,
  signal?: AbortSignal,
) => {
  // Pagination URLs may carry the Docker host; keep requests on our configured API.
  const page = next?.match(/[?&]page=(\d+)(?:&|$)/)?.[1];
  const query = `sort=${sort}` + (page ? `&page=${encodeURIComponent(page)}` : '');
  return apiFetch<Paginated<CardSetSummary>>(`/api/v1/sets/?${query}`, { auth: false, signal });
};
export const listTags = (q?: string) =>
  apiFetch<TagSummary[]>(`/api/v1/tags/${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
    auth: false,
  });
export const getPublicSet = (slug: string, auth = true) =>
  apiFetch<CardSetDetail>(`/api/v1/sets/${slug}/`, { auth });
export const listTemplates = () => apiFetch<CardTemplate[]>('/api/v1/templates/', { auth: false });
export const search = (q: string) =>
  apiFetch<SearchResults>(`/api/v1/search/?q=${encodeURIComponent(q)}`, { auth: false });

export const listMySets = () => apiFetch<CardSetSummary[]>('/api/v1/me/sets/');
export const createSet = (body: { title: string; description: string }) =>
  apiFetch<CardSetSummary>('/api/v1/me/sets/', { method: 'POST', body });
export const getMySet = (id: string) => apiFetch<CardSetDetail>(`/api/v1/me/sets/${id}/`);
export const updateSet = (id: string, body: Partial<{ title: string; description: string }>) =>
  apiFetch<CardSetDetail>(`/api/v1/me/sets/${id}/`, { method: 'PATCH', body });
export const deleteSet = (id: string) =>
  apiFetch<void>(`/api/v1/me/sets/${id}/`, { method: 'DELETE' });
export const publishProblems = (id: string) =>
  apiFetch<{ problems: string[] }>(`/api/v1/me/sets/${id}/publish/`);
export const publishSet = (id: string) =>
  apiFetch<CardSetDetail>(`/api/v1/me/sets/${id}/publish/`, { method: 'POST' });
export const reorderCards = (setId: string, cardIds: string[]) =>
  apiFetch<Card[]>(`/api/v1/me/sets/${setId}/cards/order/`, {
    method: 'POST',
    body: { card_ids: cardIds },
  });
export const createCard = (setId: string, body: CardWrite) =>
  apiFetch<Card>(`/api/v1/me/sets/${setId}/cards/`, { method: 'POST', body });
export const deleteCard = (setId: string, cardId: string) =>
  apiFetch<void>(`/api/v1/me/sets/${setId}/cards/${cardId}/`, { method: 'DELETE' });

// Tags stay editable after publication, so they are separate from the set and
// card writes a published set refuses.
export const saveSetTags = (setId: string, tags: string[]) =>
  apiFetch<Tag[]>(`/api/v1/me/sets/${setId}/tags/`, { method: 'PUT', body: { tags } });
export const saveCardTags = (setId: string, cardId: string, tags: string[]) =>
  apiFetch<Tag[]>(`/api/v1/me/sets/${setId}/cards/${cardId}/tags/`, {
    method: 'PUT',
    body: { tags },
  });

export const getPackStatus = (slug: string) => apiFetch<PackStatus>(`/api/v1/sets/${slug}/packs/`);
export const openPack = (slug: string, usePoints: boolean) =>
  apiFetch<PackOpening>(`/api/v1/sets/${slug}/packs/open/`, {
    method: 'POST',
    body: { use_points: usePoints },
  });
export const listMyCards = (setSlug?: string, page?: number) => {
  const query = new URLSearchParams();
  if (setSlug) query.set('set', setSlug);
  if (page && page > 1) query.set('page', String(page));
  const search = query.toString();
  return apiFetch<Paginated<OwnedCard>>(`/api/v1/me/cards/${search ? `?${search}` : ''}`);
};

/** Every owned copy, not just the first page. The collection counts the whole
 *  holding, so a partial page would report the wrong totals. */
export const listAllMyCards = async (setSlug?: string): Promise<OwnedCard[]> => {
  const first = await listMyCards(setSlug);
  if (!first.next) return first.results;
  // A full first page gives the page size, so the rest can be asked for at once.
  const pages = Math.ceil(first.count / first.results.length);
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) => listMyCards(setSlug, index + 2)),
  );
  return [first.results, ...rest.map((page) => page.results)].flat();
};
export const listUserCards = (username: string) =>
  apiFetch<Paginated<OwnedCard>>(`/api/v1/users/${encodeURIComponent(username)}/cards/`);
export const recycleCard = (id: string) =>
  apiFetch<{ points: number; earned: number; set_slug: string }>(
    `/api/v1/me/cards/${id}/recycle/`,
    {
      method: 'POST',
    },
  );
export const listMyPoints = () => apiFetch<SetPointsBalance[]>('/api/v1/me/points/');

export const listOffers = (box: 'inbox' | 'outbox' | 'history') =>
  apiFetch<TradeOffer[]>(`/api/v1/me/trades/?box=${box}`);
export const getOffer = (id: string) => apiFetch<TradeOffer>(`/api/v1/me/trades/${id}/`);
export const createOffer = (body: TradeOfferWrite) =>
  apiFetch<TradeOffer>('/api/v1/me/trades/', { method: 'POST', body });
export const counterOffer = (id: string, body: TradeOfferWrite) =>
  apiFetch<TradeOffer>(`/api/v1/me/trades/${id}/counter/`, { method: 'POST', body });
export const actOnOffer = (id: string, action: 'accept' | 'reject' | 'cancel') =>
  apiFetch<TradeOffer>(`/api/v1/me/trades/${id}/${action}/`, { method: 'POST' });

export const getProfile = (username: string, auth = true) =>
  apiFetch<ProfilePage>(`/api/v1/users/${encodeURIComponent(username)}/`, { auth });
export const setFollow = (username: string, follow: boolean) =>
  apiFetch<{ following: boolean; follower_count: number }>(
    `/api/v1/users/${encodeURIComponent(username)}/follow/`,
    {
      method: follow ? 'POST' : 'DELETE',
    },
  );
export const listFollows = (username: string, direction: 'followers' | 'following', page = 1) =>
  apiFetch<Paginated<Creator>>(
    `/api/v1/users/${encodeURIComponent(username)}/${direction}/?page=${page}`,
    { auth: false },
  );
export const getShowcase = () => apiFetch<ShowcaseSlot[]>('/api/v1/me/showcase/');
export const saveShowcase = (slots: { position: number; owned_card_id: string }[]) =>
  apiFetch<ShowcaseSlot[]>('/api/v1/me/showcase/', {
    method: 'PUT',
    body: {
      slots: slots.map((s) => ({
        position: String(s.position + 1),
        owned_card_id: s.owned_card_id,
      })),
    },
  });
export const likeSet = (slug: string, like: boolean) =>
  apiFetch<{ liked: boolean; like_count: number }>(`/api/v1/sets/${slug}/like/`, {
    method: like ? 'POST' : 'DELETE',
  });
export const likeCard = (id: string, like: boolean) =>
  apiFetch<{ liked: boolean; like_count: number }>(`/api/v1/cards/${id}/like/`, {
    method: like ? 'POST' : 'DELETE',
  });
export const followSet = (slug: string, follow: boolean) =>
  apiFetch<{ following: boolean; follower_count: number }>(`/api/v1/sets/${slug}/follow/`, {
    method: follow ? 'POST' : 'DELETE',
  });
export const getMyPacks = () => apiFetch<PacksPage>('/api/v1/me/packs/');
export const getNotifications = (page = 1) =>
  apiFetch<NotificationList>(`/api/v1/me/notifications/?page=${page}`);
export const markNotificationsRead = (id?: string) =>
  apiFetch<{ unread: number }>('/api/v1/me/notifications/', {
    method: 'POST',
    body: id ? { id } : {},
  });
export const getComments = (slug: string) =>
  apiFetch<CommentThread>(`/api/v1/sets/${slug}/comments/`);
export const postComment = (slug: string, body: string, parentId?: string) =>
  apiFetch<Comment>(`/api/v1/sets/${slug}/comments/`, {
    method: 'POST',
    body: parentId ? { body, parent_id: parentId } : { body },
  });
export const deleteComment = (id: string) =>
  apiFetch<void>(`/api/v1/comments/${id}/`, { method: 'DELETE' });
export const sendReport = (body: {
  set_slug?: string;
  card_id?: string;
  username?: string;
  reason: ReportReason;
  details: string;
}) => apiFetch<{ id: string }>('/api/v1/reports/', { method: 'POST', body });
export const updateProfile = (body: { display_name: string; bio: string }) =>
  apiFetch<CurrentUser>('/api/v1/auth/me/', { method: 'PATCH', body });
export const changeUsername = (username: string, currentPassword: string) =>
  apiFetch<CurrentUser>('/api/v1/auth/username/', {
    method: 'POST',
    body: { username, current_password: currentPassword },
  });
// Changing the password revokes every refresh token, this device's included, so keep the new one.
export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await apiFetch<{ access: string; refresh: string }>(
    '/api/v1/auth/password/change/',
    { method: 'POST', body: { current_password: currentPassword, new_password: newPassword } },
  );
  setAccessToken(session.access);
  await saveRefreshToken(session.refresh);
}
export const deleteAccount = (currentPassword: string) =>
  apiFetch<void>('/api/v1/auth/delete/', {
    method: 'POST',
    body: { current_password: currentPassword },
  });
export const resendVerificationEmail = () =>
  apiFetch<void>('/api/v1/auth/verify-email/request/', { method: 'POST' });
export const requestPasswordReset = (email: string) =>
  apiFetch<void>('/api/v1/auth/password-reset/request/', {
    method: 'POST',
    body: { email },
    auth: false,
  });
