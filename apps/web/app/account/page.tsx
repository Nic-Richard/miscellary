'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { OwnedCard, ShowcaseSlot } from '@miscellary/shared';
import { cardCode, SHOWCASE_SLOTS } from '@miscellary/shared';
import PageHeader from '@/components/PageHeader';
import AccountSecurity from '@/components/AccountSecurity';
import BinderColourPicker from '@/components/BinderColourPicker';
import SearchField from '@/components/SearchField';
import CardPreview from '@/components/CardPreview';
import ProfileBinder from '@/components/ProfileBinder';
import { OwnedCardInspector } from '@/components/CardInspector';
import ui from '@/components/ui.module.css';
import { updateProfile } from '@/lib/account';
import { useAuth } from '@/lib/auth';
import { useRequireAccount } from '@/lib/requireAccount';
import { listAllMyCards } from '@/lib/packs';
import { getShowcase, saveShowcase } from '@/lib/social';
import styles from './page.module.css';

type Section = 'profile' | 'binder' | 'account';

const SECTION_LABELS = { profile: 'Profile', binder: 'Binder', account: 'Sign-in' } as const;

export default function AccountPage() {
  const { user, loading, refreshUser } = useAuth();
  useRequireAccount();
  const [section, setSection] = useState<Section>('profile');
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
  const [pickFilter, setPickFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const binderRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.profile.display_name);
    setBio(user.profile.bio);
    setShowcaseTitle(user.profile.showcase_title);
    setBinderColour(user.profile.binder_colour || 'teal');
  }, [user]);

  useEffect(() => {
    if (!user) return;
    Promise.all([listAllMyCards(), getShowcase()])
      .then(([owned, showcase]) => {
        setCards(owned);
        const next: (string | null)[] = Array(SHOWCASE_SLOTS).fill(null);
        const held = new Map<string, OwnedCard>();
        for (const s of showcase as ShowcaseSlot[]) {
          next[s.position - 1] = s.owned_card.id;
          held.set(s.owned_card.id, s.owned_card);
        }
        setPinned(held);
        setSlots(next);
      })
      .catch((e: Error) => setError(e.message));
  }, [user]);

  useEffect(() => {
    if (picking === null) return;
    const frame = requestAnimationFrame(() => {
      pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [picking]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateProfile({
        display_name: displayName,
        bio,
        showcase_title: showcaseTitle,
        binder_colour: binderColour,
      });
      await refreshUser();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function persistSlots(next: (string | null)[], returnToBinder = false) {
    setSlots(next);
    setPicking(null);
    if (returnToBinder) {
      requestAnimationFrame(() => {
        binderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
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
      await updateProfile({ binder_colour: colour });
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the cover.');
    }
  }

  if (loading) return <p className={styles.muted}>Loading…</p>;
  if (!user) return <p className={styles.muted}>Taking you to create an account…</p>;

  const byId = new Map([...pinned, ...cards.map((c) => [c.id, c] as const)]);

  const pickNeedle = pickFilter.trim().toLowerCase();
  const choosable = cards
    .filter((c) => !slots.includes(c.id))
    .filter(
      (c) =>
        !pickNeedle ||
        c.card.title.toLowerCase().includes(pickNeedle) ||
        c.set_title.toLowerCase().includes(pickNeedle),
    );

  return (
    <section className={`${styles.page} ${section === 'binder' ? styles.pageBinder : ''}`}>
      <PageHeader
        title="Account"
        description="Your profile, your binder and how you sign in"
        actions={
          <Link className={ui.link} href={`/users/${user.profile.username}`}>
            View your profile
          </Link>
        }
      />
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.tabs}>
        <div className={ui.segments} role="tablist" aria-label="Account sections">
          {(['profile', 'binder', 'account'] as const).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={section === name}
              className={`${ui.segment} ${section === name ? ui.segmentOn : ''}`}
              onClick={() => setSection(name)}
            >
              {SECTION_LABELS[name]}
            </button>
          ))}
        </div>
      </div>

      {section === 'profile' ? (
        <form className={`${ui.panel} ${styles.form}`} onSubmit={(e) => void saveProfile(e)}>
          <label className={ui.label} htmlFor="display">
            Display name
          </label>
          <input
            id="display"
            className={ui.input}
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setSaved(false);
            }}
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
            onChange={(e) => {
              setBio(e.target.value);
              setSaved(false);
            }}
            maxLength={280}
          />
          <label className={ui.label} htmlFor="case">
            Binder caption
          </label>
          <input
            id="case"
            className={ui.input}
            value={showcaseTitle}
            onChange={(e) => {
              setShowcaseTitle(e.target.value);
              setSaved(false);
            }}
            maxLength={60}
            placeholder="The pride of the collection"
          />
          <div className={styles.row}>
            <button className={ui.btnPrimary} type="submit">
              Save profile
            </button>
            {saved ? <span className={styles.saved}>Saved</span> : null}
          </div>
        </form>
      ) : null}

      {section === 'binder' ? (
        <>
          <h2 className={styles.h2}>Your binder</h2>
          <p className={styles.muted}>
            Ten pages with {SHOWCASE_SLOTS} sleeves at the top of your profile, for anyone who
            visits. Pin the cards you want shown; a card you trade away leaves its sleeve on its
            own.
          </p>
          <div className={styles.cover}>
            <span className={ui.label}>Cover</span>
            <BinderColourPicker value={binderColour} onChange={(c) => void pickCover(c)} />
          </div>
          <div ref={binderRef} className={styles.slotsWrap}>
            <ProfileBinder
              title={showcaseTitle}
              colour={binderColour}
              mine
              onInspect={setInspect}
              onPick={(i) => setPicking(picking === i ? null : i)}
              onRemove={(position) =>
                void persistSlots(slots.map((slot, index) => (index === position ? null : slot)))
              }
              slots={slots.map((id, position) => {
                const owned = id ? byId.get(id) : undefined;
                return owned ? { position: position + 1, owned_card: owned } : null;
              })}
            />
          </div>

          {picking !== null ? (
            <div ref={pickerRef} className={`${ui.panel} ${styles.picker}`}>
              <div className={styles.row}>
                <strong>Pick a card for sleeve {picking + 1}</strong>
                {slots[picking] ? (
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() =>
                      void persistSlots(slots.map((s, i) => (i === picking ? null : s)))
                    }
                  >
                    Empty this sleeve
                  </button>
                ) : null}
              </div>
              <SearchField
                className={styles.find}
                value={pickFilter}
                onChange={setPickFilter}
                placeholder="Filter by card or set"
                label="Filter your cards by card or set"
              />
              <div className={styles.grid}>
                {choosable.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.pick}
                    onClick={() =>
                      void persistSlots(
                        slots.map((s, i) => (i === picking ? c.id : s)),
                        true,
                      )
                    }
                  >
                    <CardPreview
                      size="small"
                      title={c.card.title}
                      rarity={c.card.rarity}
                      code={cardCode(c.card.printed_set_code, c.card.position, c.card.set_total)}
                      printedText={c.card.printed_text}
                      imageUrl={c.card.image.url}
                      templateKey={c.card.template_key}
                      templateConfig={c.card.template_config}
                      render={c.card.render}
                    />
                  </button>
                ))}
              </div>
              {choosable.length === 0 ? (
                <p className={ui.muted}>
                  {pickFilter.trim()
                    ? `None of your cards match “${pickFilter}”.`
                    : 'Every card you hold is already pinned.'}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {section === 'account' ? <AccountSecurity user={user} onChanged={refreshUser} /> : null}

      {inspect ? <OwnedCardInspector owned={inspect} onClose={() => setInspect(null)} /> : null}
    </section>
  );
}
