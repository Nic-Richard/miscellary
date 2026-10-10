import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { LoungeReply, Paginated } from '@miscellary/shared';
import { timeAgo } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import { Composer } from '@/components/Comments';
import ReportSheet from '@/components/ReportSheet';
import type { ReportTarget } from '@/components/ReportSheet';
import { Button, ErrorText, Muted } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { createThemedStyles, fonts } from '@/lib/theme';
import { LoungeLike, confirmRemoval, useMutation } from './actions';

export default function LoungeThread({
  postId,
  parentId,
  removed = false,
  added,
  autoFocus = false,
  onCountChange,
}: {
  postId: string;
  parentId?: string;
  removed?: boolean;
  added?: LoungeReply | null;
  autoFocus?: boolean;
  onCountChange?: (delta: number) => void;
}) {
  const styles = useStyles();
  const { user } = useAuth();
  const [rows, setRows] = useState<LoungeReply[]>([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const mutation = useMutation<LoungeReply>((result, path, method) => {
    if (method === 'POST') {
      setRows((current) => [...current, result]);
      onCountChange?.(1);
      return;
    }
    const id = path.split('/').at(-2);
    const existing = rows.find((row) => row.id === id);
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              removed: true,
              body: '',
              author: null,
              author_badge: false,
              likes: 0,
              liked: false,
            }
          : row,
      ),
    );
    if (existing && !existing.removed) onCountChange?.(-1);
  });

  useEffect(() => {
    setRows([]);
    setPage(1);
    setReport(null);
    setOpen(null);
  }, [user?.id, postId]);

  useEffect(() => {
    if (added)
      setRows((current) =>
        current.some((row) => row.id === added.id) ? current : [...current, added],
      );
  }, [added]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void apiFetch<Paginated<LoungeReply>>(
      `/api/v1/lounge/posts/${postId}/replies/?page=${page}${parentId ? `&parent_id=${parentId}` : ''}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setRows((current) => {
          if (page === 1) return data.results;
          const seen = new Set(current.map((row) => row.id));
          return [...current, ...data.results.filter((row) => !seen.has(row.id))];
        });
        setNext(Boolean(data.next));
        setError(null);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not load replies.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [postId, parentId, page, version, user?.id]);

  return (
    <View style={styles.thread}>
      {loading && !rows.length && <Muted>Loading replies…</Muted>}
      {!loading && !error && !rows.length && !parentId && (
        <Muted>No replies yet. Start the conversation.</Muted>
      )}
      {rows.map((reply) => (
        <View key={reply.id} style={styles.reply}>
          <Avatar person={reply.author} supporter={reply.author_badge} size={32} />
          <View style={styles.main}>
            <View style={styles.by}>
              {reply.author ? (
                <Pressable
                  disabled={reply.author.deleted}
                  accessibilityRole="link"
                  onPress={() => router.push(`/users/${reply.author!.username}`)}
                >
                  <Text style={styles.name}>
                    {reply.author.display_name || reply.author.username}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.removedName}>Removed</Text>
              )}
              <Text style={styles.when}>{timeAgo(reply.created_at)}</Text>
            </View>
            <Text style={[styles.body, reply.removed && styles.removedBody]}>
              {reply.removed ? 'This reply was removed.' : reply.body}
            </Text>
            {!reply.removed && user && (
              <View style={styles.tools}>
                <LoungeLike
                  path={`/api/v1/lounge/replies/${reply.id}/vote/`}
                  liked={reply.liked}
                  count={reply.likes}
                />
                {!parentId && !removed && (
                  <Tool
                    label="Reply"
                    onPress={() => {
                      setOpen(reply.id);
                      setFocus(true);
                    }}
                  />
                )}
                <Tool label="Report" onPress={() => setReport({ lounge_reply_id: reply.id })} />
                {reply.can_delete && (
                  <Tool
                    label="Remove"
                    disabled={mutation.busy}
                    onPress={() =>
                      confirmRemoval(
                        'Remove reply?',
                        () => void mutation.run(`/api/v1/lounge/replies/${reply.id}/`, 'DELETE'),
                      )
                    }
                  />
                )}
              </View>
            )}
            {!parentId && reply.child_count > 0 && open !== reply.id && (
              <Tool
                label={`Show ${reply.child_count} ${reply.child_count === 1 ? 'reply' : 'replies'}`}
                accent
                onPress={() => {
                  setOpen(reply.id);
                  setFocus(false);
                }}
              />
            )}
            {open === reply.id && (
              <View style={styles.children}>
                <LoungeThread
                  key={reply.id}
                  postId={postId}
                  parentId={reply.id}
                  removed={removed || reply.removed}
                  autoFocus={focus}
                  onCountChange={(delta) => {
                    if (delta > 0)
                      setRows((current) =>
                        current.map((row) =>
                          row.id === reply.id
                            ? { ...row, child_count: row.child_count + delta }
                            : row,
                        ),
                      );
                    onCountChange?.(delta);
                  }}
                />
                <Tool label="Hide replies" accent onPress={() => setOpen(null)} />
              </View>
            )}
          </View>
        </View>
      ))}
      {next && (
        <Button
          kind="secondary"
          title={loading ? 'Loading…' : 'More replies'}
          disabled={loading}
          onPress={() => setPage((value) => value + 1)}
        />
      )}
      <ErrorText>{error ?? mutation.error}</ErrorText>
      {error && (
        <Button
          kind="secondary"
          title="Try again"
          onPress={() => setVersion((value) => value + 1)}
        />
      )}
      {parentId && user && !removed && (
        <Composer
          compact
          autoFocus={autoFocus}
          placeholder="Reply to this thread"
          submitLabel="Reply"
          disabled={loading && !rows.length}
          onSubmit={async (body) => {
            const done = await mutation.run(
              `/api/v1/lounge/posts/${postId}/replies/`,
              'POST',
              { body, parent_id: parentId },
              true,
            );
            if (!done) throw new Error('Your reply has not been posted. Please try again.');
          }}
        />
      )}
      {report && (
        <ReportSheet visible subject="reply" target={report} onClose={() => setReport(null)} />
      )}
    </View>
  );
}

function Tool({
  label,
  onPress,
  disabled,
  accent,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.tool, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <Text style={[styles.toolText, accent && styles.toolAccent]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => ({
  thread: { gap: 14 },
  reply: { flexDirection: 'row', gap: 10 },
  main: { flex: 1, gap: 4 },
  by: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  name: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  removedName: { color: colors.muted, fontFamily: fonts.medium, fontSize: 15 },
  when: { color: colors.faint, fontFamily: fonts.body, fontSize: 13 },
  body: { color: colors.text, fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  removedBody: { color: colors.muted, fontStyle: 'italic' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 2 },
  tool: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  toolText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
  toolAccent: { color: colors.accentInk },
  children: {
    marginTop: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.bdr,
    gap: 10,
  },
}));
