import * as FileSystem from 'expo-file-system';
import { API_URL } from './api';

const CACHE_DIR = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}public-data/` : null;
const MAX_AGE = 60 * 60 * 1000;
const memory = new Map<string, CacheEntry<unknown>>();

type CacheEntry<T> = {
  savedAt: number;
  value: T;
};

function filePath(key: string) {
  return CACHE_DIR ? `${CACHE_DIR}${encodeURIComponent(`${API_URL}:${key}`)}.json` : null;
}

export async function readPublicCache<T>(key: string): Promise<T | null> {
  const cacheKey = `${API_URL}:${key}`;
  const cached = memory.get(cacheKey) as CacheEntry<T> | undefined;
  if (cached && Date.now() - cached.savedAt < MAX_AGE) return cached.value;

  const path = filePath(key);
  if (!path) return null;
  try {
    const entry = JSON.parse(await FileSystem.readAsStringAsync(path)) as CacheEntry<T>;
    if (Date.now() - entry.savedAt >= MAX_AGE) return null;
    memory.set(cacheKey, entry as CacheEntry<unknown>);
    return entry.value;
  } catch {
    return null;
  }
}

export async function writePublicCache<T>(key: string, value: T) {
  const entry: CacheEntry<T> = { savedAt: Date.now(), value };
  memory.set(`${API_URL}:${key}`, entry as CacheEntry<unknown>);

  const path = filePath(key);
  if (!path || !CACHE_DIR) return;
  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    await FileSystem.writeAsStringAsync(path, JSON.stringify(entry));
  } catch {
    return;
  }
}
