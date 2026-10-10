import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function useMutation<T>(onDone: (result: T, path: string, method: string) => void) {
  const { user } = useAuth();
  const current = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setBusy(false);
    setError(null);
    return () => {
      current.current?.abort();
      current.current = null;
    };
  }, [user?.id]);
  async function run(path: string, method: string, body?: unknown, throwOnError = false) {
    if (current.current) return false;
    const controller = new AbortController();
    current.current = controller;
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<T>(path, {
        method,
        signal: controller.signal,
        ...(body ? { body } : {}),
      });
      if (controller.signal.aborted) return false;
      onDone(result, path, method);
      return true;
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : 'Please try again.');
      if (throwOnError) throw err;
      return false;
    } finally {
      if (current.current === controller) {
        current.current = null;
        setBusy(false);
      }
    }
  }
  return { run, busy, error };
}

export function confirmRemoval(title: string, action: () => void) {
  Alert.alert(title, 'The content will be removed; replies keep their place.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: action },
  ]);
}
