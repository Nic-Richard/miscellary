'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { LoungeFeed, LoungePost, LoungeTopic, SavedFolder } from '@miscellary/shared';
import { LOUNGE_TOPICS } from '@miscellary/shared';
import PageHeader from '@/components/PageHeader';
import MoreMenu from '@/components/MoreMenu';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { listFolders } from '@/lib/lounge';
import ui from '@/components/ui.module.css';
import DiscussionList from './DiscussionList';
import StartDiscussion from './StartDiscussion';
import BlockedList from './BlockedList';
import styles from './Lounge.module.css';

export type LoungeSort = 'active' | 'new' | 'top';
export type LoungeView = 'all' | 'saved' | 'drafts';
type Pane = 'discussion' | 'compose' | 'blocked';

interface LoungeContextValue {
  subscriber: boolean;
  patchPost: (id: string, patch: Partial<LoungePost>) => void;
  hideAuthor: (username: string) => void;
  startDiscussion: () => void;
  reload: () => void;
}

const LoungeContext = createContext<LoungeContextValue | null>(null);

export function useLounge(): LoungeContextValue {
  const value = useContext(LoungeContext);
  if (!value) throw new Error('useLounge must be used inside the Lounge.');
  return value;
}

const NEW_CHECK_MS = 45_000;

export default function LoungeShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const openId = pathname.match(/^\/lounge\/([^/]+)/)?.[1] ?? null;
  const [topic, setTopic] = useState<LoungeTopic | ''>('');
  const [sort, setSort] = useState<LoungeSort>('active');
  const [timeWindow, setTimeWindow] = useState('week');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<LoungePost[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [subscriber, setSubscriber] = useState(false);
  const [version, setVersion] = useState(0);
  const [since, setSince] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [pane, setPane] = useState<Pane>('discussion');
  const [view, setView] = useState<LoungeView>('all');
  const [folder, setFolder] = useState('');
  const [folders, setFolders] = useState<SavedFolder[]>([]);

  useEffect(() => {
    const next = query.trim();
    if (next === search) return;
    const timer = window.setTimeout(() => {
      setSearch(next);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = new Date().toISOString();
    const params = new URLSearchParams({ sort, window: timeWindow, page: String(page) });
    if (topic) params.set('topic', topic);
    if (search) params.set('q', search);
    if (view === 'saved') params.set('saved', '1');
    if (view === 'saved' && folder) params.set('folder', folder);
    const url =
      view === 'drafts'
        ? `/api/v1/me/lounge/drafts/?page=${page}`
        : `/api/v1/lounge/?${params.toString()}`;
    setLoading(true);
    void apiFetch<LoungeFeed>(url, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (view === 'all') {
          setEnabled(data.enabled);
          setSubscriber(data.subscriber);
        }
        setHasNext(Boolean(data.next));
        setError(null);
        if (page === 1) {
          setRows(data.results);
          setSince(startedAt);
          setNewCount(0);
        } else {
          // Pages shift as people post, so skip anything already on screen.
          setRows((current) => {
            const seen = new Set(current.map((row) => row.id));
            return [...current, ...data.results.filter((row) => !seen.has(row.id))];
          });
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not load the Lounge.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [topic, sort, timeWindow, search, page, version, view, folder, user?.id]);

  useEffect(() => {
    if (view === 'saved' && subscriber)
      void listFolders()
        .then(setFolders)
        .catch(() => undefined);
  }, [view, subscriber]);

  const showView = useCallback((next: LoungeView) => {
    setView(next);
    setFolder('');
    setPage(1);
    setPane('discussion');
  }, []);

  useEffect(() => {
    if (!since || search || !enabled || view !== 'all') return;
    const controller = new AbortController();
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      const params = new URLSearchParams({ new_since: since });
      if (topic) params.set('topic', topic);
      void apiFetch<{ new_count: number }>(`/api/v1/lounge/?${params}`, {
        signal: controller.signal,
      })
        .then((data) => {
          if (!controller.signal.aborted) setNewCount(data.new_count);
        })
        .catch(() => undefined);
    };
    const timer = window.setInterval(check, NEW_CHECK_MS);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [since, search, enabled, topic, view]);

  useEffect(() => {
    setPane('discussion');
  }, [openId, user?.id]);

  const reload = useCallback(() => {
    setPage(1);
    setVersion((value) => value + 1);
  }, []);

  const patchPost = useCallback((id: string, patch: Partial<LoungePost>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);
  const hideAuthor = useCallback((username: string) => {
    setRows((current) => current.filter((row) => row.author?.username !== username));
  }, []);
  const startDiscussion = useCallback(() => {
    if (user) setPane('compose');
    else router.push(`/login?next=${encodeURIComponent(pathname)}`);
  }, [user, router, pathname]);

  const open = Boolean(openId) || pane !== 'discussion';

  return (
    <LoungeContext.Provider value={{ subscriber, patchPost, hideAuthor, startDiscussion, reload }}>
      <section className={styles.shell} data-open={open || undefined}>
        <PageHeader
          title="Lounge"
          description="Show off your cards, set up trades and talk about sets."
          actions={
            user ? (
              <>
                <button type="button" className={ui.btnPrimary} onClick={startDiscussion}>
                  Start a discussion
                </button>
                <MoreMenu
                  label="Lounge options"
                  items={[
                    { label: 'Saved discussions', onSelect: () => showView('saved') },
                    ...(subscriber
                      ? [{ label: 'Drafts', onSelect: () => showView('drafts') }]
                      : []),
                    { label: 'Blocked collectors', onSelect: () => setPane('blocked') },
                    { label: 'Membership', href: '/membership' },
                  ]}
                />
              </>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={ui.btnOutline}>
                Log in to join in
              </Link>
            )
          }
        />
        {!enabled ? (
          <p className={ui.muted}>The Lounge is not open yet.</p>
        ) : (
          <>
            <nav className={styles.tabs} aria-label="Lounge topics">
              {[{ id: '' as const, label: 'All topics' }, ...LOUNGE_TOPICS].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.tab}
                  aria-pressed={topic === item.id}
                  onClick={() => {
                    setTopic(item.id);
                    setView('all');
                    setPage(1);
                    setPane('discussion');
                    if (openId) router.push('/lounge');
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <div className={styles.board}>
              <DiscussionList
                view={view}
                folders={folders}
                folder={folder}
                onFolder={(value) => {
                  setFolder(value);
                  setPage(1);
                }}
                onCloseView={() => showView('all')}
                rows={rows}
                openId={openId}
                sort={sort}
                timeWindow={timeWindow}
                query={query}
                searching={Boolean(search)}
                topicLabel={LOUNGE_TOPICS.find((item) => item.id === topic)?.label ?? null}
                loading={loading}
                error={error}
                hasNext={hasNext}
                newCount={newCount}
                onSort={(value) => {
                  setSort(value);
                  setPage(1);
                }}
                onWindow={(value) => {
                  setTimeWindow(value);
                  setPage(1);
                }}
                onQuery={setQuery}
                onMore={() => setPage((value) => value + 1)}
                onReload={reload}
              />
              <div className={styles.pane}>
                {pane === 'compose' && user ? (
                  <StartDiscussion
                    defaultTopic={topic || 'other'}
                    onCancel={() => setPane('discussion')}
                    onPosted={(post) => {
                      setPane('discussion');
                      if (post.draft) showView('drafts');
                      else if ((!topic || topic === post.topic) && !search && sort !== 'top')
                        setRows((current) => [post, ...current]);
                      router.push(`/lounge/${post.id}`);
                    }}
                  />
                ) : pane === 'blocked' && user ? (
                  <BlockedList onClose={() => setPane('discussion')} onChange={reload} />
                ) : (
                  children
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </LoungeContext.Provider>
  );
}
