import { personName } from '@miscellary/shared';
import type { Comment } from '@miscellary/shared';
import { Link, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { deleteComment, getComments, postComment } from '@/lib/endpoints';
import { colors, fonts } from '@/lib/theme';
import DemoBadge from './DemoBadge';
import { Button, ErrorText, Input, Muted } from './ui';

const MAX = 1000;

function when(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86_400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604_800) return `${Math.floor(secs / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Composer({
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text);
      setBody('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post that.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.composer}>
      <Input
        placeholder={placeholder}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={MAX}
        style={{ minHeight: 70 }}
      />
      <ErrorText>{error}</ErrorText>
      <View style={styles.row}>
        <Button title={submitLabel} disabled={busy || !body.trim()} onPress={() => void send()} />
        {onCancel ? <Button title="Cancel" kind="secondary" onPress={onCancel} /> : null}
      </View>
    </View>
  );
}

function Entry({
  comment,
  depth,
  onReply,
  onRemove,
}: {
  comment: Comment;
  depth: number;
  onReply: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { user } = useAuth();
  const author = comment.author;

  function confirmRemove() {
    Alert.alert('Remove this comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemove(comment.id) },
    ]);
  }

  return (
    <View style={[styles.entry, depth > 0 && styles.reply]}>
      {comment.removed || !author ? (
        <Muted style={styles.removed}>This comment was removed.</Muted>
      ) : (
        <>
          <View style={styles.head}>
            {author.deleted ? (
              <Text style={[styles.author, styles.authorText]}>{personName(author)}</Text>
            ) : (
              <Link
                href={{ pathname: '/users/[username]', params: { username: author.username } }}
                style={styles.author}
              >
                <Text style={styles.authorText}>{personName(author)}</Text>
              </Link>
            )}
            {author.is_demo ? <DemoBadge /> : null}
            {comment.is_creator ? <Text style={styles.creatorMark}>Creator</Text> : null}
            <Text style={styles.when}>{when(comment.created_at)}</Text>
          </View>
          <Text style={styles.body}>{comment.body}</Text>
          <View style={styles.row}>
            {user && depth === 0 ? (
              <Pressable hitSlop={6} onPress={() => onReply(comment.id)}>
                <Text style={styles.action}>Reply</Text>
              </Pressable>
            ) : null}
            {comment.can_delete ? (
              <Pressable hitSlop={6} onPress={confirmRemove}>
                <Text style={[styles.action, { color: colors.danger }]}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}
      {comment.replies.map((r) => (
        <Entry key={r.id} comment={r} depth={depth + 1} onReply={onReply} onRemove={onRemove} />
      ))}
    </View>
  );
}

export default function Comments({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [thread, setThread] = useState<Comment[] | null>(null);
  const [count, setCount] = useState(0);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getComments(slug)
      .then((page) => {
        setThread(page.results);
        setCount(page.count);
      })
      .catch((e: Error) => setError(e.message));
  }, [slug]);

  useEffect(load, [load]);

  async function remove(id: string) {
    try {
      await deleteComment(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that.');
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Comments{count > 0 ? ` · ${count}` : ''}</Text>
      <ErrorText>{error}</ErrorText>

      {user ? (
        <Composer
          placeholder="Say something about this set"
          submitLabel="Post"
          onSubmit={async (body) => {
            await postComment(slug, body);
            load();
          }}
        />
      ) : (
        <Button
          title="Log in to comment"
          kind="secondary"
          onPress={() => router.push('/(auth)/login')}
        />
      )}

      {thread === null ? (
        <Muted>Loading…</Muted>
      ) : thread.length === 0 ? (
        <Muted>No comments yet. Be the first.</Muted>
      ) : (
        thread.map((c) => (
          <View key={c.id}>
            <Entry comment={c} depth={0} onReply={setReplyTo} onRemove={(id) => void remove(id)} />
            {replyTo === c.id ? (
              <View style={styles.replyBox}>
                <Composer
                  placeholder="Write a reply"
                  submitLabel="Reply"
                  onCancel={() => setReplyTo(null)}
                  onSubmit={async (body) => {
                    await postComment(slug, body, c.id);
                    setReplyTo(null);
                    load();
                  }}
                />
              </View>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, marginTop: 20 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 26 },
  composer: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
  entry: {
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.bdr,
  },
  reply: { marginLeft: 16, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.bdr2 },
  replyBox: { marginLeft: 16, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  author: { flexShrink: 1 },
  authorText: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  creatorMark: {
    color: colors.gold,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  when: { color: colors.faint, fontFamily: fonts.body, fontSize: 14 },
  body: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  removed: { fontStyle: 'italic' },
  action: {
    color: colors.accent,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
});
