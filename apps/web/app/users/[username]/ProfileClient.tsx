'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { OwnedCard, ProfilePage } from '@miscellary/shared';
import { profilePath, SHOWCASE_SLOTS } from '@miscellary/shared';
import SectionHeader from '@/components/SectionHeader';
import SetTile from '@/components/SetTile';
import tileStyles from '@/components/SetTile.module.css';
import { OwnedCardInspector } from '@/components/CardInspector';
import PeopleList from '@/components/PeopleList';
import ProfileBinder from '@/components/ProfileBinder';
import MoreMenu from '@/components/MoreMenu';
import ReportDialog from '@/components/ReportDialog';
import ShareButton from '@/components/ShareButton';
import DemoBadge from '@/components/DemoBadge';
import { useAuth } from '@/lib/auth';
import { loginHref } from '@/lib/returnTo';
import { useContinuation } from '@/lib/useContinuation';
import { getProfile, setFollow } from '@/lib/social';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

const FOLLOW_ACTION = 'follow';

const ICONS = {
  followers:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.5 2.5-5.5 6-5.5s6 2 6 5.5M16 4.5a3 3 0 0 1 0 6M18 14c2 .5 3 2 3 4.5',
  following:
    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c0-4 3-6.5 7-6.5s7 2.5 7 6.5M16 9l1.5 1.5L21 7',
  sets: 'M4 5.5h6a2 2 0 0 1 2 2V19a2 2 0 0 0-2-2H4Zm16 0h-6a2 2 0 0 0-2 2V19a2 2 0 0 1 2-2h6Z',
  cards: 'M7 4h10v16H7ZM4 7h1v10H4Zm15 0h1v10h-1ZM10 8h4M10 11h4',
};

export default function ProfileClient({
  username,
  initialProfile,
}: {
  username: string;
  initialProfile: ProfilePage;
}) {
  const pathname = usePathname();
  const { loading, user } = useAuth();
  const [profile, setProfile] = useState<ProfilePage | null>(initialProfile);
  const [error, setError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<OwnedCard | null>(null);
  const [people, setPeople] = useState<'followers' | 'following' | null>(null);
  const [reporting, setReporting] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    getProfile(username)
      .then(setProfile)
      .catch((e: Error) => setError(e.message));
  }, [username, loading, user]);

  const toggleFollow = useCallback(async () => {
    if (!profile || followBusy) return;
    const next = !profile.is_following;
    setFollowBusy(true);
    setFollowError(null);
    setProfile((current) =>
      current
        ? {
            ...current,
            is_following: next,
            follower_count: current.follower_count + (next ? 1 : -1),
          }
        : current,
    );
    try {
      const result = await setFollow(profile.username, next);
      setProfile((current) =>
        current
          ? { ...current, is_following: result.following, follower_count: result.follower_count }
          : current,
      );
    } catch (e) {
      setProfile((current) =>
        current
          ? {
              ...current,
              is_following: !next,
              follower_count: current.follower_count + (next ? -1 : 1),
            }
          : current,
      );
      setFollowError(e instanceof Error ? e.message : 'Could not update follow.');
    } finally {
      setFollowBusy(false);
    }
  }, [profile, followBusy]);

  useContinuation(
    FOLLOW_ACTION,
    () => void toggleFollow(),
    Boolean(user && profile && !profile.is_me && !profile.is_following),
  );

  if (error) return <p className={ui.error}>{error}</p>;
  if (!profile) return <p className={ui.muted}>Loading…</p>;

  const name = profile.display_name || profile.username;
  const joined = new Date(profile.created_at).getFullYear();
  const binder = Array.from(
    { length: SHOWCASE_SLOTS },
    (_, i) => profile.showcase.find((s) => s.position === i + 1) ?? null,
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
          <h1 className={ui.title}>{name}</h1>
          {profile.is_demo ? <DemoBadge /> : null}
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
                  disabled={followBusy}
                  onClick={() => void toggleFollow()}
                >
                  {profile.is_following ? 'Following' : 'Follow'}
                </button>
                {followError ? <span className={ui.error}>{followError}</span> : null}
                <Link
                  href={`/trades/new?with=${profile.username}`}
                  className={`${ui.btnOutline} ${ui.btnSmall}`}
                >
                  Offer a trade
                </Link>
              </>
            ) : (
              <Link
                href={loginHref(pathname, FOLLOW_ACTION)}
                className={`${ui.btnPrimary} ${ui.btnSmall}`}
              >
                Follow
              </Link>
            )}
            <ShareButton path={profilePath(profile.username)} title={`${name} on Miscellary`} />
            {user && !profile.is_me ? (
              <MoreMenu
                label={`More for @${profile.username}`}
                items={[
                  {
                    label: 'Report this collector',
                    onSelect: () => setReporting(true),
                    danger: true,
                  },
                ]}
              />
            ) : null}
            {reporting ? (
              <ReportDialog
                target={{ username: profile.username }}
                subject={`@${profile.username}`}
                onClose={() => setReporting(false)}
              />
            ) : null}
          </div>
        </div>

        <div className={`${ui.panel} ${styles.statsPanel}`}>
          <ul className={ui.stats}>
            <li>
              <button
                type="button"
                className={`${ui.stat} ${styles.statButton}`}
                aria-expanded={people === 'followers'}
                onClick={() => setPeople(people === 'followers' ? null : 'followers')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={ICONS.followers} />
                </svg>
                <b>{profile.follower_count}</b>
                <span>Followers</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`${ui.stat} ${styles.statButton}`}
                aria-expanded={people === 'following'}
                onClick={() => setPeople(people === 'following' ? null : 'following')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={ICONS.following} />
                </svg>
                <b>{profile.following_count}</b>
                <span>Following</span>
              </button>
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

      {people ? (
        <div className={styles.section}>
          <PeopleList
            username={profile.username}
            direction={people}
            onClose={() => setPeople(null)}
          />
        </div>
      ) : null}

      <div className={styles.section}>
        <ProfileBinder
          slots={binder}
          title={profile.showcase_title}
          colour={profile.binder_colour}
          mine={profile.is_me}
          onInspect={setInspect}
          open={false}
        />
      </div>

      <div className={styles.section} id="sets">
        <SectionHeader
          title={profile.is_me ? 'Your sets' : `Sets by ${name}`}
          note={
            profile.sets.length
              ? `${profile.sets.length} published`
              : profile.is_me
                ? 'You have not published a set yet. Anything you collect can become one.'
                : `${name} has not published a set yet.`
          }
          link={profile.is_me ? { href: '/studio', label: 'Open the studio' } : undefined}
        />
        {profile.sets.length ? (
          <ul className={tileStyles.grid}>
            {profile.sets.map((s) => (
              <li key={s.id}>
                <SetTile set={s} meta={`${s.card_count} cards · ♥ ${s.like_count}`} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {inspect ? <OwnedCardInspector owned={inspect} onClose={() => setInspect(null)} /> : null}
    </section>
  );
}
