'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import styles from './LikeButton.module.css';

interface LikeButtonProps {
  liked: boolean;
  count: number;
  onToggle: (like: boolean) => Promise<{ liked: boolean; like_count: number }>;
}

export default function LikeButton({
  liked: initialLiked,
  count: initialCount,
  onToggle,
}: LikeButtonProps) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  async function toggle() {
    const result = await onToggle(!liked);
    setLiked(result.liked);
    setCount(result.like_count);
  }

  return (
    <button
      type="button"
      className={`${styles.root} ${liked ? styles.on : ''}`}
      onClick={() => void toggle()}
      disabled={!user}
      title={user ? undefined : 'Log in to like'}
    >
      ♥ {count}
    </button>
  );
}
