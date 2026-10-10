'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { LoungePost, SavedFolder } from '@miscellary/shared';
import { cardCode, loungeTopicLabel } from '@miscellary/shared';
import CardPreview from '@/components/CardPreview';
import MenuSelect from '@/components/MenuSelect';
import SearchField from '@/components/SearchField';
import { timeAgo } from '@/lib/time';
import ui from '@/components/ui.module.css';
import type { LoungeSort, LoungeView } from './LoungeShell';
import styles from './Lounge.module.css';

type Window = 'today' | 'week' | 'month' | 'all';
const WINDOWS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
] as const;

const SORTS: { id: LoungeSort; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'new', label: 'New' },
  { id: 'top', label: 'Top' },
];

export default function DiscussionList({
  view,
  folders,
  folder,
  onFolder,
  onCloseView,
  rows,
  openId,
  sort,
  timeWindow,
  query,
  searching,
  topicLabel,
  loading,
  error,
  hasNext,
  newCount,
  onSort,
  onWindow,
  onQuery,
  onMore,
  onReload,
}: {
  view: LoungeView;
  folders: SavedFolder[];
  folder: string;
  onFolder: (folder: string) => void;
  onCloseView: () => void;
  rows: LoungePost[];
  openId: string | null;
  sort: LoungeSort;
  timeWindow: string;
  query: string;
  searching: boolean;
  topicLabel: string | null;
  loading: boolean;
  error: string | null;
  hasNext: boolean;
  newCount: number;
  onSort: (sort: LoungeSort) => void;
  onWindow: (window: string) => void;
  onQuery: (query: string) => void;
  onMore: () => void;
  onReload: () => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const canLoad = hasNext && !loading && !error;

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !canLoad) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onMore();
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [canLoad, onMore]);

  const empty =
    view === 'saved'
      ? 'Nothing saved yet. Use Save on a discussion to keep it here.'
      : view === 'drafts'
        ? 'No drafts. Choose Save as draft when starting a discussion.'
        : searching
          ? 'No discussions match that search.'
          : topicLabel
            ? `Nothing in ${topicLabel} yet. Start the first discussion.`
            : 'No discussions yet. Start the first one.';

  return (
    <div className={styles.list}>
      {view === 'all' ? (
        <div className={styles.listTools}>
          <SearchField
            value={query}
            onChange={onQuery}
            label="Search the Lounge"
            placeholder={topicLabel ? `Search ${topicLabel}` : 'Search discussions'}
          />
          <div className={styles.sortRow}>
            <div className={ui.segments} role="group" aria-label="Sort discussions">
              {SORTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${ui.segment} ${sort === item.id ? ui.segmentOn : ''} ${styles.sort}`}
                  aria-pressed={sort === item.id}
                  onClick={() => onSort(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {sort === 'top' && (
              <MenuSelect
                small
                label="Top discussions from"
                value={timeWindow as Window}
                options={WINDOWS}
                onChange={onWindow}
              />
            )}
          </div>
        </div>
      ) : (
        <div className={styles.viewHead}>
          <button type="button" className={styles.back} onClick={onCloseView}>
            <span aria-hidden="true">←</span> All discussions
          </button>
          <h2>{view === 'saved' ? 'Saved discussions' : 'Your drafts'}</h2>
          {view === 'saved' && folders.length > 0 && (
            <MenuSelect
              small
              label="Folder"
              value={folder}
              options={[
                { value: '', label: 'Everything saved' },
                { value: 'none', label: 'Not in a folder' },
                ...folders.map((item) => ({ value: String(item.id), label: item.name })),
              ]}
              onChange={onFolder}
            />
          )}
        </div>
      )}
      <div className={styles.rows} ref={list} aria-busy={loading}>
        {newCount > 0 && view === 'all' && (
          <div className={styles.newPill}>
            <button
              type="button"
              onClick={() => {
                list.current?.scrollTo({ top: 0 });
                onReload();
              }}
            >
              {newCount} new {newCount === 1 ? 'discussion' : 'discussions'}
            </button>
          </div>
        )}
        {rows.map((post) => (
          <Link
            key={post.id}
            href={`/lounge/${post.id}`}
            className={styles.slip}
            aria-current={post.id === openId ? 'page' : undefined}
          >
            <span className={styles.stub} aria-label={`${post.score} votes`}>
              <b>{post.score}</b>
              <small>{Math.abs(post.score) === 1 ? 'vote' : 'votes'}</small>
            </span>
            <span className={styles.slipMain}>
              <span className={styles.rowTitle}>{post.title}</span>
              {post.body && <span className={styles.excerpt}>{post.body}</span>}
              <span className={styles.meta}>
                <span>{post.author?.display_name || post.author?.username || 'Deleted'}</span>
                {!topicLabel && (
                  <span className={styles.topic}>{loungeTopicLabel(post.topic)}</span>
                )}
                <span>
                  {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
                </span>
                <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
                {post.unread && <span className={styles.newTag}>New replies</span>}
                {post.draft && <span className={styles.newTag}>Draft</span>}
              </span>
            </span>
            <Fan post={post} />
          </Link>
        ))}
        {error ? (
          <div className={styles.listNote}>
            <p role="alert" className={ui.error}>
              {error}
            </p>
            <button type="button" className={ui.btnQuiet} onClick={onReload}>
              Try again
            </button>
          </div>
        ) : loading ? (
          <p role="status" className={styles.listNote}>
            Loading discussions…
          </p>
        ) : !rows.length ? (
          <p className={styles.listNote}>{empty}</p>
        ) : null}
        {hasNext && !error && (
          <div className={styles.more} ref={sentinel}>
            <button type="button" className={ui.btnQuiet} disabled={loading} onClick={onMore}>
              More discussions
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Fan({ post }: { post: LoungePost }) {
  const cards = post.cards.filter((card) => card !== null).slice(0, 3);
  if (!cards.length) return <span aria-hidden="true" />;
  return (
    <span className={styles.fan} aria-hidden="true">
      {cards.map((card) => (
        <span key={card.id}>
          <CardPreview
            title={card.title}
            rarity={card.rarity}
            imageUrl={card.image?.url ?? null}
            templateKey={card.template_key}
            templateConfig={card.template_config}
            code={cardCode(card.printed_set_code, card.position, card.set_total)}
            printedText={card.printed_text}
            render={card.render}
            previewThumbnail
            renderMode="flat"
          />
        </span>
      ))}
    </span>
  );
}
