'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { OwnedCard, TradeOffer } from '@miscellary/shared';
import SwapArrow from './SwapArrow';
import DemoBadge from './DemoBadge';
import { OfferActions, OfferSide, STATUS_WORD, readOffer } from './OfferCard';
import { useDialog } from '@/lib/useDialog';
import styles from './OfferInspector.module.css';

export default function OfferInspector({
  offer,
  me,
  onAction,
  onInspect,
  onClose,
  busy,
}: {
  offer: TradeOffer;
  me: string;
  onAction: (action: 'accept' | 'reject' | 'cancel') => void;
  onInspect?: ((owned: OwnedCard) => void) | undefined;
  onClose: () => void;
  busy?: boolean;
}) {
  const { incoming, other, youGet, youGive } = readOffer(offer, me);
  const close = useRef<HTMLButtonElement>(null);

  useDialog(onClose);
  useEffect(() => {
    close.current?.focus();
  }, []);

  return (
    <div
      className={styles.scrim}
      role="dialog"
      aria-modal="true"
      aria-label={`Trade offer ${incoming ? 'from' : 'to'} ${other.username}`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.sheet}>
        <button
          ref={close}
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <header className={styles.head}>
          <span className={styles.who}>
            <span className={styles.dir}>{incoming ? 'From' : 'To'}</span>
            <Link href={`/users/${other.username}`} className={styles.handle}>
              @{other.username}
            </Link>
            {other.is_demo ? <DemoBadge compact /> : null}
            {offer.counter_of ? <span className={styles.badge}>counter</span> : null}
          </span>
          <span className={styles.status}>{STATUS_WORD[offer.status] ?? offer.status}</span>
        </header>

        {offer.message ? <p className={styles.message}>&ldquo;{offer.message}&rdquo;</p> : null}

        <div className={styles.deal}>
          <OfferSide label="You get" cards={youGet} onInspect={onInspect} big />
          <SwapArrow className={styles.swap} />
          <OfferSide label="You give" cards={youGive} onInspect={onInspect} big />
        </div>

        {onInspect ? <p className={styles.hint}>Pick a card to look at it on its own.</p> : null}

        <OfferActions offer={offer} me={me} onAction={onAction} busy={busy} />
      </div>
    </div>
  );
}
