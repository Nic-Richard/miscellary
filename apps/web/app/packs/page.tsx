'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { cardCode, personHandle, personName } from '@miscellary/shared';
import type { CardSetSummary, PackEntry, PackOpening } from '@miscellary/shared';
import PageHeader from '@/components/PageHeader';
import PersonLink from '@/components/PersonLink';
import CardBack from '@/components/CardBack';
import CardPreview from '@/components/CardPreview';
import DemoBadge from '@/components/DemoBadge';
import PackReveal from '@/components/PackReveal';
import PackStage from '@/components/PackStage';
import SearchField from '@/components/SearchField';
import StartShelf from '@/components/StartShelf';
import Sheet, { Empty } from '@/components/Sheet';
import TagList from '@/components/TagList';
import { useAuth } from '@/lib/auth';
import { useRequireAccount } from '@/lib/requireAccount';
import { listPublicSets } from '@/lib/sets';
import { openPack } from '@/lib/packs';
import { followSet, getMyPacks } from '@/lib/social';
import { countdown } from '@/lib/time';
import ui from '@/components/ui.module.css';
import wide from '@/components/pageWide.module.css';
import styles from './page.module.css';

const SUGGESTIONS = 3;
const SHELF_SIZE = 8;

const STAT_ICONS = {
  opened: 'M6 3h12l-1 18H7ZM8 8h8M9 17h6',
  followers: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c0-4 3-6.5 7-6.5s7 2.5 7 6.5',
  likes:
    'M12 20.4 4.2 12.8a4.6 4.6 0 0 1 0-6.6 4.6 4.6 0 0 1 6.5 0l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.6Z',
};

function Stat({
  name,
  value,
  label,
}: {
  name: keyof typeof STAT_ICONS;
  value: number;
  label: string;
}) {
  return (
    <span className={styles.stat}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={STAT_ICONS[name]} />
      </svg>
      <b>{value.toLocaleString()}</b>
      {label}
    </span>
  );
}

function Sleeves({ owned, total }: { owned: number; total: number }) {
  const done = total > 0 && owned >= total;
  return (
    <div className={styles.progress}>
      <span
        className={`${styles.track} ${done ? styles.trackDone : ''}`}
        style={{ '--slots': Math.max(total, 1) } as CSSProperties}
      >
        <span
          className={styles.fill}
          style={{ width: `${total ? Math.min(100, (owned / total) * 100) : 0}%` }}
        />
      </span>
      <span className={styles.count}>
        {done ? (
          <em>Complete</em>
        ) : (
          <>
            <b>{owned}</b>/{total}
          </>
        )}
      </span>
    </div>
  );
}

function Post({
  entry,
  now,
  onUnfollow,
  onOpen,
  busy,
}: {
  entry: PackEntry;
  now: number;
  onUnfollow: () => void;
  onOpen: (usePoints: boolean) => void;
  busy: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const set = entry.card_set;
  const creator = personName(set.creator);
  const affordable = entry.points >= entry.pack_cost;

  useEffect(() => {
    if (!menu) return;
    function away(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false);
    }
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [menu]);

  return (
    <article id={`post-${set.slug}`} className={styles.post}>
      <header className={styles.byline}>
        <PersonLink person={set.creator} className={styles.bylineLink}>
          <span className={styles.monogram}>{creator[0]?.toUpperCase()}</span>
          <span className={styles.bylineName}>
            <strong>
              {creator}
              {set.creator.is_demo ? <DemoBadge compact /> : null}
            </strong>
            {set.creator.deleted ? null : <small>@{set.creator.username}</small>}
          </span>
        </PersonLink>
        <div className={styles.more} ref={menuRef}>
          <button
            type="button"
            className={styles.moreBtn}
            aria-label={`More for ${set.title}`}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.4" />
              <circle cx="12" cy="12" r="1.4" />
              <circle cx="12" cy="19" r="1.4" />
            </svg>
          </button>
          {menu ? (
            <div className={styles.menu}>
              <Link href={`/sets/${set.slug}`}>Open the binder</Link>
              <Link href={`/collection?set=${set.slug}`}>Your cards from it</Link>
              <button type="button" onClick={onUnfollow}>
                Stop following
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className={styles.body}>
        {entry.free_available ? (
          <button
            type="button"
            className={styles.pack}
            disabled={busy}
            aria-label={`Open a ${set.title} pack`}
            onClick={() => onOpen(false)}
          >
            <PackStage set={set} />
            <span className={styles.seal}>Free</span>
          </button>
        ) : (
          <Link href={`/sets/${set.slug}`} className={styles.pack} aria-label={set.title}>
            <PackStage set={set} />
          </Link>
        )}

        <div className={styles.detail}>
          <h2 className={styles.name}>
            <Link href={`/sets/${set.slug}`}>{set.title}</Link>
          </h2>
          <p className={styles.sub}>
            {set.card_count} cards · {set.pack_size} a pack
          </p>
          {set.tags.length ? (
            <TagList tags={set.tags.slice(0, 4)} size="small" label={`Tags on ${set.title}`} />
          ) : null}

          <Sleeves owned={entry.owned_count} total={entry.card_count} />

          <div className={styles.stats}>
            <Stat name="opened" value={set.opening_count} label="opened" />
            <Stat name="followers" value={set.follower_count} label="following" />
            <Stat name="likes" value={set.like_count} label="likes" />
          </div>

          <div className={styles.act}>
            {entry.free_available ? (
              <button
                type="button"
                className={ui.btnPrimary}
                disabled={busy}
                onClick={() => onOpen(false)}
              >
                Open today&rsquo;s pack
              </button>
            ) : affordable ? (
              <button
                type="button"
                className={`${ui.action} ${styles.spend}`}
                disabled={busy}
                onClick={() => onOpen(true)}
              >
                Spend {entry.pack_cost} points
              </button>
            ) : (
              <span className={styles.waiting}>
                <time dateTime={entry.resets_at}>{countdown(entry.resets_at, now)}</time>
                <small>until the next free pack</small>
              </span>
            )}
            <span className={styles.points}>
              {entry.points > 0 ? (
                affordable ? (
                  <b>{entry.points} pts saved</b>
                ) : (
                  <b>
                    {entry.points}/{entry.pack_cost} pts
                  </b>
                )
              ) : null}
              {entry.duplicate_count > 0 ? (
                <Link href={`/collection?set=${set.slug}`}>
                  {entry.duplicate_count} spare{entry.duplicate_count === 1 ? '' : 's'} to recycle
                </Link>
              ) : null}
            </span>
          </div>
        </div>
      </div>

      {entry.recent_cards.length ? (
        <footer className={styles.pulls}>
          <span className={styles.pullsLabel}>Your latest from this set</span>
          <ul className={styles.pullsRow}>
            {entry.recent_cards.map((card) => (
              <li key={card.id}>
                <Link href={`/collection?set=${set.slug}`} title={card.title}>
                  <CardPreview
                    size="small"
                    title={card.title}
                    rarity={card.rarity}
                    code={cardCode(card.printed_set_code, card.position, card.set_total)}
                    printedText={card.printed_text}
                    imageUrl={card.image.url}
                    templateKey={card.template_key}
                    templateConfig={card.template_config}
                    mark={set.mark}
                    render={card.render}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </footer>
      ) : (
        <footer className={styles.pulls}>
          <span className={styles.pullsLabel}>
            {entry.free_available
              ? 'Nothing from this set yet — today’s pack is waiting'
              : 'Nothing from this set yet'}
          </span>
          <ul className={`${styles.pullsRow} ${styles.facedown}`} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <CardBack
                  mark={set.mark}
                  packColour={set.pack_colour}
                  title={set.title}
                  {...(set.render_back?.image?.url ? { imageUrl: set.render_back.image.url } : {})}
                />
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  );
}

export default function PacksPage() {
  const { user, loading } = useAuth();
  useRequireAccount();
  const [entries, setEntries] = useState<PackEntry[] | null>(null);
  const [freeCount, setFreeCount] = useState(0);
  const [suggested, setSuggested] = useState<CardSetSummary[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<PackOpening | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(() => {
    getMyPacks()
      .then((page) => {
        setEntries(page.results);
        setFreeCount(page.free_count);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  useEffect(() => {
    if (!entries?.some((e) => !e.free_available)) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [entries]);

  useEffect(() => {
    if (!entries) return;
    const followed = new Set(entries.map((e) => e.card_set.slug));
    listPublicSets('popular')
      .then((page) => setSuggested(page.results.filter((s) => !followed.has(s.slug))))
      .catch(() => setSuggested([]));
  }, [entries]);

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!entries || !needle) return entries;
    return entries.filter(
      (e) =>
        e.card_set.title.toLowerCase().includes(needle) ||
        e.card_set.creator.username.toLowerCase().includes(needle),
    );
  }, [entries, filter]);

  const earned = useMemo(
    () => (entries ?? []).filter((e) => e.points > 0).sort((a, b) => b.points - a.points),
    [entries],
  );

  const totals = useMemo(() => {
    const rows = entries ?? [];
    return {
      owned: rows.reduce((n, e) => n + e.owned_count, 0),
      cards: rows.reduce((n, e) => n + e.card_count, 0),
      spares: rows.reduce((n, e) => n + e.duplicate_count, 0),
      complete: rows.filter((e) => e.card_count > 0 && e.owned_count >= e.card_count).length,
    };
  }, [entries]);

  async function open(slug: string, usePoints: boolean) {
    setBusy(true);
    setError(null);
    try {
      setOpening(await openPack(slug, usePoints));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that pack.');
    } finally {
      setBusy(false);
    }
  }

  async function unfollow(slug: string) {
    setEntries((current) => current?.filter((e) => e.card_set.slug !== slug) ?? null);
    try {
      await followSet(slug, false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop following that set.');
      reload();
    }
  }

  if (loading || !user) return <p className={ui.muted}>Loading…</p>;

  return (
    <div className={wide.page}>
      <span className={wide.lamp} aria-hidden="true" />

      <PageHeader
        title="Packs"
        description={
          entries === null
            ? 'The sets you follow'
            : freeCount > 0
              ? `${freeCount} free ${freeCount === 1 ? 'pack' : 'packs'} waiting`
              : `${entries.length} ${entries.length === 1 ? 'set' : 'sets'} followed`
        }
        actions={
          entries && entries.length > 1 ? (
            <SearchField
              className={styles.find}
              value={filter}
              onChange={setFilter}
              placeholder="Filter by set or creator"
              label="Filter the sets you follow"
            />
          ) : null
        }
      />
      {error ? <p className={ui.error}>{error}</p> : null}

      <div className={wide.layout}>
        <aside className={wide.jump} aria-label="Jump to a pack">
          {(shown ?? []).map((entry) => (
            <a
              key={entry.card_set.id}
              href={`#post-${entry.card_set.slug}`}
              className={`${wide.jumpPack} ${entry.free_available ? wide.jumpReady : ''}`}
              title={entry.card_set.title}
            >
              <PackStage set={entry.card_set} />
            </a>
          ))}
        </aside>

        <main className={styles.feed}>
          {entries === null ? (
            <Sheet>
              <Empty icon="binder">Loading…</Empty>
            </Sheet>
          ) : shown && shown.length === 0 && entries.length > 0 ? (
            <Sheet>
              <Empty
                icon="search"
                action={
                  <button type="button" className={ui.btnOutline} onClick={() => setFilter('')}>
                    Show every set
                  </button>
                }
              >
                None of the sets you follow match &ldquo;{filter}&rdquo;.
              </Empty>
            </Sheet>
          ) : entries.length === 0 && suggested.length ? (
            <Sheet title="Choose your first sets">
              <StartShelf sets={suggested.slice(0, SHELF_SIZE)} onDone={reload} />
            </Sheet>
          ) : entries.length === 0 ? (
            <Sheet>
              <Empty
                icon="binder"
                action={
                  <Link className={ui.btnPrimary} href="/sets">
                    Browse sets
                  </Link>
                }
              >
                Follow a set and it waits here: its free pack each day, the points you have saved
                towards another, and how much of it you have collected.
              </Empty>
            </Sheet>
          ) : (
            (shown ?? []).map((entry) => (
              <Post
                key={entry.card_set.id}
                entry={entry}
                now={now}
                busy={busy}
                onOpen={(usePoints) => void open(entry.card_set.slug, usePoints)}
                onUnfollow={() => void unfollow(entry.card_set.slug)}
              />
            ))
          )}
        </main>

        <aside className={wide.rail}>
          <section className={`${ui.panel} ${wide.railPanel}`}>
            <h2 className={ui.panelTitle}>Free packs</h2>
            <p className={styles.tally}>
              <b>{freeCount}</b>
              <span>
                {freeCount === 1 ? 'pack is' : 'packs are'} waiting across {entries?.length ?? 0}{' '}
                followed {entries?.length === 1 ? 'set' : 'sets'}
              </span>
            </p>
            <p className={wide.railNote}>
              One free pack from every set you follow, every day. They all return at midnight UTC.
            </p>
          </section>

          {earned.length ? (
            <section className={`${ui.panel} ${wide.railPanel}`}>
              <h2 className={ui.panelTitle}>Set points</h2>
              <ul className={wide.pointsList}>
                {earned.map((entry) => (
                  <li key={entry.card_set.id}>
                    <Link href={`#post-${entry.card_set.slug}`}>{entry.card_set.title}</Link>
                    <span className={entry.points >= entry.pack_cost ? styles.rich : undefined}>
                      {entry.points}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={wide.railNote}>
                Recycle a duplicate to earn points towards another pack from the same set.
              </p>
            </section>
          ) : null}

          {entries?.length ? (
            <section className={`${ui.panel} ${wide.railPanel}`}>
              <h2 className={ui.panelTitle}>Across these sets</h2>
              <ul className={wide.summary}>
                <li>
                  <b>{totals.owned}</b>
                  <span>of {totals.cards} cards collected</span>
                </li>
                <li>
                  <b>{totals.spares}</b>
                  <span>spare {totals.spares === 1 ? 'copy' : 'copies'} to recycle or trade</span>
                </li>
                <li>
                  <b>{totals.complete}</b>
                  <span>{totals.complete === 1 ? 'set' : 'sets'} complete</span>
                </li>
              </ul>
            </section>
          ) : null}

          {suggested.length > 0 && (entries?.length ?? 0) > 0 ? (
            <section className={`${ui.panel} ${wide.railPanel}`}>
              <h2 className={ui.panelTitle}>Worth following</h2>
              <ul className={styles.suggestList}>
                {suggested.slice(0, SUGGESTIONS).map((set) => (
                  <li key={set.id}>
                    <Link href={`/sets/${set.slug}`}>
                      <span className={styles.suggestPack}>
                        <PackStage set={set} />
                      </span>
                      <span className={styles.suggestName}>
                        <strong>{set.title}</strong>
                        <small>
                          {set.card_count} cards · {personHandle(set.creator)}
                        </small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/sets" className={wide.railLink}>
                Browse every set
              </Link>
            </section>
          ) : null}
        </aside>
      </div>

      {opening ? (
        <PackReveal
          opening={opening}
          onClose={() => {
            setOpening(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
