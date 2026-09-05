import type {
  Comment,
  CommentThread,
  ProfilePage,
  ReportReason,
  SearchResults,
  ShowcaseSlot,
} from '@miscellary/shared';
import { apiFetch } from './api';

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
export const getComments = (slug: string) =>
  // Sent with the reader's token when they have one, so the thread comes back
  // knowing which comments they may take down.
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
  comment_id?: string;
  username?: string;
  reason: ReportReason;
  details: string;
}) => apiFetch<{ id: string }>('/api/v1/reports/', { method: 'POST', body });
export const search = (q: string) =>
  apiFetch<SearchResults>(`/api/v1/search/?q=${encodeURIComponent(q)}`, { auth: false });

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'explicit', label: 'Explicit or adult content' },
  { value: 'real_person', label: 'Inappropriate use of a real person' },
  { value: 'stolen', label: 'Stolen photo or content' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
];
