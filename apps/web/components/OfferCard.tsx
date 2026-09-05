'use client';

import Link from 'next/link';
import type { OwnedCard, TradeOffer } from '@miscellary/shared';
import CardPreview from './CardPreview';
import ui from './ui.module.css';
import styles from './OfferCard.module.css';

function Side({
  label,
  cards,
  onInspect,
}: {
  label: string;
  cards: OwnedCard[];
  onInspect?: ((owned: OwnedCard) => void) | undefined;
}) {
  return (
    <div className={styles.side}>
      <span className={styles.sideLabel}>
        {label} <b>{cards.length}</b>
      </span>
      <div className={styles.cards}>
        {cards.length === 0 ? (
          <span className={styles.nothing}>nothing</span>
        ) : (
          cards.map((c) => {
            const card = (
              <CardPreview
                size="small"
                title={c.card.title}
                rarity={c.card.rarity}
                description=""
                imageUrl={c.card.image.url}
                templateKey={c.card.template_key}
                templateConfig={c.card.template_config}
                mark={c.set_mark}
              />
            );
            if (!onInspect) {
              return (
                <span key={c.id} className={styles.card}>
                  {card}
                </span>
              );
            }
            return (
              <button
                key={c.id}
                type="button"
                className={`${styles.card} ${styles.inspect}`}
                onClick={() => onInspect(c)}
                aria-label={`Inspect ${c.card.title}`}
              >
                {card}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

interface OfferCardProps {
  offer: TradeOffer;
  me: string;
  onAction: (action: 'accept' | 'reject' | 'cancel') => void;
  onInspect?: (owned: OwnedCard) => void;
  busy?: boolean;
}

const STATUS_WORD: Record<string, string> = {
  pending: 'Waiting',
  accepted: 'Accepted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  countered: 'Countered',
};

export default function OfferCard({ offer, me, onAction, onInspect, busy }: OfferCardProps) {
  const incoming = offer.recipient.username === me;
  const other = incoming ? offer.sender : offer.recipient;
  // The offer is always written from the reader's point of view: the sender's
  // "give" is the reader's "get" when it landed in their inbox.
  const youGet = incoming ? offer.give : offer.want;
  const youGive = incoming ? offer.want : offer.give;

  return (
    <article className={styles.root}>
      <header className={styles.header}>
        <span className={styles.who}>
          <span className={styles.dir}>{incoming ? 'From' : 'To'}</span>
          <Link href={`/users/${other.username}`} className={styles.handle}>
            @{other.username}
          </Link>
          {offer.counter_of ? <span className={styles.badge}>counter</span> : null}
        </span>
        <span className={`${styles.status} ${styles[offer.status] ?? ''}`}>
          {STATUS_WORD[offer.status] ?? offer.status}
        </span>
      </header>

      {offer.message ? <p className={styles.message}>&ldquo;{offer.message}&rdquo;</p> : null}

      <div className={styles.deal}>
        <Side label="You get" cards={youGet} onInspect={onInspect} />
        <span className={styles.swap} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 9h14l-4-4M20 15H6l4 4" />
          </svg>
        </span>
        <Side label="You give" cards={youGive} onInspect={onInspect} />
      </div>

      {offer.status === 'pending' ? (
        <footer className={styles.actions}>
          {incoming ? (
            <>
              <button
                className={ui.btnPrimary}
                type="button"
                disabled={busy}
                onClick={() => onAction('accept')}
              >
                Accept
              </button>
              <Link className={ui.btnOutline} href={`/trades/new?counter=${offer.id}`}>
                Counter
              </Link>
              <button
                className={styles.quietDanger}
                type="button"
                disabled={busy}
                onClick={() => onAction('reject')}
              >
                Reject
              </button>
            </>
          ) : (
            <>
              <span className={styles.await}>Waiting on @{other.username}</span>
              <button
                className={styles.quietDanger}
                type="button"
                disabled={busy}
                onClick={() => onAction('cancel')}
              >
                Cancel offer
              </button>
            </>
          )}
        </footer>
      ) : null}
    </article>
  );
}
