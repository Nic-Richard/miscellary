'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { OwnedCard, ProfilePage } from '@miscellary/shared';
import { SHOWCASE_SLOTS } from '@miscellary/shared';
import BinderCover from '@/components/BinderCover';
import coverStyles from '@/components/BinderCover.module.css';
import Sheet, { Empty } from '@/components/Sheet';
import { OwnedCardInspector } from '@/components/CardInspector';
import ShowcaseCase from '@/components/ShowcaseCase';
import ReportButton from '@/components/ReportButton';
import { useAuth } from '@/lib/auth';
import { getProfile, setFollow } from '@/lib/social';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

const ICONS = {
  followers:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.5 2.5-5.5 6-5.5s6 2 6 5.5M16 4.5a3 3 0 0 1 0 6M18 14c2 .5 3 2 3 4.5',
  following:
    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c0-4 3-6.5 7-6.5s7 2.5 7 6.5M16 9l1.5 1.5L21 7',
  sets: 'M4 5.5h6a2 2 0 0 1 2 2V19a2 2 0 0 0-2-2H4Zm16 0h-6a2 2 0 0 0-2 2V19a2 2 0 0 1 2-2h6Z',
  cards: 'M7 4h10v16H7ZM4 7h1v10H4Zm15 0h1v10h-1ZM10 8h4M10 11h4',
};

export default function ProfilePageView() {
  const { username } = useParams<{ username: string }>();
  const { loading, user } = useAuth();
  const [profile, setProfile] = useState<ProfilePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<OwnedCard | null>(null);

  useEffect(() => {
    if (loading) return;
    getProfile(username)
      .then(setProfile)
      .catch((e: Error) => setError(e.message));
  }, [username, loading]);

  async function toggleFollow() {
    if (!profile) return;
    const result = await setFollow(profile.username, !profile.is_following);
    setProfile({
      ...profile,
      is_following: result.following,
      follower_count: result.follower_count,
    });
  }

  if (error) return <p className={ui.error}>{error}</p>;
  if (!profile) return <p className={ui.muted}>Loading…</p>;

  const name = profile.display_name || profile.username;
  const joined = new Date(profile.created_at).getFullYear();
  const showcase = Array.from(
    { length: SHOWCASE_SLOTS },
    (_, i) => profile.showcase.find((s) => s.position === i) ?? null,
  );

  return (
    <section className={styles.root}>
      <div className={styles.header}>
        <div className={styles.idSleeve} aria-hidden="true">
          <div className={styles.idCard}>
            <span className={styles.idLabel}>Collector</span>
            <span className={styles.monogram}>{profile.username[0]?.toUpperCase()}</span>
            <span className={styles.idHandle}>@{profile.username}</span>
            <span className={styles.idSince}>Since {joined}</span>
          </div>
        </div>

        <div className={styles.identity}>
          <p className={ui.eyebrow}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c0-4 3-6.5 7-6.5s7 2.5 7 6.5" />
            </svg>
            Collector profile
          </p>
          <h1 className={ui.title}>{name}</h1>
          <p className={ui.subtitle}>@{profile.username}</p>
          {profile.bio ? <p className={ui.lead}>{profile.bio}</p> : null}
          <div className={styles.actions}>
            {profile.is_me ? (
              <Link href="/account" className={`${ui.btnOutline} ${ui.btnSmall}`}>
                Edit profile
              </Link>
            ) : user ? (
              <>
                <button
                  type="button"
                  className={`${profile.is_following ? ui.btnOutline : ui.btnPrimary} ${ui.btnSmall}`}
                  onClick={() => void toggleFollow()}
                >
                  {profile.is_following ? 'Following' : 'Follow'}
                </button>
                <Link
                  href={`/trades/new?with=${profile.username}`}
                  className={`${ui.btnQuiet} ${ui.btnSmall}`}
                >
                  Trade
                </Link>
                <ReportButton target={{ username: profile.username }} />
              </>
            ) : null}
          </div>
        </div>

        <div className={`${ui.panel} ${styles.statsPanel}`}>
          <ul className={ui.stats}>
            <li className={ui.stat}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={ICONS.followers} />
              </svg>
              <b>{profile.follower_count}</b>
              <span>Followers</span>
            </li>
            <li className={ui.stat}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={ICONS.following} />
              </svg>
              <b>{profile.following_count}</b>
              <span>Following</span>
            </li>
            <li className={ui.stat}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={ICONS.sets} />
              </svg>
              <b>{profile.set_count}</b>
              <span>Sets created</span>
            </li>
            <li className={ui.stat}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={ICONS.cards} />
              </svg>
              <b>{profile.card_count}</b>
              <span>Cards collected</span>
            </li>
          </ul>
        </div>
      </div>

      <div className={styles.section}>
        <ShowcaseCase
          slots={showcase}
          title={profile.showcase_title}
          mine={profile.is_me}
          onInspect={setInspect}
        />
      </div>

      <div className={styles.section} id="sets">
        <Sheet
          title={`Sets by @${profile.username}`}
          meta={profile.sets.length ? `${profile.sets.length} published` : undefined}
        >
          {profile.sets.length === 0 ? (
            <Empty icon="binder">
              {profile.is_me
                ? 'You have not published a set yet. Anything you collect can become one.'
                : `@${profile.username} has not published a set yet.`}
            </Empty>
          ) : (
            <ul className={coverStyles.shelf}>
              {profile.sets.map((s) => (
                <li key={s.id}>
                  <BinderCover set={s} meta={`${s.card_count} cards · ♥ ${s.like_count}`} />
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      </div>

      {inspect ? <OwnedCardInspector owned={inspect} onClose={() => setInspect(null)} /> : null}
    </section>
  );
}
