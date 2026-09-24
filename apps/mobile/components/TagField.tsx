import { TAG_LABEL_MAX } from '@miscellary/shared';
import type { Tag, TagSummary } from '@miscellary/shared';
import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { listTags } from '@/lib/endpoints';
import { colors, fonts } from '@/lib/theme';
import { ErrorText, Input, Muted } from './ui';

export default function TagField({
  tags,
  max,
  note,
  onSave,
}: {
  tags: Tag[];
  max: number;
  note?: string;
  onSave: (labels: string[]) => Promise<Tag[]>;
}) {
  const [current, setCurrent] = useState<Tag[]>(tags);
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<TagSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Submitting and the blur that follows it can both reach `add` before `busy`
  // has re-rendered, and two writes at once would replace the same list twice.
  const saving = useRef(false);

  useEffect(() => setCurrent(tags), [tags]);

  useEffect(() => {
    const term = draft.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    // Let typing settle before asking, and drop a reply the next keystroke outran.
    let live = true;
    const timer = setTimeout(() => {
      listTags(term)
        .then((found) => live && setSuggestions(found))
        .catch(() => live && setSuggestions([]));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [draft]);

  async function commit(labels: string[]) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      setCurrent(await onSave(labels));
      setDraft('');
      setSuggestions([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save those tags.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function add(label: string) {
    const text = label.trim();
    if (!text || saving.current || current.length >= max) return;
    if (current.some((t) => t.label.toLowerCase() === text.toLowerCase())) {
      setDraft('');
      return;
    }
    void commit([...current.map((t) => t.label), text]);
  }

  const unused = suggestions.filter((s) => !current.some((t) => t.slug === s.slug));

  return (
    <View style={styles.root}>
      {current.length ? (
        <View style={styles.row}>
          {current.map((tag) => (
            <View key={tag.slug} style={styles.chip}>
              <Text style={styles.chipText}>{tag.label}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${tag.label}`}
                disabled={busy}
                hitSlop={8}
                onPress={() =>
                  void commit(current.filter((t) => t.slug !== tag.slug).map((t) => t.label))
                }
              >
                <Feather name="x" size={14} color={colors.faint} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {current.length < max ? (
        <Input
          accessibilityLabel="Add a tag"
          placeholder={current.length ? 'Add another tag' : 'beetles, macro, garden…'}
          value={draft}
          onChangeText={setDraft}
          maxLength={TAG_LABEL_MAX}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          editable={!busy}
          onSubmitEditing={() => add(draft)}
          onBlur={() => add(draft)}
        />
      ) : null}

      {unused.length ? (
        <View style={styles.row}>
          {unused.slice(0, 6).map((s) => (
            <Pressable
              key={s.slug}
              accessibilityRole="button"
              onPress={() => add(s.label)}
              style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.suggestionText}>
                {s.label} · {s.set_count}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Muted style={styles.note}>
        {note ?? `Up to ${max}. Tags are how people find this by subject.`}
      </Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: colors.sur2,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
  },
  chipText: { color: colors.text, fontFamily: fonts.body, fontSize: 14 },
  suggestion: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.bdr2,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  suggestionText: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  note: { fontSize: 14 },
});
