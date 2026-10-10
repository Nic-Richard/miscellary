import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { LoungeCard, LoungeReply, Paginated, ReplySort } from '@miscellary/shared';
import { timeAgo } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import ReportSheet from '@/components/ReportSheet';
import type { ReportTarget } from '@/components/ReportSheet';
import { Button, ErrorText, Input, Muted, Segmented } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { editReply, voteReply } from '@/lib/lounge';
import { createThemedStyles, fonts } from '@/lib/theme';
import { confirmRemoval } from './actions';
import Cards from './Cards';
import ReplyComposer from './ReplyComposer';
import RichText from './RichText';
import VoteControl from './VoteControl';

const SORTS = [
  { value: 'top', label: 'Top' },
  { value: 'new', label: 'New' },
  { value: 'oldest', label: 'Oldest' },
] as const;

const REMOVED: Partial<LoungeReply> = {
  removed: true,
  body: '',
  author: null,
  author_badge: null,
  score: 0,
  my_vote: 0,
  cards: [],
  can_edit: false,
};

export default function LoungeThread({
  postId,
  parentId,
  removed = false,
  supporter,
  added,
  autoFocus = false,
  onInspect,
  onCountChange,
}: {
  postId: string;
  parentId?: string;
  removed?: boolean;
  supporter: boolean;
  added?: LoungeReply | null;
  autoFocus?: boolean;
  onInspect: (card: LoungeCard) => void;
  onCountChange?: (delta: number) => void;
}) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const [rows, setRows] = useState<LoungeReply[]>([]);
  const [sort, setSort] = useState<ReplySort>(parentId ? 'oldest' : 'top');
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);

  useEffect(() => {
    setRows([]);
    setPage(1);
    setReport(null);
    setOpen(null);
    setEditing(null);
  }, [user?.id, postId, sort]);

  useEffect(() => {
    if (added)
      setRows((current) =>
        current.some((row) => row.id === added.id) ? current : [...current, added],
      );
  }, [added]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), sort });
    if (parentId) params.set('parent_id', parentId);
    void apiFetch<Paginated<LoungeReply>>(
      `/api/v1/lounge/posts/${postId}/replies/?${params.toString()}`,
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
  }, [postId, parentId, page, sort, version, user?.id]);

  function patch(id: string, change: Partial<LoungeReply>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)));
  }

  async function remove(reply: LoungeReply) {
    try {
      await apiFetch(`/api/v1/lounge/replies/${reply.id}/`, { method: 'DELETE' });
      patch(reply.id, REMOVED);
      if (!reply.removed) onCountChange?.(-1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that reply.');
    }
  }

  // Replies indent once, so their cards size from the narrower column.
  const cardWidth = Math.min(96, (width - 24 - 32 - 42 - (parentId ? 14 : 0) - 2 * 8) / 3);

  return (
    <View style={styles.thread}>
      {!parentId && (
        <View style={styles.head}>
          <Text accessibilityRole="header" style={styles.heading}>
            Replies
          </Text>
          <Segmented label="Sort replies" options={SORTS} value={sort} onChange={setSort} />
        </View>
      )}
      {loading && !rows.length && <Muted>Loading replies…</Muted>}
      {!loading && !error && !rows.length && !parentId && (
        <Muted>No replies yet. Start the conversation.</Muted>
      )}
      {rows.map((reply) => (
        <View key={reply.id} style={styles.reply}>
          <Avatar person={reply.author} badge={reply.author_badge} size={32} />
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
              {reply.is_op && <Text style={styles.op}>OP</Text>}
              <Text style={styles.when}>{timeAgo(reply.created_at)}</Text>
              {reply.edited && <Text style={styles.when}>edited</Text>}
            </View>
            {editing === reply.id ? (
              <ReplyEditor
                reply={reply}
                onCancel={() => setEditing(null)}
                onSaved={(saved) => {
                  patch(reply.id, saved);
                  setEditing(null);
                }}
              />
            ) : (
              <RichText
                text={reply.removed ? 'This reply was removed.' : reply.body}
                style={[styles.body, reply.removed && styles.removedBody]}
              />
            )}
            <Cards cards={reply.cards} width={cardWidth} onInspect={onInspect} />
            {!reply.removed && (
              <View style={styles.tools}>
                <VoteControl
                  compact
                  score={reply.score}
                  vote={reply.my_vote}
                  label="this reply"
                  onVote={async (value) => {
                    const result = await voteReply(reply.id, value);
                    patch(reply.id, { score: result.score, my_vote: result.my_vote });
                    return result;
                  }}
                />
                {user && !parentId && !removed && (
                  <Tool
                    label="Reply"
                    onPress={() => {
                      setOpen(reply.id);
                      setFocus(true);
                    }}
                  />
                )}
                {reply.can_edit && <Tool label="Edit" onPress={() => setEditing(reply.id)} />}
                {user && !reply.can_edit && (
                  <Tool label="Report" onPress={() => setReport({ lounge_reply_id: reply.id })} />
                )}
                {reply.can_delete && (
                  <Tool
                    label="Remove"
                    onPress={() => confirmRemoval('Remove reply?', () => void remove(reply))}
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
                  supporter={supporter}
                  autoFocus={focus}
                  onInspect={onInspect}
                  onCountChange={(delta) => {
                    if (delta > 0) patch(reply.id, { child_count: reply.child_count + delta });
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
      <ErrorText>{error}</ErrorText>
      {error && (
        <Button
          kind="secondary"
          title="Try again"
          onPress={() => setVersion((value) => value + 1)}
        />
      )}
      {parentId && user && !removed && (
        <ReplyComposer
          postId={postId}
          parentId={parentId}
          supporter={supporter}
          autoFocus={autoFocus}
          onPosted={(reply) => {
            setRows((current) => [...current, reply]);
            onCountChange?.(1);
          }}
        />
      )}
      {report && (
        <ReportSheet visible subject="reply" target={report} onClose={() => setReport(null)} />
      )}
    </View>
  );
}

function ReplyEditor({
  reply,
  onCancel,
  onSaved,
}: {
  reply: LoungeReply;
  onCancel: () => void;
  onSaved: (reply: LoungeReply) => void;
}) {
  const styles = useStyles();
  const [body, setBody] = useState(reply.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await editReply(reply.id, body));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes.');
      setBusy(false);
    }
  }

  return (
    <View style={styles.editor}>
      <Input
        accessibilityLabel="Edit reply"
        multiline
        autoFocus
        maxLength={1000}
        value={body}
        onChangeText={setBody}
        style={{ minHeight: 70, textAlignVertical: 'top' }}
      />
      <ErrorText>{error}</ErrorText>
      <View style={styles.editorActions}>
        <Button title="Save" disabled={busy || !body.trim()} onPress={() => void save()} />
        <Button kind="secondary" title="Cancel" onPress={onCancel} />
      </View>
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
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  heading: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  reply: { flexDirection: 'row', gap: 10 },
  main: { flex: 1, gap: 6 },
  by: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  name: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  removedName: { color: colors.muted, fontFamily: fonts.medium, fontSize: 15 },
  op: {
    color: colors.accentText,
    backgroundColor: colors.accent,
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  when: { color: colors.faint, fontFamily: fonts.body, fontSize: 13 },
  body: { color: colors.text, fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  removedBody: { color: colors.muted, fontStyle: 'italic' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginLeft: -6 },
  tool: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  toolText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
  toolAccent: { color: colors.accentInk },
  children: {
    marginTop: 4,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.bdr,
    gap: 10,
  },
  editor: { gap: 8 },
  editorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
}));
