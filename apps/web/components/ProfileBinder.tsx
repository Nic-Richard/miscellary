'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { SHOWCASE_SLOTS } from '@miscellary/shared';
import type { OwnedCard, ShowcaseSlot } from '@miscellary/shared';
import Binder from './binder/Binder';
import CardPreview from './CardPreview';
import ui from './ui.module.css';
import { binderClothStyle } from '@/lib/setIdentity';
import styles from './ProfileBinder.module.css';

interface ProfileBinderProps {
  slots: (ShowcaseSlot | null)[];
  title?: string;
  colour?: string | undefined;
  mine?: boolean;
  onPick?: ((position: number) => void) | undefined;
  onRemove?: ((position: number) => void) | undefined;
  onInspect?: ((owned: OwnedCard) => void) | undefined;
  footer?: ReactNode;

  open?: boolean;
}

const DEFAULT_TITLE = 'The pride of the collection';

const STAT_ICONS = {
  cards: 'M7 4h10v16H7ZM4 7h1v10H4Zm15 0h1v10h-1ZM10 8h4M10 11h4',
  sleeves: 'M5 4h14v16H5Zm3 4h8v8H8Z',
  pages: 'M4 5.5h6a2 2 0 0 1 2 2V19a2 2 0 0 0-2-2H4Zm16 0h-6a2 2 0 0 0-2 2V19a2 2 0 0 1 2-2h6Z',
  sets: 'M5 6h11l3 3v10H5Zm11 0v4h4M8 11h7M8 15h8',
};

function StatIcon({ name }: { name: keyof typeof STAT_ICONS }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={STAT_ICONS[name]} />
    </svg>
  );
}

function Sleeved({
  owned,
  onInspect,
  onPick,
  onRemove,
}: {
  owned: OwnedCard;
  onInspect?: ((owned: OwnedCard) => void) | undefined;
  onPick?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
}) {
  const card = (
    <CardPreview
      size="small"
      title={owned.card.title}
      rarity={owned.card.rarity}
      number={owned.card.position + 1}
      description={owned.card.description}
      imageUrl={owned.card.image.url}
      templateKey={owned.card.template_key}
      templateConfig={owned.card.template_config}
      mark={owned.set_mark}
    />
  );

  if (onPick) {
    return (
      <div className={styles.editableSlot}>
        <button
          type="button"
          className={`${styles.inspect} ${styles.swap}`}
          onClick={onPick}
          title={`${owned.card.title} · ${owned.set_title}`}
          aria-label={`Change the sleeve holding ${owned.card.title}`}
        >
          {card}
        </button>
        {onRemove ? (
          <button
            type="button"
            className={styles.remove}
            onClick={onRemove}
            aria-label={`Remove ${owned.card.title} from this sleeve`}
          >
            ×
          </button>
        ) : null}
      </div>
    );
  }
  if (!onInspect) return card;
  return (
    <button
      type="button"
      className={styles.inspect}
      onClick={() => onInspect(owned)}
      title={`${owned.card.title} · ${owned.set_title}`}
      aria-label={`Inspect ${owned.card.title} from ${owned.set_title}`}
    >
      {card}
    </button>
  );
}

export default function ProfileBinder({
  slots,
  title,
  colour,
  mine,
  onPick,
  onRemove,
  onInspect,
  footer,
  open: startOpen = true,
}: ProfileBinderProps) {
  const [open, setOpen] = useState(startOpen);
  const [page, setPage] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const alignOnOpen = useRef(false);
  const preloadedImages = useRef<HTMLImageElement[]>([]);
  const filled = slots.filter(Boolean).length;
  const caption = title?.trim() || DEFAULT_TITLE;
  const preloadKey = slots
    .flatMap((slot) => (slot?.owned_card.card.image.url ? [slot.owned_card.card.image.url] : []))
    .join('\n');
  const representedSets = useMemo(() => {
    const counts = new Map<string, { slug: string; title: string; count: number }>();
    for (const slot of slots) {
      if (!slot) continue;
      const current = counts.get(slot.owned_card.set_slug);
      counts.set(slot.owned_card.set_slug, {
        slug: slot.owned_card.set_slug,
        title: slot.owned_card.set_title,
        count: (current?.count ?? 0) + 1,
      });
    }
    return [...counts.values()];
  }, [slots]);
  const pages = useMemo(
    () =>
      Array.from({ length: Math.ceil(SHOWCASE_SLOTS / 8) }, (_, pageIndex) => ({
        startIndex: pageIndex * 8,
        slots: Array.from({ length: 8 }, (_, slotIndex) => {
          const position = pageIndex * 8 + slotIndex;
          const slot = slots[position];
          return slot ? (
            <Sleeved
              key={slot.position}
              owned={slot.owned_card}
              onInspect={onInspect}
              onPick={onPick ? () => onPick(position) : undefined}
              onRemove={onRemove ? () => onRemove(position) : undefined}
            />
          ) : null;
        }),
      })),
    [onInspect, onPick, onRemove, slots],
  );

  function navigate(direction: -1 | 1) {
    setPage((current) => Math.max(0, Math.min(pages.length - 1, current + direction)));
  }

  useEffect(() => {
    if (!open || !alignOnOpen.current) return;
    alignOnOpen.current = false;
    const frame = requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    const sources = preloadKey ? [...new Set(preloadKey.split('\n'))] : [];
    const images = sources.map((source) => {
      const image = new window.Image();
      image.src = source;
      void image.decode?.().catch(() => undefined);
      return image;
    });
    preloadedImages.current = images;
    return () => {
      if (preloadedImages.current === images) preloadedImages.current = [];
    };
  }, [preloadKey]);

  if (!open) {
    return (
      <div className={styles.shut}>
        <span
          className={styles.spine}
          style={binderClothStyle(colour || 'teal')}
          aria-hidden="true"
        />
        <div className={styles.shutText}>
          <h2 className={styles.caption}>{caption}</h2>
          <p className={styles.shutMeta}>
            {filled} of {SHOWCASE_SLOTS} sleeves filled
          </p>
        </div>
        <button
          type="button"
          className={styles.openBtn}
          onClick={() => {
            alignOnOpen.current = true;
            setOpen(true);
          }}
        >
          Open the binder
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.head}>
            <h2 className={styles.caption}>{caption}</h2>
            <span className={styles.count}>
              {filled} of {SHOWCASE_SLOTS}
              {startOpen ? null : (
                <button type="button" className={styles.shutBtn} onClick={() => setOpen(false)}>
                  Close
                </button>
              )}
            </span>
          </div>
          <Binder
            colour={colour}
            emptyLabel={onPick ? 'Pin a card' : mine ? 'Empty' : 'Empty sleeve'}
            page={page}
            startIndex={page * 8}
            canPrevious={page > 0}
            canNext={page < pages.length - 1}
            onNavigate={navigate}
            onPickEmpty={onPick ? (slotIndex) => onPick(page * 8 + slotIndex) : undefined}
            pages={pages}
            slots={pages[page]?.slots ?? []}
          />
          <div className={styles.pager}>
            <button
              type="button"
              className={`${ui.btnQuiet} ${ui.btnSmall}`}
              onPointerDown={(event) => {
                if (event.button === 0) navigate(-1);
              }}
              onClick={(event) => {
                if (event.detail === 0) navigate(-1);
              }}
              disabled={page === 0}
            >
              ← Previous
            </button>
            <span className={styles.pageNo}>
              Pages {page * 2 + 1} and {page * 2 + 2} of {pages.length * 2}
            </span>
            <button
              type="button"
              className={`${ui.btnQuiet} ${ui.btnSmall}`}
              onPointerDown={(event) => {
                if (event.button === 0) navigate(1);
              }}
              onClick={(event) => {
                if (event.detail === 0) navigate(1);
              }}
              disabled={page >= pages.length - 1}
            >
              Next →
            </button>
          </div>
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>

        <aside className={styles.rail}>
          <section className={ui.panel}>
            <h2 className={ui.panelTitle}>About this binder</h2>
            <ul className={ui.stats}>
              <li className={ui.stat}>
                <StatIcon name="cards" />
                <b>{filled}</b>
                <span>Cards shown</span>
              </li>
              <li className={ui.stat}>
                <StatIcon name="sleeves" />
                <b>{SHOWCASE_SLOTS - filled}</b>
                <span>Open sleeves</span>
              </li>
              <li className={ui.stat}>
                <StatIcon name="pages" />
                <b>{pages.length * 2}</b>
                <span>Pages</span>
              </li>
              <li className={ui.stat}>
                <StatIcon name="sets" />
                <b>{representedSets.length}</b>
                <span>Sets represented</span>
              </li>
            </ul>
          </section>

          <section className={ui.panel}>
            <h2 className={ui.panelTitle}>Set index</h2>
            {representedSets.length ? (
              <ol className={styles.setIndex}>
                {representedSets.slice(0, 6).map((set) => (
                  <li key={set.slug}>
                    <Link href={`/sets/${set.slug}`}>
                      <span>{set.title}</span>
                      <b>{set.count}</b>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.railEmpty}>Pinned cards will be indexed here.</p>
            )}
            {representedSets.length > 6 ? (
              <p className={styles.moreSets}>+{representedSets.length - 6} more sets</p>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
