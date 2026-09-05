'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import type { OwnedCard } from '@miscellary/shared';
import CardPreview from '@/components/CardPreview';
import Sheet, { Empty } from '@/components/Sheet';
import { useAuth } from '@/lib/auth';
import { listMyCards } from '@/lib/packs';
import { counterOffer, createOffer, getOffer, listUserCards } from '@/lib/trades';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

interface Stack {
  key: string;
  title: string;
  setTitle: string;
  copies: OwnedCard[];
}

function stacksOf(cards: OwnedCard[]): Stack[] {
  const by = new Map<string, Stack>();
  for (const owned of cards) {
    const found = by.get(owned.card.id);
    if (found) found.copies.push(owned);
    else
      by.set(owned.card.id, {
        key: owned.card.id,
        title: owned.card.title,
        setTitle: owned.set_title,
        copies: [owned],
      });
  }
  // A held copy cannot be offered, so the ones that can go first.
  for (const stack of by.values()) stack.copies.sort((a, b) => Number(a.held) - Number(b.held));
  return [...by.values()];
}

function bySet(stacks: Stack[]): { setTitle: string; stacks: Stack[] }[] {
  const groups = new Map<string, Stack[]>();
  for (const stack of stacks) {
    const list = groups.get(stack.setTitle);
    if (list) list.push(stack);
    else groups.set(stack.setTitle, [stack]);
  }
  return [...groups].map(([setTitle, list]) => ({ setTitle, stacks: list }));
}

function Side({
  title,
  meta,
  cards,
  selected,
  onPick,
  emptyText,
}: {
  title: string;
  meta: string;
  cards: OwnedCard[];
  selected: Set<string>;
  onPick: (stack: Stack) => void;
  emptyText: string;
}) {
  const [filter, setFilter] = useState('');
  const stacks = useMemo(() => stacksOf(cards), [cards]);
  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? stacks.filter(
        (s) => s.title.toLowerCase().includes(needle) || s.setTitle.toLowerCase().includes(needle),
      )
    : stacks;
  const chosen = cards.filter((c) => selected.has(c.id)).length;

  return (
    <Sheet
      title={title}
      meta={`${meta}${chosen ? ` · ${chosen} picked` : ''}`}
      actions={
        stacks.length > 4 ? (
          <input
            className={`${ui.input} ${styles.filter}`}
            placeholder="Filter by card or set"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        ) : null
      }
    >
      {stacks.length === 0 ? (
        <Empty icon="cards">{emptyText}</Empty>
      ) : shown.length === 0 ? (
        <Empty icon="search">Nothing here matches &ldquo;{filter}&rdquo;.</Empty>
      ) : (
        bySet(shown).map((group) => (
          <div key={group.setTitle} className={styles.group}>
            <h3 className={styles.groupName}>{group.setTitle}</h3>
            <ul className={styles.grid}>
              {group.stacks.map((stack) => {
                const picked = stack.copies.filter((c) => selected.has(c.id)).length;
                const free = stack.copies.filter((c) => !c.held).length;
                const first = stack.copies[0]!;
                return (
                  <li key={stack.key}>
                    <button
                      type="button"
                      className={`${styles.pick} ${picked ? styles.picked : ''}`}
                      disabled={free === 0}
                      aria-pressed={picked > 0}
                      title={
                        free === 0
                          ? 'Every copy is in a pending trade'
                          : stack.copies.length > 1
                            ? 'Click to add a copy, click again past the last to clear'
                            : undefined
                      }
                      onClick={() => onPick(stack)}
                    >
                      <CardPreview
                        size="small"
                        title={stack.title}
                        rarity={first.card.rarity}
                        description=""
                        imageUrl={first.card.image.url}
                        templateKey={first.card.template_key}
                        templateConfig={first.card.template_config}
                        mark={first.set_mark}
                      />
                      {stack.copies.length > 1 ? (
                        <span className={styles.copies}>&times;{stack.copies.length}</span>
                      ) : null}
                      {picked ? (
                        <span className={styles.badge}>
                          {stack.copies.length > 1 ? picked : '✓'}
                        </span>
                      ) : null}
                      {free === 0 ? <span className={styles.held}>held</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </Sheet>
  );
}

function DealSide({ label, cards }: { label: string; cards: OwnedCard[] }) {
  return (
    <div className={styles.dealSide}>
      <span className={styles.dealLabel}>
        {label} <b>{cards.length}</b>
      </span>
      <div className={styles.dealCards}>
        {cards.length === 0 ? (
          <span className={styles.dealNone}>Nothing yet</span>
        ) : (
          cards.map((c) => (
            <span key={c.id} className={styles.dealCard} title={c.card.title}>
              <img src={c.card.image.url} alt={c.card.title} />
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function NewTrade() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const counterId = params.get('counter');
  const [partner, setPartner] = useState(params.get('with') ?? '');
  const [theirs, setTheirs] = useState<OwnedCard[]>([]);
  const [mine, setMine] = useState<OwnedCard[]>([]);
  const [want, setWant] = useState<Set<string>>(new Set());
  const [give, setGive] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        let who = params.get('with') ?? '';
        if (counterId) {
          // Countering: start from the original offer, sides flipped.
          const original = await getOffer(counterId);
          who = original.sender.username;
          setPartner(who);
          setGive(new Set(original.want.map((c) => c.id)));
          setWant(new Set(original.give.map((c) => c.id)));
        }
        if (!who) return;
        const [t, m] = await Promise.all([listUserCards(who), listMyCards()]);
        setTheirs(t.results);
        setMine(m.results);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load cards.');
      } finally {
        setReady(true);
      }
    })();
  }, [user, counterId, params]);

  // Selecting past the final available copy resets the stack.
  function pick(selected: Set<string>, setter: (s: Set<string>) => void, stack: Stack) {
    const next = new Set(selected);
    const free = stack.copies.filter((c) => !c.held);
    const unpicked = free.find((c) => !next.has(c.id));
    if (unpicked) next.add(unpicked.id);
    else for (const copy of stack.copies) next.delete(copy.id);
    setter(next);
  }

  const wanted = theirs.filter((c) => want.has(c.id));
  const given = mine.filter((c) => give.has(c.id));

  async function send() {
    setBusy(true);
    setError(null);
    const body = { recipient: partner, give: [...give], want: [...want], message };
    try {
      if (counterId) await counterOffer(counterId, body);
      else await createOffer(body);
      router.push('/trades');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the offer.');
      setBusy(false);
    }
  }

  if (loading) return <p className={ui.muted}>Loading…</p>;
  if (!user) return <p className={ui.muted}>Log in to trade.</p>;

  return (
    <section className={styles.root}>
      <Link href="/trades" className={styles.back}>
        ← Trade offers
      </Link>
      <p className={ui.eyebrow}>{counterId ? 'Counter offer' : 'New offer'}</p>
      <h1 className={ui.title}>Trade with @{partner}</h1>
      <p className={ui.subtitle}>Pick from either side, then send</p>
      {error ? <p className={ui.error}>{error}</p> : null}

      <div className={styles.columns}>
        <Side
          title="You get"
          meta={`@${partner}`}
          cards={theirs}
          selected={want}
          onPick={(s) => pick(want, setWant, s)}
          emptyText={ready ? `@${partner} has no cards to trade yet.` : 'Loading their cards…'}
        />
        <Side
          title="You give"
          meta="Your cards"
          cards={mine}
          selected={give}
          onPick={(s) => pick(give, setGive, s)}
          emptyText={
            ready
              ? 'You have no cards yet. Open a pack to start collecting.'
              : 'Loading your cards…'
          }
        />
      </div>

      <div className={styles.deal}>
        <div className={styles.dealSides}>
          <DealSide label="You get" cards={wanted} />
          <span className={styles.swap} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 9h14l-4-4M20 15H6l4 4" />
            </svg>
          </span>
          <DealSide label="You give" cards={given} />
        </div>
        <div className={styles.dealSend}>
          <input
            className={ui.input}
            placeholder="Message (optional)"
            maxLength={200}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            className={ui.btnPrimary}
            type="button"
            disabled={busy || (want.size === 0 && give.size === 0)}
            onClick={() => void send()}
          >
            {busy ? 'Sending…' : counterId ? 'Send counter' : 'Send offer'}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function NewTradePage() {
  return (
    <Suspense fallback={null}>
      <NewTrade />
    </Suspense>
  );
}
