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
  onToggle: (like: boolean) => Promise<{ liked: boolean; like_count: number }>;
  action?: string;
  carries?: Record<string, string>;
}

export default function LikeButton({
  liked: initialLiked,
  count: initialCount,
  onToggle,
  action,
  carries,
}: LikeButtonProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount]);

  async function toggle() {
    const result = await onToggle(!liked);
    setLiked(result.liked);
    setCount(result.like_count);
  }

  if (!user)
    return (
      <Link
        href={loginHref(pathname, action, carries)}
        className={styles.root}
        title="Log in to like"
      >
        ♥ {count}
      </Link>
    );

  return (
    <button
      type="button"
      className={`${styles.root} ${liked ? styles.on : ''}`}
      onClick={() => void toggle()}
    >
      ♥ {count}
    </button>
  );
}
