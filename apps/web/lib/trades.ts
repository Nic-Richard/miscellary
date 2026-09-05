import type { OwnedCard, Paginated, TradeOffer, TradeOfferWrite } from '@miscellary/shared';
import { apiFetch } from './api';

export const listUserCards = (username: string) =>
  apiFetch<Paginated<OwnedCard>>(`/api/v1/users/${encodeURIComponent(username)}/cards/`);
export const listOffers = (box: 'inbox' | 'outbox' | 'history') =>
  apiFetch<TradeOffer[]>(`/api/v1/me/trades/?box=${box}`);
export const getOffer = (id: string) => apiFetch<TradeOffer>(`/api/v1/me/trades/${id}/`);
export const createOffer = (body: TradeOfferWrite) =>
  apiFetch<TradeOffer>('/api/v1/me/trades/', { method: 'POST', body });
export const counterOffer = (id: string, body: TradeOfferWrite) =>
  apiFetch<TradeOffer>(`/api/v1/me/trades/${id}/counter/`, { method: 'POST', body });
export const actOnOffer = (id: string, action: 'accept' | 'reject' | 'cancel') =>
  apiFetch<TradeOffer>(`/api/v1/me/trades/${id}/${action}/`, { method: 'POST' });
