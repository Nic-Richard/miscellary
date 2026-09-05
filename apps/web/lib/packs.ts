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
export const listMyCards = (setSlug?: string) =>
  apiFetch<Paginated<OwnedCard>>(
    `/api/v1/me/cards/${setSlug ? `?set=${encodeURIComponent(setSlug)}` : ''}`,
  );
export const recycleCard = (id: string) =>
  apiFetch<{ points: number; set_slug: string }>(`/api/v1/me/cards/${id}/recycle/`, {
    method: 'POST',
  });
export const listMyPoints = () => apiFetch<SetPointsBalance[]>('/api/v1/me/points/');
