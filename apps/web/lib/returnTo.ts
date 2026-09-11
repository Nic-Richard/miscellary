export const RETURN_PARAM = 'next';
export const CONTINUE_PARAM = 'do';
export const DEFAULT_RETURN = '/account';

const AUTH_PATHS = ['/login', '/register'];

export function internalPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/')) return null;
  if (value.startsWith('//') || value.includes('\\')) return null;
  if ([...value].some((character) => character <= ' ' || character === '')) return null;
  let url: URL;
  try {
    url = new URL(value, 'http://return.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'http://return.invalid') return null;
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (AUTH_PATHS.some((auth) => url.pathname === auth)) return null;
  return path;
}

function withParam(path: string, name: string, value: string): string {
  const url = new URL(path, 'http://return.invalid');
  url.searchParams.set(name, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function loginHref(path: string, action?: string, extra?: Record<string, string>): string {
  let destination = action ? withParam(path, CONTINUE_PARAM, action) : path;
  for (const [name, value] of Object.entries(extra ?? {})) {
    destination = withParam(destination, name, value);
  }
  const target = internalPath(destination);
  return target ? withParam('/login', RETURN_PARAM, target) : '/login';
}

export function registerHref(path: string, action?: string): string {
  return loginHref(path, action).replace('/login?', '/register?');
}

export function returnPath(search: { get(name: string): string | null }): string {
  return internalPath(search.get(RETURN_PARAM)) ?? DEFAULT_RETURN;
}

export function swapAuthHref(to: '/login' | '/register', search: { toString(): string }): string {
  const query = search.toString();
  return query ? `${to}?${query}` : to;
}
