'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { CardSetDetail } from '@miscellary/shared';
import { useAuth } from '@/lib/auth';
import { loginHref } from '@/lib/returnTo';
import { followSet, likeSet } from '@/lib/social';
import { useContinuation } from '@/lib/useContinuation';
import ReportButton from './ReportButton';
import ui from './ui.module.css';
import styles from './SetActions.module.css';

export const FOLLOW_SET_ACTION = 'follow-set';
export const LIKE_SET_ACTION = 'like-set';

const PACK = 'M6 3h12l-1 18H7ZM8 8h8M9 17h6';
const HEART =
  'M12 20.4 4.2 12.8a4.6 4.6 0 0 1 0-6.6 4.6 4.6 0 0 1 6.5 0l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.6Z';
const CHECK = 'm5 12.5 4.5 4.5L19 7';

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function SetActions({ set }: { set: CardSetDetail }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [following, setFollowing] = useState(set.following);
  const [followers, setFollowers] = useState(set.follower_count);
  const [liked, setLiked] = useState(set.liked);
  const [likes, setLikes] = useState(set.like_count);
  const [followBusy, setFollowBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFollowing(set.following);
    setFollowers(set.follower_count);
    setLiked(set.liked);
    setLikes(set.like_count);
  }, [set.following, set.follower_count, set.liked, set.like_count]);

  async function toggleFollow(next: boolean) {
    if (followBusy) return;
    setFollowBusy(true);
    setError(null);
    setFollowing(next);
    setFollowers((count) => count + (next ? 1 : -1));
    try {
      const result = await followSet(set.slug, next);
      setFollowing(result.following);
      setFollowers(result.follower_count);
    } catch (e) {
      setFollowing(!next);
      setFollowers((count) => count + (next ? -1 : 1));
      setError(e instanceof Error ? e.message : 'Could not update follow.');
    } finally {
      setFollowBusy(false);
    }
  }

  async function toggleLike(next: boolean) {
    if (likeBusy) return;
    setLikeBusy(true);
    setError(null);
    setLiked(next);
    setLikes((count) => count + (next ? 1 : -1));
    try {
      const result = await likeSet(set.slug, next);
      setLiked(result.liked);
      setLikes(result.like_count);
    } catch (e) {
      setLiked(!next);
      setLikes((count) => count + (next ? -1 : 1));
      setError(e instanceof Error ? e.message : 'Could not update like.');
    } finally {
      setLikeBusy(false);
    }
  }

  useContinuation(FOLLOW_SET_ACTION, () => void toggleFollow(true), Boolean(user) && !following);
  useContinuation(LIKE_SET_ACTION, () => void toggleLike(true), Boolean(user) && !liked);

  if (!user)
    return (
      <div className={styles.strip}>
        <Link
          href={loginHref(pathname, FOLLOW_SET_ACTION)}
          className={`${ui.action} ${styles.follow}`}
        >
          <Glyph d={PACK} />
          Follow
          {followers > 0 ? <b>{followers}</b> : null}
        </Link>
        <Link href={loginHref(pathname, LIKE_SET_ACTION)} className={ui.action}>
          <Glyph d={HEART} />
          <b>{likes}</b>
        </Link>
      </div>
    );

  return (
    <div className={styles.strip}>
      <button
        type="button"
        disabled={followBusy}
        title={
          following
            ? 'Its free pack and your progress stay on your Packs page'
            : 'Keeps its free pack on your Packs page'
        }
        className={`${ui.action} ${styles.follow} ${following ? ui.actionOn : ''}`}
        onClick={() => void toggleFollow(!following)}
      >
        <Glyph d={following ? CHECK : PACK} />
        {following ? 'Following' : 'Follow'}
        {followers > 0 ? <b>{followers}</b> : null}
      </button>

      <button
        type="button"
        aria-pressed={liked}
        disabled={likeBusy}
        aria-label={liked ? `Unlike ${set.title}` : `Like ${set.title}`}
        className={`${ui.action} ${liked ? ui.actionLiked : ''}`}
        onClick={() => void toggleLike(!liked)}
      >
        <Glyph d={HEART} />
        <b>{likes}</b>
      </button>

      {error ? <span className={ui.error}>{error}</span> : null}
      <span className={styles.report}>
        <ReportButton target={{ set_slug: set.slug }} />
      </span>
    </div>
  );
}
