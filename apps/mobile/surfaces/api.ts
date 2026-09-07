import { request } from './bridge';
export class ApiRequestError extends Error {
  fields: Record<string, string[]> = {};
}
export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  return request('request', {
    path,
    method: options.method ?? 'GET',
    body: options.body,
  }) as Promise<T>;
}
