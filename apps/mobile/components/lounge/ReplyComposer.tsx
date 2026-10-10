import { useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import type { LoungeReply, OwnedCard } from '@miscellary/shared';
import { LOUNGE_LIMITS } from '@miscellary/shared';
import Sheet from '@/components/Sheet';
import { Button, ErrorText, Input } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { createThemedStyles, fonts, useColors } from '@/lib/theme';
import CardPicker from './CardPicker';

export default function ReplyComposer({
  postId,
  parentId,
  supporter,
  autoFocus = false,
  onPosted,
}: {
  postId: string;
  parentId?: string | undefined;
  supporter: boolean;
  autoFocus?: boolean;
  onPosted: (reply: LoungeReply) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [body, setBody] = useState('');
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = supporter ? LOUNGE_LIMITS.supporterReplyCards : LOUNGE_LIMITS.replyCards;
  const ready = !busy && Boolean(body.trim());
  const placeholder = parentId ? 'Reply to this thread' : 'Join the discussion';

  async function send() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const reply = await apiFetch<LoungeReply>(`/api/v1/lounge/posts/${postId}/replies/`, {
        method: 'POST',
        body: { body: body.trim(), parent_id: parentId ?? null, card_ids: cards.map((c) => c.id) },
      });
      onPosted(reply);
      setBody('');
      setCards([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your reply has not been posted.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.composer}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cards.length ? `${cards.length} cards attached` : 'Add cards'}
          onPress={() => setPicking(true)}
          style={({ pressed }) => [
            styles.attach,
            cards.length > 0 && styles.attachOn,
            pressed && { opacity: 0.75 },
          ]}
        >
          <Feather name="layers" size={18} color={cards.length ? colors.accentInk : colors.muted} />
          {cards.length > 0 && <Text style={styles.attachCount}>{cards.length}</Text>}
        </Pressable>
        <Input
          accessibilityLabel={placeholder}
          placeholder={placeholder}
          value={body}
          onChangeText={setBody}
          multiline
          autoFocus={autoFocus}
          maxLength={1000}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reply"
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
      <Sheet
        visible={picking}
        title="Add cards"
        onClose={() => setPicking(false)}
        footer={<Button title="Done" onPress={() => setPicking(false)} style={{ flex: 1 }} />}
      >
        <CardPicker max={max} selected={cards} onChange={setCards} />
      </Sheet>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  composer: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingVertical: 10 },
  attach: {
    flexDirection: 'row',
    gap: 3,
    minWidth: 44,
    height: 44,
    paddingHorizontal: 8,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.bdr2,
    backgroundColor: colors.sur,
  },
  attachOn: { borderColor: colors.accent, backgroundColor: colors.sur2 },
  attachCount: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 14 },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
