import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import ActionChip from '@/components/ActionChip';
import { ErrorText } from '@/components/ui';
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

export function LoungeLike({
  path,
  liked: initialLiked,
  count: initialCount,
  onChange,
}: {
  path: string;
  liked: boolean;
  count: number;
  onChange?: (liked: boolean, likes: number) => void;
}) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount]);
  useEffect(() => () => request.current?.abort(), [user?.id]);
  async function toggle() {
    if (!user) {
      router.push('/login');
      return;
    }
    if (request.current && !request.current.signal.aborted) return;
    const controller = new AbortController();
    request.current = controller;
    const next = !liked;
    setLiked(next);
    setCount(count + (next ? 1 : -1));
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ liked: boolean; likes: number }>(path, {
        method: next ? 'POST' : 'DELETE',
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setLiked(result.liked);
        setCount(result.likes);
        onChange?.(result.liked, result.likes);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setLiked(liked);
        setCount(count);
        setError(err instanceof Error ? err.message : 'Could not update like.');
      }
    } finally {
      controller.abort();
      if (request.current === controller) setBusy(false);
    }
  }
  return (
    <View>
      <ActionChip
        icon="heart"
        count={count}
        tone={liked ? 'liked' : 'plain'}
        disabled={busy}
        accessibilityLabel={liked ? 'Unlike' : 'Like'}
        onPress={() => void toggle()}
      />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
