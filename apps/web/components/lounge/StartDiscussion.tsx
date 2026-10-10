'use client';

import { useEffect, useState } from 'react';
import type { LoungePost, LoungeStyle, LoungeTopic, OwnedCard } from '@miscellary/shared';
import { LOUNGE_TOPICS, cardCode } from '@miscellary/shared';
import CardPreview from '@/components/CardPreview';
import SearchField from '@/components/SearchField';
import { apiFetch } from '@/lib/api';
import { listMyCards } from '@/lib/packs';
import ui from '@/components/ui.module.css';
import { useLounge } from './LoungeShell';
import styles from './Lounge.module.css';

export default function StartDiscussion({
  defaultTopic,
  onCancel,
  onPosted,
}: {
  defaultTopic: LoungeTopic;
  onCancel: () => void;
  onPosted: (post: LoungePost) => void;
}) {
  const { subscriber } = useLounge();
  const maxCards = subscriber ? 6 : 1;
  const [topic, setTopic] = useState<LoungeTopic>(defaultTopic);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [style, setStyle] = useState<LoungeStyle>('plain');
  const [accepted, setAccepted] = useState(false);
  const [selected, setSelected] = useState<OwnedCard[]>([]);
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [cardQuery, setCardQuery] = useState('');
  const [cardPage, setCardPage] = useState(1);
  const [cardsNext, setCardsNext] = useState(false);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [cardsRetry, setCardsRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCardsLoading(true);
    setCardsError(null);
    const timer = window.setTimeout(
      () => {
        void listMyCards(undefined, cardPage, {
          query: cardQuery.trim(),
          signal: controller.signal,
        })
          .then((data) => {
            if (controller.signal.aborted) return;
            setCards(data.results);
            setCardsNext(Boolean(data.next));
          })
          .catch((err: unknown) => {
            if (!controller.signal.aborted)
              setCardsError(err instanceof Error ? err.message : 'Could not load cards.');
          })
          .finally(() => {
            if (!controller.signal.aborted) setCardsLoading(false);
          });
      },
      cardQuery ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cardPage, cardQuery, cardsRetry]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const post = await apiFetch<LoungePost>('/api/v1/lounge/', {
        method: 'POST',
        body: {
          title,
          body,
          topic,
          style: subscriber ? style : 'plain',
          card_ids: selected.map((card) => card.id),
          rules_accepted: accepted,
        },
      });
      onPosted(post);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not post that discussion.');
      setBusy(false);
    }
  }

  const isSelected = (owned: OwnedCard) => selected.some((copy) => copy.id === owned.id);

  return (
    <div className={styles.paneScroll}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <button type="button" className={styles.back} onClick={onCancel}>
          <span aria-hidden="true">←</span> All discussions
        </button>
        <h2>Start a discussion</h2>
        <fieldset className={styles.topics}>
          <legend className={ui.label}>Topic</legend>
          {LOUNGE_TOPICS.map((item) => (
            <label key={item.id}>
              <input
                type="radio"
                name="topic"
                value={item.id}
                checked={topic === item.id}
                onChange={() => setTopic(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </fieldset>
        <label className={styles.field}>
          <span className={ui.label}>Title</span>
          <input
            className={ui.input}
            maxLength={120}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={ui.label}>Your post</span>
          <textarea
            className={ui.input}
            rows={5}
            maxLength={3000}
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <div className={styles.field}>
          <span className={ui.label}>
            Cards <span className={ui.muted}>(optional, up to {maxCards})</span>
          </span>
          <SearchField
            value={cardQuery}
            onChange={(value) => {
              setCardQuery(value);
              setCardPage(1);
            }}
            label="Find a card in your collection"
            placeholder="Find a card or set"
          />
        </div>
        {selected.length > 0 && (
          <div className={styles.selected} aria-label="Selected cards">
            {selected.map((owned) => (
              <button
                key={owned.id}
                type="button"
                className={ui.action}
                onClick={() =>
                  setSelected((current) => current.filter((copy) => copy.id !== owned.id))
                }
                aria-label={`Remove ${owned.card.title}`}
              >
                {owned.card.title}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
        {cardsError ? (
          <div>
            <p role="alert" className={ui.error}>
              {cardsError}
            </p>
            <button
              type="button"
              className={ui.btnQuiet}
              onClick={() => setCardsRetry((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : !cardsLoading && !cards.length ? (
          <p className={ui.muted}>
            {cardQuery
              ? 'No cards match that search.'
              : 'Open a pack to start your collection, or post without a card.'}
          </p>
        ) : null}
        <div className={styles.picker} aria-busy={cardsLoading}>
          {cards.map((owned) => (
            <label key={owned.id} className={styles.pick}>
              <input
                type="checkbox"
                checked={isSelected(owned)}
                disabled={cardsLoading || (!isSelected(owned) && selected.length >= maxCards)}
                onChange={() =>
                  setSelected((values) =>
                    isSelected(owned)
                      ? values.filter((copy) => copy.id !== owned.id)
                      : [...values, owned],
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
          ))}
        </div>
        {(cardPage > 1 || cardsNext) && (
          <div className={styles.formActions}>
            {cardPage > 1 && (
              <button
                type="button"
                className={ui.btnQuiet}
                disabled={cardsLoading}
                onClick={() => setCardPage((value) => value - 1)}
              >
                Previous cards
              </button>
            )}
            {cardsNext && (
              <button
                type="button"
                className={ui.btnQuiet}
                disabled={cardsLoading}
                onClick={() => setCardPage((value) => value + 1)}
              >
                More cards
              </button>
            )}
          </div>
        )}
        {subscriber && selected.length > 1 && (
          <label className={styles.field}>
            <span className={ui.label}>Card layout</span>
            <select
              className={ui.input}
              value={style}
              onChange={(event) => setStyle(event.target.value as LoungeStyle)}
            >
              <option value="plain">Cards</option>
              <option value="binder">Binder</option>
            </select>
          </label>
        )}
        <p className={styles.rules}>
          Keep it kind and about collecting. No harassment, adult content, spam or stolen work.
          Share only cards you own, and report problems for a moderator to review.
        </p>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          I agree to the Lounge rules.
        </label>
        {error && (
          <p role="alert" className={ui.error}>
            {error}
          </p>
        )}
        <div className={styles.formActions}>
          <button
            className={ui.btnPrimary}
            disabled={busy || !accepted || !title.trim() || !body.trim()}
          >
            Post discussion
          </button>
          <button type="button" className={ui.btnQuiet} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
