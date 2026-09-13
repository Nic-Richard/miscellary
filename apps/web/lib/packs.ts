import type {
  OwnedCard,
  PackOpening,
  PackStatus,
  Paginated,
  SetPointsBalance,
} from '@miscellary/shared';
import { apiFetch } from './api';

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

/** Every owned copy, not just the first page. The collection page counts and
 *  groups the whole holding, so a partial page would report the wrong totals. */
export const listAllMyCards = async (setSlug?: string): Promise<OwnedCard[]> => {
  const all: OwnedCard[] = [];
  for (let page = 1; ; page += 1) {
    const result = await listMyCards(setSlug, page);
    all.push(...result.results);
    if (!result.next) return all;
  }
};
export const recycleCard = (id: string) =>
  apiFetch<{ points: number; earned: number; set_slug: string }>(
    `/api/v1/me/cards/${id}/recycle/`,
    { method: 'POST' },
  );
export const listMyPoints = () => apiFetch<SetPointsBalance[]>('/api/v1/me/points/');
