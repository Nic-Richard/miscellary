import Feather from '@expo/vector-icons/Feather';
import { COMMENT_COPY, personName, timeAgo } from '@miscellary/shared';
import type { Comment } from '@miscellary/shared';
import { Link, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { deleteComment, getComments, postComment } from '@/lib/endpoints';
import { fonts, useColors, createThemedStyles } from '@/lib/theme';
import { Button, ErrorText, Input, Muted } from './ui';

const MAX = 1000;

export function Composer({
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  disabled = false,
  compact = false,
  autoFocus = false,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = body.trim();
    if (!text || busy || disabled) return;
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

  if (compact) {
    const ready = !busy && !disabled && Boolean(body.trim());
    return (
      <View style={styles.composer}>
        <View style={styles.compact}>
          <Input
            accessibilityLabel={placeholder}
            placeholder={placeholder}
            value={body}
            onChangeText={setBody}
            multiline
            autoFocus={autoFocus}
            maxLength={MAX}
            style={styles.compactInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
            accessibilityState={{ disabled: !ready }}
            disabled={!ready}
            onPress={() => void send()}
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: ready ? colors.accent : colors.bdr, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="send" size={18} color={ready ? colors.accentText : colors.muted} />
          </Pressable>
        </View>
        <ErrorText>{error}</ErrorText>
      </View>
    );
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
        <Button
          title={submitLabel}
          disabled={busy || disabled || !body.trim()}
          onPress={() => void send()}
        />
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
  const colors = useColors();
  const styles = useStyles();
  const { user } = useAuth();
  const author = comment.author;

  function confirmRemove() {
    Alert.alert(COMMENT_COPY.removePrompt, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemove(comment.id) },
    ]);
  }

  return (
    <View style={[styles.entry, depth > 0 && styles.reply]}>
      {comment.removed || !author ? (
        <Muted style={styles.removed}>{COMMENT_COPY.removed}</Muted>
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
            {comment.is_creator ? <Text style={styles.creatorMark}>Creator</Text> : null}
            <Text style={styles.when}>{timeAgo(comment.created_at)}</Text>
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
  const styles = useStyles();
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
          placeholder={COMMENT_COPY.placeholder}
          submitLabel="Post"
          onSubmit={async (body) => {
            await postComment(slug, body);
            load();
          }}
        />
      ) : (
        <Button
          title={COMMENT_COPY.logInToComment}
          kind="secondary"
          onPress={() => router.push('/(auth)/login')}
        />
      )}

      {thread === null ? (
        <Muted>Loading…</Muted>
      ) : thread.length === 0 ? (
        <Muted>{COMMENT_COPY.empty}</Muted>
      ) : (
        thread.map((c) => (
          <View key={c.id}>
            <Entry comment={c} depth={0} onReply={setReplyTo} onRemove={(id) => void remove(id)} />
            {replyTo === c.id ? (
              <View style={styles.replyBox}>
                <Composer
                  placeholder={COMMENT_COPY.replyTo(c.author ? personName(c.author) : 'Someone')}
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

const useStyles = createThemedStyles((colors) => ({
  root: { gap: 10, marginTop: 20 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 26 },
  composer: { gap: 8 },
  compact: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  compactInput: { flex: 1, minHeight: 44, maxHeight: 120, paddingVertical: 10 },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
}));
