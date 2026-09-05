import type {
  Card,
  CardSetDetail,
  CardSetSummary,
  CardTemplate,
  CardWrite,
  OwnedCard,
  PackOpening,
  PackStatus,
  Paginated,
  ProfilePage,
  ReportReason,
  SearchResults,
  SetPointsBalance,
  ShowcaseSlot,
  TradeOffer,
  TradeOfferWrite,
} from '@miscellary/shared';
import { apiFetch } from './api';

export const listPublicSets = (sort: 'new' | 'popular' = 'new') =>
  apiFetch<Paginated<CardSetSummary>>(`/api/v1/sets/?sort=${sort}`);
export const getPublicSet = (slug: string) => apiFetch<CardSetDetail>(`/api/v1/sets/${slug}/`);
export const listTemplates = () => apiFetch<CardTemplate[]>('/api/v1/templates/', { auth: false });
export const search = (q: string) =>
  apiFetch<SearchResults>(`/api/v1/search/?q=${encodeURIComponent(q)}`);

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
export const createCard = (setId: string, body: CardWrite) =>
  apiFetch<Card>(`/api/v1/me/sets/${setId}/cards/`, { method: 'POST', body });
export const updateCard = (setId: string, cardId: string, body: Partial<CardWrite>) =>
  apiFetch<Card>(`/api/v1/me/sets/${setId}/cards/${cardId}/`, { method: 'PATCH', body });
export const deleteCard = (setId: string, cardId: string) =>
  apiFetch<void>(`/api/v1/me/sets/${setId}/cards/${cardId}/`, { method: 'DELETE' });

export const getPackStatus = (slug: string) => apiFetch<PackStatus>(`/api/v1/sets/${slug}/packs/`);
export const openPack = (slug: string, usePoints: boolean) =>
  apiFetch<PackOpening>(`/api/v1/sets/${slug}/packs/open/`, {
    method: 'POST',
    body: { use_points: usePoints },
  });
export const listMyCards = (setSlug?: string) =>
  apiFetch<Paginated<OwnedCard>>(
    `/api/v1/me/cards/${setSlug ? `?set=${encodeURIComponent(setSlug)}` : ''}`,
  );
export const listUserCards = (username: string) =>
  apiFetch<Paginated<OwnedCard>>(`/api/v1/users/${encodeURIComponent(username)}/cards/`);
export const recycleCard = (id: string) =>
  apiFetch<{ points: number; set_slug: string }>(`/api/v1/me/cards/${id}/recycle/`, {
    method: 'POST',
  });
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

export const getProfile = (username: string) =>
  apiFetch<ProfilePage>(`/api/v1/users/${encodeURIComponent(username)}/`);
export const setFollow = (username: string, follow: boolean) =>
  apiFetch<{ following: boolean; follower_count: number }>(
    `/api/v1/users/${encodeURIComponent(username)}/follow/`,
    {
      method: follow ? 'POST' : 'DELETE',
    },
  );
export const getShowcase = () => apiFetch<ShowcaseSlot[]>('/api/v1/me/showcase/');
export const saveShowcase = (slots: { position: number; owned_card_id: string }[]) =>
  apiFetch<ShowcaseSlot[]>('/api/v1/me/showcase/', {
    method: 'PUT',
    body: {
      slots: slots.map((s) => ({ position: String(s.position), owned_card_id: s.owned_card_id })),
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
export const sendReport = (body: {
  set_slug?: string;
  card_id?: string;
  username?: string;
  reason: ReportReason;
  details: string;
}) => apiFetch<{ id: string }>('/api/v1/reports/', { method: 'POST', body });
export const updateProfile = (body: { display_name: string; bio: string }) =>
  apiFetch<unknown>('/api/v1/auth/me/', { method: 'PATCH', body });
