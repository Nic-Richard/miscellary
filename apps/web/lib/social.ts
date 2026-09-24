import type {
  Comment,
  CommentThread,
  Creator,
  NotificationList,
  Paginated,
  PacksPage,
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
export const likeCard = (id: string, like: boolean) =>
  apiFetch<{ liked: boolean; like_count: number }>(`/api/v1/cards/${id}/like/`, {
    method: like ? 'POST' : 'DELETE',
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
  comment_id?: string;
  username?: string;
  reason: ReportReason;
  details: string;
}) => apiFetch<{ id: string }>('/api/v1/reports/', { method: 'POST', body });
export const search = (q: string) =>
  apiFetch<SearchResults>(`/api/v1/search/?q=${encodeURIComponent(q)}`, { auth: false });

export { REPORT_REASONS } from '@miscellary/shared';
