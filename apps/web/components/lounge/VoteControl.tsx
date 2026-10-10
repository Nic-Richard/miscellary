'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Vote } from '@miscellary/shared';
import { useAuth } from '@/lib/auth';
import styles from './Lounge.module.css';

export default function VoteControl({
  score,
  vote,
  label,
  onVote,
  compact = false,
  disabled = false,
}: {
  score: number;
  vote: Vote;
  label: string;
  onVote: (value: Vote) => Promise<{ score: number; my_vote: Vote }>;
  compact?: boolean;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState({ score, vote });
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState({ score, vote });
  if (synced.score !== score || synced.vote !== vote) {
    setSynced({ score, vote });
    setState({ score, vote });
  }

  async function cast(value: 1 | -1) {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (busy) return;
    const next: Vote = state.vote === value ? 0 : value;
    const before = state;
    // Shown straight away; the server's count replaces it when it answers.
    setState({ score: state.score - state.vote + next, vote: next });
    setBusy(true);
    try {
      const result = await onVote(next);
      setState({ score: result.score, vote: result.my_vote });
    } catch {
      setState(before);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`${styles.vote} ${compact ? styles.voteCompact : ''}`}
      role="group"
      aria-label={`Votes for ${label}`}
    >
      <button
        type="button"
        aria-label="Upvote"
        aria-pressed={state.vote === 1}
        disabled={disabled}
        onClick={() => void cast(1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4 4 14h5v6h6v-6h5Z" />
        </svg>
      </button>
      <b aria-live="polite">{state.score}</b>
      <button
        type="button"
        aria-label="Downvote"
        aria-pressed={state.vote === -1}
        disabled={disabled}
        onClick={() => void cast(-1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20 4 10h5V4h6v6h5Z" />
        </svg>
      </button>
    </div>
  );
}
