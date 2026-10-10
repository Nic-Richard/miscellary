'use client';

import { useEffect, useState } from 'react';
import type { OwnedCard } from '@miscellary/shared';
import { cardCode } from '@miscellary/shared';
import CardPreview from '@/components/CardPreview';
import SearchField from '@/components/SearchField';
import { listMyCards } from '@/lib/packs';
import ui from '@/components/ui.module.css';
import styles from './Lounge.module.css';

export default function CardPicker({
  max,
  selected,
  onChange,
}: {
  max: number;
  selected: OwnedCard[];
  onChange: (cards: OwnedCard[]) => void;
}) {
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(
      () => {
        void listMyCards(undefined, page, { query: query.trim(), signal: controller.signal })
          .then((data) => {
            if (controller.signal.aborted) return;
            setCards((current) => (page === 1 ? data.results : [...current, ...data.results]));
            setHasNext(Boolean(data.next));
          })
          .catch((err: unknown) => {
            if (!controller.signal.aborted)
              setError(err instanceof Error ? err.message : 'Could not load cards.');
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      query ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [page, query, retry]);

  const isSelected = (owned: OwnedCard) => selected.some((copy) => copy.id === owned.id);

  return (
    <div className={styles.cardPicker}>
      <div className={styles.pickerHead}>
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          label="Find a card in your collection"
          placeholder="Find a card or set"
        />
        <span className={styles.counter} aria-live="polite">
          <b>{selected.length}</b> of {max} cards
        </span>
      </div>
      {error ? (
        <div>
          <p role="alert" className={ui.error}>
            {error}
          </p>
          <button type="button" className={ui.btnQuiet} onClick={() => setRetry((v) => v + 1)}>
            Try again
          </button>
        </div>
      ) : !loading && !cards.length ? (
        <p className={ui.muted}>
          {query ? 'No cards match that search.' : 'Open a pack to start your collection.'}
        </p>
      ) : null}
      <div className={styles.picker} aria-busy={loading}>
        {cards.map((owned) => {
          const on = isSelected(owned);
          return (
            <label key={owned.id} className={styles.pick}>
              <input
                type="checkbox"
                checked={on}
                disabled={!on && selected.length >= max}
                onChange={() =>
                  onChange(
                    on ? selected.filter((copy) => copy.id !== owned.id) : [...selected, owned],
                  )
                }
              />
              <CardPreview
                title={owned.card.title}
                rarity={owned.card.rarity}
                imageUrl={owned.card.image?.url ?? null}
                templateKey={owned.card.template_key}
                templateConfig={owned.card.template_config}
                code={cardCode(
                  owned.card.printed_set_code,
                  owned.card.position,
                  owned.card.set_total,
                )}
                printedText={owned.card.printed_text}
                render={owned.card.render}
                previewThumbnail
                renderMode="flat"
              />
              <span>
                <b>{owned.card.title}</b>
                <small>{owned.set_title}</small>
              </span>
            </label>
          );
        })}
      </div>
      {hasNext && (
        <button
          type="button"
          className={ui.btnQuiet}
          disabled={loading}
          onClick={() => setPage((value) => value + 1)}
        >
          More cards
        </button>
      )}
    </div>
  );
}
