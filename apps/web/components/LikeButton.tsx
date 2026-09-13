'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { loginHref } from '@/lib/returnTo';
import styles from './LikeButton.module.css';

interface LikeButtonProps {
  liked: boolean;
  count: number;
  label?: string;
  onToggle: (like: boolean) => Promise<{ liked: boolean; like_count: number }>;
  action?: string;
  carries?: Record<string, string>;
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
}: LikeButtonProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount]);

  async function toggle() {
    const result = await onToggle(!liked);
    setLiked(result.liked);
    setCount(result.like_count);
    if (result.liked) setBeat((n) => n + 1);
  }

  if (!user)
    return (
      <Link
        href={loginHref(pathname, action, carries)}
        className={styles.root}
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
      aria-label={label ? (liked ? `Unlike ${label}` : `Like ${label}`) : 'Like'}
      className={`${styles.root} ${liked ? styles.on : ''}`}
      onClick={() => void toggle()}
    >
      <Heart />
      <b>{count}</b>
    </button>
  );
}
