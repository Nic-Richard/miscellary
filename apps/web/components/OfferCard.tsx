'use client';

import Link from 'next/link';
import { cardCode } from '@miscellary/shared';
import type { OwnedCard, TradeOffer } from '@miscellary/shared';
import CardPreview from './CardPreview';
import SwapArrow from './SwapArrow';
import DemoBadge from './DemoBadge';
import ui from './ui.module.css';
import styles from './OfferCard.module.css';

export function OfferSide({
  label,
  cards,
  onInspect,
  big,
}: {
  label: string;
  cards: OwnedCard[];
  onInspect?: ((owned: OwnedCard) => void) | undefined;
  big?: boolean;
}) {
  return (
    <div className={styles.side}>
      <span className={styles.sideLabel}>
        {label} <b>{cards.length}</b>
      </span>
      <div className={`${styles.cards} ${big ? styles.cardsBig : ''}`}>
        {cards.length === 0 ? (
          <span className={styles.nothing}>nothing</span>
        ) : (
          cards.map((c) => {
            const card = (
              <CardPreview
                size={big ? 'large' : 'small'}
                title={c.card.title}
                rarity={c.card.rarity}
                code={cardCode(c.card.printed_set_code, c.card.position, c.card.set_total)}
                printedText={c.card.printed_text}
                imageUrl={c.card.image.url}
                templateKey={c.card.template_key}
                templateConfig={c.card.template_config}
                mark={c.set_mark}
                render={c.card.render}
              />
            );
            const size = `${styles.card} ${big ? styles.cardBig : ''}`;
            if (!onInspect) {
              return (
                <span key={c.id} className={size}>
                  {card}
                </span>
              );
            }
            return (
              <button
                key={c.id}
                type="button"
                className={`${size} ${styles.inspect}`}
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
  onOpen?: (offer: TradeOffer) => void;
  busy?: boolean;
}

export function readOffer(offer: TradeOffer, me: string) {
  const incoming = offer.recipient.username === me;
  return {
    incoming,
    other: incoming ? offer.sender : offer.recipient,
    youGet: incoming ? offer.give : offer.want,
    youGive: incoming ? offer.want : offer.give,
  };
}

export const STATUS_WORD: Record<string, string> = {
  pending: 'Waiting',
  accepted: 'Accepted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  countered: 'Countered',
};

export function OfferActions({
  offer,
  me,
  onAction,
  busy,
}: {
  offer: TradeOffer;
  me: string;
  onAction: (action: 'accept' | 'reject' | 'cancel') => void;
  busy?: boolean | undefined;
}) {
  const { incoming, other } = readOffer(offer, me);
  if (offer.status !== 'pending') return null;
  return (
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
  );
}

export default function OfferCard({
  offer,
  me,
  onAction,
  onInspect,
  onOpen,
  busy,
}: OfferCardProps) {
  const { incoming, other, youGet, youGive } = readOffer(offer, me);

  return (
    <article className={styles.root}>
      <header className={styles.header}>
        <span className={styles.who}>
          <span className={styles.dir}>{incoming ? 'From' : 'To'}</span>
          <Link href={`/users/${other.username}`} className={styles.handle}>
            @{other.username}
          </Link>
          {other.is_demo ? <DemoBadge compact /> : null}
          {offer.counter_of ? <span className={styles.badge}>counter</span> : null}
        </span>
        <span className={`${styles.status} ${styles[offer.status] ?? ''}`}>
          {STATUS_WORD[offer.status] ?? offer.status}
        </span>
      </header>

      {offer.message ? <p className={styles.message}>&ldquo;{offer.message}&rdquo;</p> : null}

      <div className={styles.deal}>
        <OfferSide label="You get" cards={youGet} onInspect={onInspect} />
        <SwapArrow className={styles.swap} />
        <OfferSide label="You give" cards={youGive} onInspect={onInspect} />
      </div>

      {onOpen ? (
        <button type="button" className={styles.open} onClick={() => onOpen(offer)}>
          Open offer
        </button>
      ) : null}

      <OfferActions offer={offer} me={me} onAction={onAction} busy={busy} />
    </article>
  );
}
