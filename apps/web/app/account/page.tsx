'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { CurrentUser, OwnedCard, ShowcaseSlot } from '@miscellary/shared';
import { SHOWCASE_SLOTS } from '@miscellary/shared';
import BinderColourPicker from '@/components/BinderColourPicker';
import CardPreview from '@/components/CardPreview';
import ProfileBinder from '@/components/ProfileBinder';
import { OwnedCardInspector } from '@/components/CardInspector';
import ui from '@/components/ui.module.css';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { listMyCards } from '@/lib/packs';
import { getShowcase, saveShowcase } from '@/lib/social';
import styles from './page.module.css';

export default function AccountPage() {
  const { user, loading, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [showcaseTitle, setShowcaseTitle] = useState('');
  const [binderColour, setBinderColour] = useState('teal');
  const [saved, setSaved] = useState(false);
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [inspect, setInspect] = useState<OwnedCard | null>(null);
  const [slots, setSlots] = useState<(string | null)[]>(Array(SHOWCASE_SLOTS).fill(null));
  // Use binder payload cards so pinned copies beyond page one stay resolvable.
  const [pinned, setPinned] = useState<Map<string, OwnedCard>>(new Map());
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.profile.display_name);
    setBio(user.profile.bio);
    setShowcaseTitle(user.profile.showcase_title);
    setBinderColour(user.profile.binder_colour || 'teal');
    Promise.all([listMyCards(), getShowcase()])
      .then(([page, showcase]) => {
        setCards(page.results);
        const next: (string | null)[] = Array(SHOWCASE_SLOTS).fill(null);
        const held = new Map<string, OwnedCard>();
        for (const s of showcase as ShowcaseSlot[]) {
          next[s.position] = s.owned_card.id;
          held.set(s.owned_card.id, s.owned_card);
        }
        setPinned(held);
        setSlots(next);
      })
      .catch((e: Error) => setError(e.message));
  }, [user]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    try {
      await apiFetch<CurrentUser>('/api/v1/auth/me/', {
        method: 'PATCH',
        body: {
          display_name: displayName,
          bio,
          showcase_title: showcaseTitle,
          binder_colour: binderColour,
        },
      });
      await refreshUser();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function persistSlots(next: (string | null)[]) {
    setSlots(next);
    setPicking(null);
    try {
      await saveShowcase(
        next.flatMap((id, position) => (id ? [{ position, owned_card_id: id }] : [])),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the binder.');
    }
  }

  async function pickCover(colour: string) {
    setBinderColour(colour);
    try {
      await apiFetch<CurrentUser>('/api/v1/auth/me/', {
        method: 'PATCH',
        body: { binder_colour: colour },
      });
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the cover.');
    }
  }

  if (loading) return <p className={styles.muted}>Loading…</p>;
  if (!user)
    return (
      <p className={styles.muted}>
        You need to <Link href="/login">log in</Link> to see your account.
      </p>
    );

  const byId = new Map([...pinned, ...cards.map((c) => [c.id, c] as const)]);

  return (
    <section>
      <p className={ui.eyebrow}>Account</p>
      <h1 className={ui.title}>@{user.profile.username}</h1>
      <p className={ui.subtitle}>Profile details and your binder</p>
      {error ? <p className={styles.error}>{error}</p> : null}

      <form className={`${ui.panel} ${styles.form}`} onSubmit={saveProfile}>
        <label className={ui.label} htmlFor="display">
          Display name
        </label>
        <input
          id="display"
          className={ui.input}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
        />
        <label className={ui.label} htmlFor="bio">
          Bio
        </label>
        <textarea
          id="bio"
          className={ui.input}
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
        />
        <label className={ui.label} htmlFor="case">
          Binder caption
        </label>
        <input
          id="case"
          className={ui.input}
          value={showcaseTitle}
          onChange={(e) => setShowcaseTitle(e.target.value)}
          maxLength={60}
          placeholder="The pride of the collection"
        />
        <div className={styles.row}>
          <button className={ui.btnPrimary} type="submit">
            Save profile
          </button>
          {saved ? <span className={styles.muted}>Saved.</span> : null}
          <span className={styles.muted}>
            {user.email}{' '}
            {user.email_verified ? '' : <span className={styles.badge}>unverified</span>}
          </span>
        </div>
      </form>

      <h2 className={styles.h2}>Your binder</h2>
      <p className={styles.muted}>
        A page of {SHOWCASE_SLOTS} sleeves at the top of your profile, for anyone who visits. Pin
        the cards you want shown; a card you trade away leaves its sleeve on its own.
      </p>
      <div className={styles.cover}>
        <span className={ui.label}>Cover</span>
        <BinderColourPicker value={binderColour} onChange={(c) => void pickCover(c)} />
      </div>
      <div className={styles.slotsWrap}>
        <ProfileBinder
          title={showcaseTitle}
          colour={binderColour}
          mine
          onInspect={setInspect}
          onPick={(i) => setPicking(picking === i ? null : i)}
          slots={slots.map((id, position) => {
            const owned = id ? byId.get(id) : undefined;
            return owned ? { position, owned_card: owned } : null;
          })}
        />
      </div>

      {picking !== null ? (
        <div className={`${ui.panel} ${styles.picker}`}>
          <div className={styles.row}>
            <strong>Pick a card for sleeve {picking + 1}</strong>
            {slots[picking] ? (
              <button
                type="button"
                className={styles.link}
                onClick={() => void persistSlots(slots.map((s, i) => (i === picking ? null : s)))}
              >
                Empty this sleeve
              </button>
            ) : null}
          </div>
          <div className={styles.grid}>
            {cards
              .filter((c) => !slots.includes(c.id))
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={styles.pick}
                  onClick={() => void persistSlots(slots.map((s, i) => (i === picking ? c.id : s)))}
                >
                  <CardPreview
                    size="small"
                    title={c.card.title}
                    rarity={c.card.rarity}
                    description=""
                    imageUrl={c.card.image.url}
                    templateKey={c.card.template_key}
                    templateConfig={c.card.template_config}
                  />
                </button>
              ))}
          </div>
        </div>
      ) : null}

      {inspect ? <OwnedCardInspector owned={inspect} onClose={() => setInspect(null)} /> : null}
    </section>
  );
}
