import { useEffect, useRef, useState } from 'react';
import { Stack, router } from 'expo-router';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  LoungeCard,
  LoungePost,
  LoungeReply,
  LoungeTopic,
  UserSummary,
} from '@miscellary/shared';
import { LOUNGE_TOPICS, loungeTopicLabel, timeAgo } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import CardInspector from '@/components/CardInspector';
import { confirmBlock } from '@/components/BlockedPeople';
import InspectorModal from '@/components/InspectorModal';
import MoreButton from '@/components/MoreButton';
import type { MoreItem } from '@/components/MoreButton';
import ReportSheet from '@/components/ReportSheet';
import ShareButton from '@/components/ShareButton';
import SharedSurface from '@/components/SharedSurface';
import { Button, Chip, ErrorText, Input, Loading, Muted } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { setBlocked, setFollow } from '@/lib/endpoints';
import { editPost, userSummary, votePost } from '@/lib/lounge';
import { useMembership } from '@/lib/membership';
import { RETURN_PARAM } from '@/lib/returnTo';
import { createThemedStyles, fonts } from '@/lib/theme';
import { confirmRemoval } from './actions';
import Cards from './Cards';
import LoungeThread from './LoungeThread';
import ReplyComposer from './ReplyComposer';
import RichText from './RichText';
import SaveButton from './SaveButton';
import VoteControl from './VoteControl';
import { lounge } from './store';

const REMOVED: Partial<LoungePost> = {
  removed: true,
  title: 'Removed post',
  body: '',
  author: null,
  author_badge: null,
  cards: [],
  can_edit: false,
};

export default function Discussion({ postId }: { postId: string }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { supporter } = useMembership();
  const scroll = useRef<ScrollView>(null);
  const [post, setPost] = useState<LoungePost | null>(null);
  const [author, setAuthor] = useState<UserSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [added, setAdded] = useState<LoungeReply | null>(null);
  const [report, setReport] = useState(false);
  const [inspect, setInspect] = useState<LoungeCard | null>(null);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setTyping(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setTyping(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  function patch(change: Partial<LoungePost>) {
    setPost((current) => (current ? { ...current, ...change } : current));
    lounge.emit({ type: 'patch', id: postId, patch: change });
  }

  function countChange(delta: number) {
    setPost((current) => {
      if (!current) return current;
      const reply_count = Math.max(0, current.reply_count + delta);
      lounge.emit({ type: 'patch', id: postId, patch: { reply_count } });
      return { ...current, reply_count };
    });
  }

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void apiFetch<LoungePost>(`/api/v1/lounge/posts/${postId}/`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setPost(data);
        // Opening it marks new replies as read in the list.
        if (data.unread) lounge.emit({ type: 'patch', id: postId, patch: { unread: false } });
        if (data.author && !data.author.deleted && user)
          void userSummary(data.author.username)
            .then((summary) => {
              if (!controller.signal.aborted) setAuthor(summary);
            })
            .catch(() => undefined);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'This discussion could not load.');
      });
    return () => controller.abort();
  }, [postId, version, user]);

  async function run(action: () => Promise<void>, fallback: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  if (!post)
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Discussion' }} />
        {error ? (
          <View style={styles.padded}>
            <ErrorText>{error}</ErrorText>
            <Button kind="secondary" title="Try again" onPress={() => setVersion((v) => v + 1)} />
          </View>
        ) : (
          <Loading />
        )}
      </View>
    );

  const current = post;
  const name = current.author?.display_name || current.author?.username || 'Deleted collector';
  const own = Boolean(user && current.author?.username === user.profile.username);
  const cardWidth = Math.min(120, (width - 24 - 32 - 2 * 10) / 3);

  const publish = () =>
    run(async () => {
      const published = await editPost(current.id, { publish: true });
      setPost(published);
      lounge.emit({ type: 'posted', post: published });
    }, 'Could not publish this draft.');

  const remove = () =>
    run(async () => {
      await apiFetch(`/api/v1/lounge/posts/${current.id}/`, { method: 'DELETE' });
      if (current.draft) {
        lounge.emit({ type: 'patch', id: current.id, patch: { removed: true, draft: false } });
        router.back();
      } else patch(REMOVED);
    }, 'Could not remove this post.');

  const block = () =>
    run(async () => {
      const username = current.author!.username;
      await setBlocked(username, true);
      lounge.emit({ type: 'hide', username });
      router.back();
    }, 'Could not block that collector.');

  const follow = () =>
    run(async () => {
      if (!author) return;
      const result = await setFollow(author.username, !author.is_following);
      setAuthor({
        ...author,
        is_following: result.following,
        follower_count: result.follower_count,
      });
      void userSummary(author.username, true);
    }, 'Could not follow that collector.');

  const more: MoreItem[] = [
    ...(current.can_edit
      ? [{ label: 'Edit post', icon: 'edit-2' as const, onSelect: () => setEditing(true) }]
      : []),
    ...(!own
      ? [{ label: 'Report post', icon: 'flag' as const, onSelect: () => setReport(true) }]
      : []),
    ...(current.author && !current.author.deleted && !own
      ? [
          {
            label: `Block @${current.author.username}`,
            icon: 'slash' as const,
            onSelect: () => confirmBlock(current.author!.username, () => void block()),
          },
        ]
      : []),
    ...(current.can_delete
      ? [
          {
            label: current.draft ? 'Delete draft' : 'Remove post',
            icon: 'trash-2' as const,
            onSelect: () =>
              current.draft
                ? Alert.alert('Delete this draft?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => void remove() },
                  ])
                : confirmRemoval('Remove post?', () => void remove()),
          },
        ]
      : []),
  ];

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      // Edge-to-edge Android no longer resizes the window for the keyboard.
      behavior="padding"
      keyboardVerticalOffset={insets.top + 56}
    >
      <Stack.Screen
        options={{ title: current.draft ? 'Draft' : loungeTopicLabel(current.topic) }}
      />
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.post}>
          {current.draft && (
            <View style={styles.draft}>
              <Text style={styles.draftText}>Draft. Only you can see it until you publish.</Text>
              <Button title="Publish" disabled={busy} onPress={() => void publish()} />
            </View>
          )}
          <View style={styles.by}>
            <Avatar person={current.author} badge={current.author_badge} size={34} />
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Pressable
                  disabled={!current.author || current.author.deleted}
                  accessibilityRole="link"
                  onPress={() => current.author && router.push(`/users/${current.author.username}`)}
                >
                  <Text style={styles.name}>{name}</Text>
                </Pressable>
                {author && !author.is_me && !author.is_following && !author.is_blocked && (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    disabled={busy}
                    onPress={() => void follow()}
                  >
                    <Text style={styles.follow}>Follow</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.when}>
                {timeAgo(current.created_at)}
                {current.edited ? ', edited' : ''}
              </Text>
            </View>
          </View>
          {editing ? (
            <PostEditor
              post={current}
              onCancel={() => setEditing(false)}
              onSaved={(saved) => {
                patch(saved);
                setEditing(false);
              }}
            />
          ) : (
            <>
              <Text accessibilityRole="header" style={styles.title}>
                {current.title}
              </Text>
              {current.removed ? (
                <Muted>This discussion was removed. Its replies stay readable.</Muted>
              ) : (
                <RichText text={current.body} style={styles.body} />
              )}
            </>
          )}
          {current.style === 'binder' && current.cards.length > 0 ? (
            <SharedSurface
              mode="lounge-showcase"
              data={{ cards: current.cards, style: current.style }}
              autoHeight
              onEvent={(type, id) => {
                if (type === 'inspect')
                  setInspect(current.cards.find((card) => card?.id === id) ?? null);
              }}
            />
          ) : (
            <Cards cards={current.cards} width={cardWidth} onInspect={setInspect} />
          )}
          <View style={styles.actions}>
            {!current.draft && !current.removed && (
              <VoteControl
                compact
                score={current.score}
                vote={current.my_vote}
                label={current.title}
                onVote={async (value) => {
                  const result = await votePost(current.id, value);
                  patch({ score: result.score, my_vote: result.my_vote });
                  return result;
                }}
              />
            )}
            {user && !current.removed && !current.draft && (
              <SaveButton
                postId={current.id}
                saved={current.saved}
                folderId={current.saved_folder}
                supporter={supporter}
                onChange={(saved, folder) => patch({ saved, saved_folder: folder })}
              />
            )}
            {!current.draft && <ShareButton path={`/lounge/${current.id}`} title={current.title} />}
            {user && !current.removed && <MoreButton title={current.title} items={more} />}
          </View>
          <ErrorText>{error}</ErrorText>
        </View>
        {!current.draft && (
          <View style={styles.replies}>
            <LoungeThread
              postId={current.id}
              removed={current.removed}
              supporter={supporter}
              added={added}
              onInspect={setInspect}
              onCountChange={countChange}
            />
          </View>
        )}
      </ScrollView>
      {!current.draft && (
        <View style={[styles.replyBar, { paddingBottom: 10 + (typing ? 0 : insets.bottom) }]}>
          {user && !current.removed ? (
            <ReplyComposer
              postId={current.id}
              supporter={supporter}
              onPosted={(reply) => {
                setAdded(reply);
                countChange(1);
                setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
              }}
            />
          ) : !user ? (
            <Button
              kind="secondary"
              title="Log in to join the discussion"
              onPress={() =>
                router.push(`/login?${RETURN_PARAM}=${encodeURIComponent(`/lounge/${current.id}`)}`)
              }
            />
          ) : (
            <Muted>Replies are closed.</Muted>
          )}
        </View>
      )}
      {report && (
        <ReportSheet
          visible
          subject="post"
          target={{ lounge_post_id: current.id }}
          onClose={() => setReport(false)}
        />
      )}
      <InspectorModal open={inspect !== null} onClose={() => setInspect(null)}>
        {inspect && (
          <CardInspector
            card={inspect}
            setTitle={inspect.set_title}
            setSlug={inspect.set_slug}
            mark={inspect.set_mark}
            packColour={inspect.set_pack_colour}
            creator={inspect.set_creator}
            onClose={() => setInspect(null)}
          />
        )}
      </InspectorModal>
    </KeyboardAvoidingView>
  );
}

function PostEditor({
  post,
  onCancel,
  onSaved,
}: {
  post: LoungePost;
  onCancel: () => void;
  onSaved: (post: LoungePost) => void;
}) {
  const styles = useStyles();
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [topic, setTopic] = useState<LoungeTopic>(post.topic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await editPost(post.id, { title, body, topic }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes.');
      setBusy(false);
    }
  }

  return (
    <View style={styles.editor}>
      <Input accessibilityLabel="Title" maxLength={120} value={title} onChangeText={setTitle} />
      <Input
        accessibilityLabel="Post"
        multiline
        maxLength={3000}
        value={body}
        onChangeText={setBody}
        style={{ minHeight: 120, textAlignVertical: 'top' }}
      />
      <View style={styles.topics} accessibilityRole="radiogroup" accessibilityLabel="Topic">
        {LOUNGE_TOPICS.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            active={topic === item.id}
            onPress={() => setTopic(item.id)}
          />
        ))}
      </View>
      <ErrorText>{error}</ErrorText>
      <View style={styles.editorActions}>
        <Button
          title="Save changes"
          disabled={busy || !title.trim() || !body.trim()}
          onPress={() => void save()}
        />
        <Button kind="secondary" title="Cancel" onPress={onCancel} />
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: 16, gap: 10 },
  content: { paddingBottom: 24 },
  post: {
    margin: 12,
    padding: 16,
    gap: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  draft: {
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: colors.sur2,
  },
  draftText: { color: colors.text, fontFamily: fonts.body, fontSize: 15 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 32, lineHeight: 34 },
  by: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  name: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  follow: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 14 },
  when: { color: colors.faint, fontFamily: fonts.body, fontSize: 13 },
  body: { color: colors.text, fontFamily: fonts.body, fontSize: 17, lineHeight: 25 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  replies: {
    marginHorizontal: 12,
    padding: 16,
    gap: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  replyBar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  editor: { gap: 10 },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
}));
