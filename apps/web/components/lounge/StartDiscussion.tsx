'use client';

import { useState } from 'react';
import type { LoungePost, LoungeStyle, LoungeTopic, OwnedCard } from '@miscellary/shared';
import { LOUNGE_LIMITS, LOUNGE_TOPICS } from '@miscellary/shared';
import SupporterPrompt, { SupporterTag } from '@/components/SupporterPrompt';
import { apiFetch } from '@/lib/api';
import { useMembership } from '@/lib/membership';
import ui from '@/components/ui.module.css';
import CardPicker from './CardPicker';
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
  const membership = useMembership();
  const [topic, setTopic] = useState<LoungeTopic>(defaultTopic);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [style, setStyle] = useState<LoungeStyle>('plain');
  const [locked, setLocked] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [selected, setSelected] = useState<OwnedCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = style === 'binder' ? LOUNGE_LIMITS.binderCards : LOUNGE_LIMITS.postCards;

  function chooseStyle(next: LoungeStyle) {
    if (next === 'binder' && !subscriber) {
      setLocked(true);
      return;
    }
    setLocked(false);
    setStyle(next);
    if (next === 'plain') setSelected((cards) => cards.slice(0, LOUNGE_LIMITS.postCards));
  }

  async function submit(draft: boolean) {
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
          style,
          draft,
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

  const ready = !busy && accepted && Boolean(title.trim()) && Boolean(body.trim());
  return (
    <div className={styles.paneScroll}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(false);
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
          <small className={ui.muted}>Mention someone with @username to let them know.</small>
        </label>
        <div className={styles.field}>
          <span className={ui.label}>Cards</span>
          <div className={`${ui.segments} ${styles.fit}`} role="group" aria-label="Card layout">
            <button
              type="button"
              className={`${ui.segment} ${style === 'plain' ? ui.segmentOn : ''}`}
              aria-pressed={style === 'plain'}
              onClick={() => chooseStyle('plain')}
            >
              Cards
            </button>
            <button
              type="button"
              className={`${ui.segment} ${style === 'binder' ? ui.segmentOn : ''}`}
              aria-pressed={style === 'binder'}
              onClick={() => chooseStyle('binder')}
            >
              Binder {!subscriber && membership.enabled && <SupporterTag />}
            </button>
          </div>
          {locked && (
            <SupporterPrompt>
              Supporters can fill binder pages with up to {LOUNGE_LIMITS.binderCards} cards.
            </SupporterPrompt>
          )}
        </div>
        <CardPicker max={max} selected={selected} onChange={setSelected} />
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
          <button className={ui.btnPrimary} disabled={!ready}>
            Post discussion
          </button>
          {subscriber && (
            <button
              type="button"
              className={ui.btnOutline}
              disabled={!ready}
              onClick={() => void submit(true)}
            >
              Save as draft
            </button>
          )}
          <button type="button" className={ui.btnQuiet} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
