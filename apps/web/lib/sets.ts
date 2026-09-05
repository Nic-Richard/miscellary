import type {
  Card,
  CardSetDetail,
  CardSetSummary,
  CardTemplate,
  CardWrite,
  Paginated,
} from '@miscellary/shared';
import { apiFetch } from './api';
import type { PackLayer, PackTextLayer } from './setIdentity';

export const listPublicSets = (sort: 'new' | 'popular' = 'new') =>
  apiFetch<Paginated<CardSetSummary>>(`/api/v1/sets/?sort=${sort}`);
export const getPublicSet = (slug: string) => apiFetch<CardSetDetail>(`/api/v1/sets/${slug}/`);
export const listTemplates = () => apiFetch<CardTemplate[]>('/api/v1/templates/', { auth: false });

export const listMySets = () => apiFetch<CardSetSummary[]>('/api/v1/me/sets/');
export const createSet = (body: { title: string; description: string }) =>
  apiFetch<CardSetSummary>('/api/v1/me/sets/', { method: 'POST', body });
export const getMySet = (id: string) => apiFetch<CardSetDetail>(`/api/v1/me/sets/${id}/`);
export interface SetWrite {
  title: string;
  description: string;
  cover_id: string | null;
  mark: string;
  pack_colour: string;
  pack_finish: string;
  pack_layers: PackLayer[];
  emblem_layout: string;
  emblem_shape: string;
  emblem_style: string;
  emblem_text: string;
  emblem_type_scale: number;
  mark_scale: number;
  pack_subtitle: string;
  pack_text: PackTextLayer[];
  pack_size: number;
}

export const updateSet = (id: string, body: Partial<SetWrite>) =>
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
