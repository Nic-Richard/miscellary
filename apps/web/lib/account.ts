import type { CurrentUser } from '@miscellary/shared';
import { apiFetch, setAccessToken } from './api';

export interface ProfileWrite {
  display_name: string;
  bio: string;
  showcase_title: string;
  binder_colour: string;
}

export const updateProfile = (body: Partial<ProfileWrite>) =>
  apiFetch<CurrentUser>('/api/v1/auth/me/', { method: 'PATCH', body });

export const changeUsername = (username: string, currentPassword: string) =>
  apiFetch<CurrentUser>('/api/v1/auth/username/', {
    method: 'POST',
    body: { username, current_password: currentPassword },
  });

// Changing the password signs out every other session and hands this one a fresh token.
export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await apiFetch<{ access: string }>('/api/v1/auth/password/change/', {
    method: 'POST',
    body: { current_password: currentPassword, new_password: newPassword },
  });
  setAccessToken(session.access);
}

export const deleteAccount = (currentPassword: string) =>
  apiFetch<void>('/api/v1/auth/delete/', {
    method: 'POST',
    body: { current_password: currentPassword },
  });

export const resendVerificationEmail = () =>
  apiFetch<void>('/api/v1/auth/verify-email/request/', { method: 'POST' });

export const confirmEmailVerification = (token: string) =>
  apiFetch<void>('/api/v1/auth/verify-email/confirm/', {
    method: 'POST',
    body: { token },
    auth: false,
  });

export const requestPasswordReset = (email: string) =>
  apiFetch<void>('/api/v1/auth/password-reset/request/', {
    method: 'POST',
    body: { email },
    auth: false,
  });

export const confirmPasswordReset = (uid: string, token: string, password: string) =>
  apiFetch<void>('/api/v1/auth/password-reset/confirm/', {
    method: 'POST',
    body: { uid, token, password },
    auth: false,
  });
