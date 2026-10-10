import type {
  LoungePost,
  LoungeReply,
  LoungeTopic,
  SavedFolder,
  UserSummary,
  Vote,
} from '@miscellary/shared';
import { apiFetch } from './api';

export const votePost = (id: string, value: Vote) =>
  apiFetch<{ score: number; my_vote: Vote }>(`/api/v1/lounge/posts/${id}/vote/`, {
    method: value ? 'POST' : 'DELETE',
    ...(value ? { body: { value } } : {}),
  });

export const voteReply = (id: string, value: Vote) =>
  apiFetch<{ score: number; my_vote: Vote }>(`/api/v1/lounge/replies/${id}/vote/`, {
    method: value ? 'POST' : 'DELETE',
    ...(value ? { body: { value } } : {}),
  });

export const editPost = (
  id: string,
  changes: { title?: string; body?: string; topic?: LoungeTopic; publish?: boolean },
) => apiFetch<LoungePost>(`/api/v1/lounge/posts/${id}/`, { method: 'PATCH', body: changes });

export const editReply = (id: string, body: string) =>
  apiFetch<LoungeReply>(`/api/v1/lounge/replies/${id}/`, { method: 'PATCH', body: { body } });

export const savePost = (id: string, saved: boolean, folderId: number | null = null) =>
  apiFetch<{ saved: boolean; folder_id: number | null }>(`/api/v1/lounge/posts/${id}/save/`, {
    method: saved ? 'POST' : 'DELETE',
    ...(saved ? { body: { folder_id: folderId } } : {}),
  });

export const listFolders = () => apiFetch<SavedFolder[]>('/api/v1/me/lounge/folders/');

export const createFolder = (name: string) =>
  apiFetch<SavedFolder>('/api/v1/me/lounge/folders/', { method: 'POST', body: { name } });

const summaries = new Map<string, Promise<UserSummary>>();

// Hover previews repeat often on one page, so each person is fetched once per visit.
export function userSummary(username: string, fresh = false): Promise<UserSummary> {
  const cached = summaries.get(username);
  if (cached && !fresh) return cached;
  const request = apiFetch<UserSummary>(
    `/api/v1/users/${encodeURIComponent(username)}/summary/`,
  ).catch((err: unknown) => {
    summaries.delete(username);
    throw err;
  });
  summaries.set(username, request);
  return request;
}
