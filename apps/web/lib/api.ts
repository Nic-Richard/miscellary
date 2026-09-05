import type { ApiError } from '@miscellary/shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiRequestError extends Error {
  status: number;
  fields: Record<string, string[]>;

  constructor(status: number, message: string, fields: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
}

// Single entry point for API calls. Normalises network and API failures into
// ApiRequestError so pages can show one message instead of guessing.
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;
  const init: RequestInit = {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Platform': 'web',
      ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(headers as Record<string, string>),
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiRequestError(
      0,
      'Could not reach the server. Check your connection and try again.',
    );
  }

  // Access tokens only last 15 minutes. On a 401, refresh once and retry.
  if (res.status === 401 && auth && !options.headers) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiFetch<T>(path, { ...options, headers: { 'X-Retry': '1' } });
  }

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new ApiRequestError(res.status, 'Something went wrong. Please try again.');
    throw new ApiRequestError(res.status, 'Unexpected response from the server.');
  }

  if (!res.ok) {
    const err = data as Partial<ApiError>;
    throw new ApiRequestError(res.status, err.error ?? 'Something went wrong.', err.fields ?? {});
  }
  return data as T;
}

export async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Client-Platform': 'web' },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access: string };
    accessToken = data.access;
    return true;
  } catch {
    return false;
  }
}
