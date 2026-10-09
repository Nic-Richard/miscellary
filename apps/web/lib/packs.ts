import type {
  OwnedCard,
  PackPayment,
  PackOpening,
  PackStatus,
  Paginated,
  SetPointsBalance,
} from '@miscellary/shared';
import { apiFetch } from './api';
import { listOwnedCardPages } from '@miscellary/shared';

export const getPackStatus = (slug: string, signal?: AbortSignal) =>
  apiFetch<PackStatus>(`/api/v1/sets/${slug}/packs/`, { signal: signal ?? null });
export const openPack = (slug: string, payment: PackPayment) =>
  apiFetch<PackOpening>(`/api/v1/sets/${slug}/packs/open/`, {
    method: 'POST',
    body: typeof payment === 'boolean' ? { use_points: payment } : payment,
  });
export const listMyCards = (
  setSlug?: string,
  page?: number,
  options?: { query?: string; signal?: AbortSignal },
) => {
  const query = new URLSearchParams();
  if (setSlug) query.set('set', setSlug);
  if (page && page > 1) query.set('page', String(page));
  if (options?.query) query.set('q', options.query);
  const search = query.toString();
  return apiFetch<Paginated<OwnedCard>>(`/api/v1/me/cards/${search ? `?${search}` : ''}`, {
    signal: options?.signal ?? null,
  });
};

export const listAllMyCards = (setSlug?: string) => listOwnedCardPages(listMyCards, setSlug);
export const recycleCard = (id: string) =>
  apiFetch<{ points: number; earned: number; set_slug: string }>(
    `/api/v1/me/cards/${id}/recycle/`,
    { method: 'POST' },
  );
export const recycleDuplicates = (slug: string) =>
  apiFetch<{ recycled: number; earned: number; points: number; set_slug: string }>(
    `/api/v1/me/sets/${slug}/recycle-duplicates/`,
    { method: 'POST' },
  );
export const listMyPoints = () => apiFetch<SetPointsBalance[]>('/api/v1/me/points/');
