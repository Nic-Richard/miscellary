'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { cardCode } from '@miscellary/shared';
import type { Card, CardSetDetail, CardTemplate } from '@miscellary/shared';
import CardGrid, { CardCell } from '@/components/CardGrid';
import PackDesigner from '@/components/studio/PackDesigner';
import SetCover from '@/components/SetCover';
import CardPreview from '@/components/CardPreview';
import CardForm from '@/components/CardForm';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  deleteCard,
  deleteSet,
  getMySet,
  listTemplates,
  publishProblems,
  publishSet,
  reorderCards,
  updateSet,
} from '@/lib/sets';
import type { SetWrite } from '@/lib/sets';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

export default function SetEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [set, setSet] = useState<CardSetDetail | null>(null);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [editing, setEditing] = useState<Card | 'new' | null>(null);
  const [problems, setProblems] = useState<string[] | null>(null);
  const [packOpen, setPackOpen] = useState(false);
  /* Which card is being dragged. Held in a ref as well as in state, because a
     pointer can move before React has re-rendered and the move needs to know
     what it is carrying the moment it is asked. */
  const held = useRef<string | null>(null);
  const armed = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const reload = useCallback(async () => {
    const [s, p] = await Promise.all([getMySet(id), publishProblems(id)]);
    setSet(s);
    setTitle(s.title);
    setDescription(s.description);
    setProblems(p.problems);
  }, [id]);

  useEffect(() => {
    if (!user) return;
    Promise.all([reload(), listTemplates().then(setTemplates)]).catch((e: Error) =>
      setError(e.message),
    );
  }, [user, reload]);

  async function saveDetails() {
    if (!set) return;
    try {
      setSet(await updateSet(set.id, { title, description }));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not save.');
    }
  }

  async function saveIdentity(patch: Partial<SetWrite>) {
    if (!set) return;
    try {
      setSet(await updateSet(set.id, patch));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not save.');
    }
  }

  async function onPublish() {
    if (!set || !window.confirm('Publish this set? Nothing in it can be edited afterward.')) return;
    try {
      setSet(await publishSet(set.id));
      setProblems([]);
    } catch (e) {
      if (e instanceof ApiRequestError) setError(e.message);
    }
  }

  function moveCard(fromId: string, toId: string) {
    setSet((current) => {
      if (!current) return current;
      const cards = [...current.cards];
      const from = cards.findIndex((c) => c.id === fromId);
      const to = cards.findIndex((c) => c.id === toId);
      if (from === -1 || to === -1 || from === to) return current;
      const [moved] = cards.splice(from, 1);
      cards.splice(to, 0, moved!);
      return { ...current, cards: cards.map((c, position) => ({ ...c, position })) };
    });
  }

  async function saveOrder() {
    if (!set) return;
    const order = await new Promise<string[]>((resolve) =>
      setSet((current) => {
        resolve((current?.cards ?? []).map((c) => c.id));
        return current;
      }),
    );
    try {
      await reorderCards(set.id, order);
    } catch (e) {
      if (e instanceof ApiRequestError) setError(e.message);
      await reload();
    }
  }

  /* A mouse picks a card up straight away. A finger has to hold it first, or
     every attempt to scroll the page would drag a card instead. */
  function startReorder(id: string, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const pick = () => {
      held.current = id;
      setDragging(id);
    };
    if (event.pointerType === 'mouse') pick();
    else armed.current = setTimeout(pick, 350);
  }

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (armed.current && !held.current) {
        clearTimeout(armed.current);
        armed.current = null;
        return;
      }
      if (!held.current) return;
      event.preventDefault();
      const under = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest('[data-card-id]');
      const id = under?.getAttribute('data-card-id');
      if (!id || id === held.current) return;
      setOver(id);
      moveCard(held.current, id);
    };
    const end = () => {
      if (armed.current) clearTimeout(armed.current);
      armed.current = null;
      if (!held.current) return;
      held.current = null;
      setDragging(null);
      setOver(null);
      void saveOrder();
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  });

  async function onDeleteCard(card: Card) {
    if (!set || !window.confirm(`Delete "${card.title}"?`)) return;
    await deleteCard(set.id, card.id);
    await reload();
  }

  async function onDeleteSet() {
    if (!set || !window.confirm('Delete this set?')) return;
    await deleteSet(set.id);
    router.push('/studio');
  }

  if (loading) return <p className={styles.muted}>Loading…</p>;
  if (!user) return <p className={styles.muted}>Log in to edit sets.</p>;
  if (error && !set) return <p className={styles.error}>{error}</p>;
  if (!set) return <p className={styles.muted}>Loading…</p>;

  const isDraft = set.status === 'draft';
  const setCode = set.printed_set_code;

  return (
    <section>
      <Link href="/studio" className={styles.back}>
        ← Your sets
      </Link>

      <div className={styles.header}>
        <SetCover
          url={set.cover?.url ?? null}
          fallback={set.cards[0]?.image.url ?? null}
          title={set.title}
          {...(isDraft
            ? { onChange: (image) => void saveIdentity({ cover_id: image?.id ?? null }) }
            : {})}
        />

        <div className={`${ui.panel} ${styles.details}`}>
          <p className={ui.eyebrow}>{isDraft ? 'Draft set' : set.status}</p>
          {isDraft ? (
            <>
              <input
                className={styles.titleInput}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                aria-label="Set title"
              />
              <textarea
                className={ui.input}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the set (optional)"
                maxLength={600}
                rows={3}
              />
              <div className={styles.actions}>
                <button
                  className={`${ui.btnOutline} ${ui.btnSmall}`}
                  type="button"
                  onClick={() => void saveDetails()}
                >
                  Save details
                </button>
                <button
                  className={`${ui.btnDanger} ${ui.btnSmall}`}
                  type="button"
                  onClick={() => void onDeleteSet()}
                >
                  Delete draft
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className={ui.title}>{set.title}</h1>
              <p className={styles.muted}>
                Published sets are locked. <Link href={`/sets/${set.slug}`}>View the binder</Link>.
              </p>
            </>
          )}
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>

        {isDraft ? (
          <aside className={`${ui.ticket} ${styles.publish}`}>
            <h2 className={styles.publishTitle}>Publish</h2>
            {problems && problems.length > 0 ? (
              <ul className={styles.problems}>
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.ok}>Ready to publish</p>
            )}
            <button
              className={ui.btnPrimary}
              type="button"
              onClick={() => void onPublish()}
              disabled={!problems || problems.length > 0}
            >
              Publish set
            </button>
          </aside>
        ) : null}
      </div>

      {isDraft ? (
        <div className={`${ui.panel} ${styles.identity}`}>
          <div className={styles.identityHead}>
            <h2 className={ui.panelTitle}>Pack and identity</h2>
            <button
              className={ui.btnQuiet}
              type="button"
              aria-expanded={packOpen}
              onClick={() => setPackOpen(!packOpen)}
            >
              {packOpen ? 'Close pack editor' : 'Open pack editor'}
            </button>
          </div>
          {packOpen ? (
            <PackDesigner
              set={set}
              onDraft={(patch) => setSet({ ...set, ...patch })}
              onSave={saveIdentity}
            />
          ) : null}
        </div>
      ) : null}

      <div className={styles.cardsHeader}>
        <h2 className={ui.subtitle}>Cards · {set.cards.length}</h2>
        {isDraft ? (
          <button className={ui.btnPrimary} type="button" onClick={() => setEditing('new')}>
            Add card
          </button>
        ) : null}
      </div>

      {editing ? (
        <CardForm
          key={editing === 'new' ? 'new' : editing.id}
          setId={set.id}
          mark={set.mark}
          code={cardCode(
            setCode,
            editing === 'new' ? set.cards.length : editing.position,
            editing === 'new' ? set.cards.length + 1 : set.cards.length,
          )}
          templates={templates}
          card={editing === 'new' ? null : editing}
          onDone={async () => {
            setEditing(null);
            await reload();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      <CardGrid>
        {set.cards.map((c) => (
          <CardCell
            key={c.id}
            {...(isDraft
              ? {
                  reorder: {
                    id: c.id,
                    dragging: dragging === c.id,
                    over: over === c.id && dragging !== c.id,
                    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) =>
                      startReorder(c.id, event),
                  },
                }
              : {})}
            footer={
              isDraft ? (
                <>
                  <button type="button" className={styles.link} onClick={() => setEditing(c)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.linkDanger}
                    onClick={() => void onDeleteCard(c)}
                  >
                    Delete
                  </button>
                </>
              ) : null
            }
          >
            <CardPreview
              size="small"
              title={c.title}
              rarity={c.rarity}
              code={cardCode(setCode, c.position, c.set_total || set.cards.length)}
              printedText={c.printed_text}
              imageUrl={c.image.url}
              templateKey={c.template_key}
              templateConfig={c.template_config}
              mark={set.mark}
              render={c.render}
            />
          </CardCell>
        ))}
      </CardGrid>
    </section>
  );
}
