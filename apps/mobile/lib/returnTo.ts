export const RETURN_PARAM = 'next';
export const CONTINUE_PARAM = 'do';

const AUTH_ROUTES = ['/login', '/register'];

export function internalRoute(value: string | string[] | undefined): string | null {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || !path.startsWith('/')) return null;
  if (path.startsWith('//') || path.includes('\\')) return null;
  if ([...path].some((character) => character <= ' ')) return null;
  const [name] = path.split('?');
  if (!name || AUTH_ROUTES.includes(name)) return null;
  return path;
}

export function loginRoute(path: string, action?: string): string {
  const target = internalRoute(action ? `${path}?${CONTINUE_PARAM}=${action}` : path);
  return target ? `/login?${RETURN_PARAM}=${encodeURIComponent(target)}` : '/login';
}
