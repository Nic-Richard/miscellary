export function resolveApiUrl(
  explicit: string | undefined,
  hostUri: string | undefined,
  development: boolean,
): string {
  if (explicit?.trim()) return explicit.trim().replace(/\/$/, '');
  if (!development) throw new Error('Set EXPO_PUBLIC_API_URL for the release build.');
  // React Native 0.79 does not implement URL.hostname.
  const hostname = hostUri?.match(/^(\[[^\]]+\]|[^:/]+)(?::\d+)?(?:\/|$)/)?.[1] ?? '10.0.2.2';
  return `http://${hostname}:8000`;
}

export function localMediaUrl(
  key: string,
  value: unknown,
  apiUrl: string,
  development: boolean,
): unknown {
  if (!development || typeof value !== 'string' || !['url', 'avatar_url'].includes(key))
    return value;
  const host = apiUrl.match(/^https?:\/\/(\[[^\]]+\]|[^:/]+)/)?.[1];
  if (!host) return value;
  return value.replace(
    /^(https?:\/\/)(?:localhost|127\.0\.0\.1|10\.0\.2\.2)(?=[:/]|$)/,
    `$1${host}`,
  );
}
