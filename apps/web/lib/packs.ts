import type {
  OwnedCard,
  PackOpening,
  PackStatus,
  Paginated,
  SetPointsBalance,
} from '@miscellary/shared';
import { apiFetch } from './api';
import { listOwnedCardPages } from '@miscellary/shared';

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
