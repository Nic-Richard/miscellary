'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
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

  // Identity is presentation, not card data, so it stays editable after publishing.
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
    if (!set || !window.confirm('Publish this set? Cards can never be edited after publishing.'))
      return;
    try {
      setSet(await publishSet(set.id));
      setProblems([]);
    } catch (e) {
      if (e instanceof ApiRequestError) setError(e.message);
    }
  }

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

  return (
    <section>
      <Link href="/studio" className={styles.back}>
        ← Your sets
      </Link>

      <div className={styles.header}>
        {/* The cover is draft-only, like the title and description, so once the
            set is published it is shown but not editable. */}
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

      <div className={`${ui.panel} ${styles.identity}`}>
        <h2 className={ui.panelTitle}>Pack and identity</h2>
        <p className={styles.identityNote}>
          How this set presents itself: the foil, what is printed on it, and the mark that goes on
          its cards and empty sleeves. All of it stays editable after publishing.
        </p>
        <PackDesigner
          set={set}
          onDraft={(patch) => setSet({ ...set, ...patch })}
          onSave={saveIdentity}
        />
      </div>

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
          // Remount when the target changes, so opening a card for editing
          // while the new-card form is already open resets the fields.
          key={editing === 'new' ? 'new' : editing.id}
          setId={set.id}
          mark={set.mark}
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
        {set.cards.map((c, i) => (
          <CardCell
            key={c.id}
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
              number={i + 1}
              description={c.description}
              imageUrl={c.image.url}
              templateKey={c.template_key}
              templateConfig={c.template_config}
              mark={set.mark}
            />
          </CardCell>
        ))}
      </CardGrid>
    </section>
  );
}
