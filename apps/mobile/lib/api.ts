import type { ApiError } from '@miscellary/shared';
import * as SecureStore from 'expo-secure-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000';
const REFRESH_KEY = 'miscellary.refresh';

let accessToken: string | null = null;

export class ApiRequestError extends Error {
  status: number;
  fields: Record<string, string[]>;

  constructor(status: number, message: string, fields: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function saveRefreshToken(token: string | null) {
  if (token) await SecureStore.setItemAsync(REFRESH_KEY, token);
  else await SecureStore.deleteItemAsync(REFRESH_KEY);
}

// Mobile keeps the refresh token in SecureStore and sends it in the body.
export async function refreshAccessToken(): Promise<boolean> {
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'mobile' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) {
      await saveRefreshToken(null);
      return false;
    }
    const data = (await res.json()) as { access: string; refresh: string };
    accessToken = data.access;
    await saveRefreshToken(data.refresh);
    return true;
  } catch {
    return false;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  retried?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, retried = false, headers, ...rest } = options;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(headers as Record<string, string>),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, 'Could not reach the server. Check your connection.');
  }

  if (res.status === 401 && auth && !retried && (await refreshAccessToken())) {
    return apiFetch<T>(path, { ...options, retried: true });
  }
  if (res.status === 204) return undefined as T;

  const data = (await res.json().catch(() => null)) as (Partial<ApiError> & T) | null;
  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      data?.error ?? 'Something went wrong.',
      data?.fields ?? {},
    );
  }
  return data as T;
}
