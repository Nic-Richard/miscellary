'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { loginHref } from '@/lib/returnTo';
import ui from './ui.module.css';
import styles from './LikeButton.module.css';

interface LikeButtonProps {
  liked: boolean;
  count: number;
  label?: string;
  onToggle: (like: boolean) => Promise<{ liked: boolean; like_count: number }>;
  action?: string;
  carries?: Record<string, string>;
  /** Draw as one of the action-row chips rather than the bare heart used on binder cards. */
  chip?: boolean;
}

function Heart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20.4 4.2 12.8a4.6 4.6 0 0 1 0-6.6 4.6 4.6 0 0 1 6.5 0l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.6Z" />
    </svg>
  );
}

export default function LikeButton({
  liked: initialLiked,
  count: initialCount,
  label,
  onToggle,
  action,
  carries,
  chip = false,
}: LikeButtonProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [beat, setBeat] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount]);

  async function toggle() {
    if (busy) return;
    const next = !liked;
    setBusy(true);
    setError(null);
    setLiked(next);
    setCount((value) => value + (next ? 1 : -1));
    if (next) setBeat((n) => n + 1);
    try {
      const result = await onToggle(next);
      setLiked(result.liked);
      setCount(result.like_count);
    } catch (e) {
      setLiked(!next);
      setCount((value) => value + (next ? -1 : 1));
      setError(e instanceof Error ? e.message : 'Could not update like.');
    } finally {
      setBusy(false);
    }
  }

  if (!user)
    return (
      <Link
        href={loginHref(pathname, action, carries)}
        className={chip ? ui.action : styles.root}
        title="Log in to like"
      >
        <Heart />
        <b>{count}</b>
      </Link>
    );

  return (
    <button
      type="button"
      key={beat}
      aria-pressed={liked}
      disabled={busy}
      title={error ?? undefined}
      aria-label={label ? (liked ? `Unlike ${label}` : `Like ${label}`) : 'Like'}
      className={
        chip
          ? `${ui.action} ${liked ? ui.actionLiked : ''}`
          : `${styles.root} ${liked ? styles.on : ''}`
      }
      onClick={() => void toggle()}
    >
      <Heart />
      <b>{count}</b>
    </button>
  );
}
