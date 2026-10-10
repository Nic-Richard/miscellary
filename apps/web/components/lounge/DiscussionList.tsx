'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { LoungePost } from '@miscellary/shared';
import { cardCode, loungeTopicLabel } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import CardPreview from '@/components/CardPreview';
import SearchField from '@/components/SearchField';
import { timeAgo } from '@/lib/time';
import ui from '@/components/ui.module.css';
import type { LoungeSort } from './LoungeShell';
import styles from './Lounge.module.css';

const SORTS: { id: LoungeSort; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'new', label: 'New' },
  { id: 'top', label: 'Top' },
];

export default function DiscussionList({
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

  return (
    <div className={styles.list}>
      <div className={styles.listTools}>
        <SearchField
          value={query}
          onChange={onQuery}
          label="Search the Lounge"
          placeholder={topicLabel ? `Search ${topicLabel}` : 'Search discussions'}
        />
        <div className={styles.sortRow} role="group" aria-label="Sort discussions">
          {SORTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.sort}
              aria-pressed={sort === item.id}
              onClick={() => onSort(item.id)}
            >
              {item.label}
            </button>
          ))}
          {sort === 'top' && (
            <select
              aria-label="Top discussions from"
              className={styles.window}
              value={timeWindow}
              onChange={(event) => onWindow(event.target.value)}
            >
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="all">All time</option>
            </select>
          )}
        </div>
      </div>
      <div className={styles.rows} ref={list} aria-busy={loading}>
        {newCount > 0 && (
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
            className={styles.row}
            aria-current={post.id === openId ? 'page' : undefined}
          >
            <Fan post={post} />
            <span>
              <span className={styles.rowTitle}>{post.title}</span>
              <span className={styles.meta}>
                <span className={styles.who}>
                  <Avatar person={post.author} supporter={post.author_badge} size={20} />
                  {post.author?.display_name || post.author?.username || 'Deleted collector'}
                </span>
                {!topicLabel && (
                  <span className={styles.topic}>{loungeTopicLabel(post.topic)}</span>
                )}
                <span
                  className={styles.count}
                  aria-label={`${post.reply_count} ${post.reply_count === 1 ? 'reply' : 'replies'}`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 5h16v11H9l-5 4Z" />
                  </svg>
                  {post.reply_count}
                </span>
                <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
              </span>
            </span>
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
          <p className={styles.listNote}>
            {searching
              ? 'No discussions match that search.'
              : topicLabel
                ? `Nothing in ${topicLabel} yet. Start the first discussion.`
                : 'No discussions yet. Start the first one.'}
          </p>
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
  if (!cards.length)
    return (
      <span className={styles.fanText} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M4 5h16v11H9l-5 4Z" />
        </svg>
      </span>
    );
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
