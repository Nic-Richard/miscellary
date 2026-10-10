import { useEffect, useRef, useState } from 'react';
import { Stack, router } from 'expo-router';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LoungeCard, LoungePost, LoungeReply } from '@miscellary/shared';
import { cardCode, loungeTopicLabel, timeAgo } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import CardInspector from '@/components/CardInspector';
import { confirmBlock } from '@/components/BlockedPeople';
import CardPreview from '@/components/CardPreview';
import { Composer } from '@/components/Comments';
import InspectorModal from '@/components/InspectorModal';
import MoreButton from '@/components/MoreButton';
import ReportSheet from '@/components/ReportSheet';
import ShareButton from '@/components/ShareButton';
import SharedSurface from '@/components/SharedSurface';
import { Button, ErrorText, Loading, Muted } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { RETURN_PARAM } from '@/lib/returnTo';
import { createThemedStyles, fonts } from '@/lib/theme';
import { LoungeLike, confirmRemoval, useMutation } from './actions';
import LoungeThread from './LoungeThread';
import { lounge } from './store';

const REMOVED: Partial<LoungePost> = {
  removed: true,
  title: 'Removed post',
  body: '',
  author: null,
  author_badge: false,
  cards: [],
};

export default function Discussion({ postId }: { postId: string }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const scroll = useRef<ScrollView>(null);
  const [post, setPost] = useState<LoungePost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
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

  const mutation = useMutation<unknown>((_, path, method) => {
    if (method === 'DELETE') patch(REMOVED);
    else {
      const username = path.split('/').at(-2)!;
      lounge.emit({ type: 'hide', username });
      router.back();
    }
  });
  const replying = useMutation<LoungeReply>((reply) => {
    setAdded(reply);
    countChange(1);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  });

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
        if (!controller.signal.aborted) setPost(data);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'This discussion could not load.');
      });
    return () => controller.abort();
  }, [postId, version, user?.id]);

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

  const name = post.author?.display_name || post.author?.username || 'Deleted collector';
  const cardWidth = Math.min(120, (width - 32 - 2 * 10) / 3);
  const blockable =
    user && post.author && !post.author.deleted && post.author.username !== user.profile.username;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      // Edge-to-edge Android no longer resizes the window for the keyboard.
      behavior="padding"
      keyboardVerticalOffset={insets.top + 56}
    >
      <Stack.Screen options={{ title: loungeTopicLabel(post.topic) }} />
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.post}>
          <Text accessibilityRole="header" style={styles.title}>
            {post.title}
          </Text>
          <View style={styles.by}>
            <Avatar person={post.author} supporter={post.author_badge} size={34} />
            <View style={{ flex: 1 }}>
              <Pressable
                disabled={!post.author || post.author.deleted}
                accessibilityRole="link"
                onPress={() => post.author && router.push(`/users/${post.author.username}`)}
              >
                <Text style={styles.name}>{name}</Text>
              </Pressable>
              <Text style={styles.when}>{timeAgo(post.created_at)}</Text>
            </View>
          </View>
          {post.removed ? (
            <Muted>This discussion was removed. Its replies stay readable.</Muted>
          ) : (
            <Text style={styles.body}>{post.body}</Text>
          )}
          {post.style === 'binder' && post.cards.length > 0 ? (
            <SharedSurface
              mode="lounge-showcase"
              data={{ cards: post.cards, style: post.style }}
              autoHeight
              onEvent={(type, id) => {
                if (type === 'inspect')
                  setInspect(post.cards.find((card) => card?.id === id) ?? null);
              }}
            />
          ) : (
            post.cards.length > 0 && (
              <View style={styles.cards}>
                {post.cards.map((card, index) =>
                  card ? (
                    <Pressable
                      key={index}
                      accessibilityRole="button"
                      accessibilityLabel={`Inspect ${card.title}`}
                      onPress={() => setInspect(card)}
                    >
                      <CardPreview
                        width={cardWidth}
                        title={card.title}
                        rarity={card.rarity}
                        imageUrl={card.image?.url ?? null}
                        templateKey={card.template_key}
                        templateConfig={card.template_config}
                        code={cardCode(card.printed_set_code, card.position, card.set_total)}
                        printedText={card.printed_text}
                        render={card.render}
                      />
                    </Pressable>
                  ) : (
                    <View
                      key={index}
                      style={[styles.missing, { width: cardWidth, height: cardWidth * 1.4 }]}
                    >
                      <Muted style={styles.missingText}>No longer in this collection</Muted>
                    </View>
                  ),
                )}
              </View>
            )
          )}
          <View style={styles.actions}>
            {user && !post.removed && (
              <LoungeLike
                path={`/api/v1/lounge/posts/${post.id}/vote/`}
                liked={post.liked}
                count={post.likes}
                onChange={(liked, likes) => patch({ liked, likes })}
              />
            )}
            <ShareButton path={`/lounge/${post.id}`} title={post.title} />
            {user && !post.removed && (
              <MoreButton
                title={post.title}
                items={[
                  { label: 'Report post', icon: 'flag', onSelect: () => setReport(true) },
                  ...(blockable
                    ? [
                        {
                          label: `Block @${post.author!.username}`,
                          icon: 'slash' as const,
                          onSelect: () =>
                            confirmBlock(
                              post.author!.username,
                              () =>
                                void mutation.run(
                                  `/api/v1/me/blocks/${post.author!.username}/`,
                                  'POST',
                                ),
                            ),
                        },
                      ]
                    : []),
                  ...(post.can_delete
                    ? [
                        {
                          label: 'Remove post',
                          icon: 'trash-2' as const,
                          onSelect: () =>
                            confirmRemoval(
                              'Remove post?',
                              () => void mutation.run(`/api/v1/lounge/posts/${post.id}/`, 'DELETE'),
                            ),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </View>
          <ErrorText>{mutation.error}</ErrorText>
        </View>
        <View style={styles.replies}>
          <Text accessibilityRole="header" style={styles.repliesHead}>
            {post.reply_count
              ? `${post.reply_count} ${post.reply_count === 1 ? 'reply' : 'replies'}`
              : 'Replies'}
          </Text>
          <LoungeThread
            postId={post.id}
            removed={post.removed}
            added={added}
            onCountChange={countChange}
          />
        </View>
      </ScrollView>
      <View style={[styles.replyBar, { paddingBottom: 10 + (typing ? 0 : insets.bottom) }]}>
        {user && !post.removed ? (
          <Composer
            compact
            placeholder="Join the discussion"
            submitLabel="Reply"
            onSubmit={async (body) => {
              const done = await replying.run(
                `/api/v1/lounge/posts/${post.id}/replies/`,
                'POST',
                { body, parent_id: null },
                true,
              );
              if (!done) throw new Error('Your reply has not been posted. Please try again.');
            }}
          />
        ) : !user ? (
          <Button
            kind="secondary"
            title="Log in to join the discussion"
            onPress={() =>
              router.push(`/login?${RETURN_PARAM}=${encodeURIComponent(`/lounge/${post.id}`)}`)
            }
          />
        ) : (
          <Muted>Replies are closed.</Muted>
        )}
      </View>
      {report && (
        <ReportSheet
          visible
          subject="post"
          target={{ lounge_post_id: post.id }}
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
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 32, lineHeight: 34 },
  by: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  when: { color: colors.faint, fontFamily: fonts.body, fontSize: 13 },
  body: { color: colors.text, fontFamily: fonts.body, fontSize: 17, lineHeight: 25 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  missing: {
    padding: 8,
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.bdr2,
    backgroundColor: colors.sur2,
  },
  missingText: { fontSize: 13, lineHeight: 17, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 8 },
  replies: {
    marginHorizontal: 12,
    padding: 16,
    gap: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  repliesHead: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  replyBar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.bdr,
    backgroundColor: colors.sur,
  },
}));
