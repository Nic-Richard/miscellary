import { useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { Vote } from '@miscellary/shared';
import { useAuth } from '@/lib/auth';
import { createThemedStyles, fonts, useColors } from '@/lib/theme';

export default function VoteControl({
  score,
  vote,
  label,
  onVote,
  compact = false,
}: {
  score: number;
  vote: Vote;
  label: string;
  onVote: (value: Vote) => Promise<{ score: number; my_vote: Vote }>;
  compact?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { user } = useAuth();
  const [state, setState] = useState({ score, vote });
  const [synced, setSynced] = useState({ score, vote });
  const [busy, setBusy] = useState(false);
  if (synced.score !== score || synced.vote !== vote) {
    setSynced({ score, vote });
    setState({ score, vote });
  }

  async function cast(value: 1 | -1) {
    if (!user) {
      router.push('/login');
      return;
    }
    if (busy) return;
    const next: Vote = state.vote === value ? 0 : value;
    const before = state;
    setState({ score: state.score - state.vote + next, vote: next });
    setBusy(true);
    try {
      const result = await onVote(next);
      setState({ score: result.score, vote: result.my_vote });
    } catch {
      setState(before);
    } finally {
      setBusy(false);
    }
  }

  const arrow = (value: 1 | -1) => {
    const on = state.vote === value;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value === 1 ? 'Upvote' : 'Downvote'}
        accessibilityState={{ selected: on }}
        hitSlop={6}
        onPress={() => void cast(value)}
        style={({ pressed }) => [
          styles.arrow,
          compact && styles.arrowCompact,
          on && styles.arrowOn,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Feather
          name={value === 1 ? 'arrow-up' : 'arrow-down'}
          size={compact ? 16 : 19}
          color={on ? colors.accentInk : colors.faint}
        />
      </Pressable>
    );
  };

  return (
    <View
      accessibilityLabel={`${state.score} votes for ${label}`}
      style={compact ? styles.row : styles.column}
    >
      {arrow(1)}
      <Text style={[styles.score, compact && styles.scoreCompact]}>{state.score}</Text>
      {arrow(-1)}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  column: { alignItems: 'center', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  arrow: { width: 36, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  arrowCompact: { width: 30, height: 30 },
  arrowOn: { backgroundColor: colors.sur2 },
  score: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 16,
    minWidth: 20,
    textAlign: 'center',
  },
  scoreCompact: { fontSize: 14 },
}));
