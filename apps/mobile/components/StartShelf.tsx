import type { CardSetSummary } from '@miscellary/shared';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import PackPreview from '@/components/PackPreview';
import { Button, ErrorText } from '@/components/ui';
import { followSet } from '@/lib/endpoints';
import { fonts, useColors, createThemedStyles } from '@/lib/theme';

const GAP = 14;

export default function StartShelf({
  sets,
  onFollowedChange,
}: {
  sets: CardSetSummary[];
  onFollowedChange: (count: number) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [shelfWidth, setShelfWidth] = useState(0);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const packWidth = Math.floor((shelfWidth - GAP) / 2);

  useEffect(() => onFollowedChange(followed.size), [followed, onFollowedChange]);

  async function toggle(slug: string) {
    if (pending.has(slug)) return;
    const next = !followed.has(slug);
    const flip = (on: boolean) =>
      setFollowed((current) => {
        const copy = new Set(current);
        if (on) copy.add(slug);
        else copy.delete(slug);
        return copy;
      });
    flip(next);
    setPending((current) => new Set(current).add(slug));
    setError(null);
    try {
      await followSet(slug, next);
    } catch (e) {
      flip(!next);
      setError(e instanceof Error ? e.message : 'Could not follow that set.');
    } finally {
      setPending((current) => {
        const copy = new Set(current);
        copy.delete(slug);
        return copy;
      });
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Choose your first sets</Text>
      <Text style={styles.lead}>
        Every set you follow gives you a free pack each day. Pick a few to start your collection.
      </Text>

      <View
        style={styles.shelf}
        onLayout={(event) => setShelfWidth(event.nativeEvent.layout.width)}
      >
        {shelfWidth > 0 &&
          sets.map((set) => {
            const on = followed.has(set.slug);
            return (
              <Pressable
                key={set.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${on ? 'Stop following' : 'Follow'} ${set.title}`}
                onPress={() => void toggle(set.slug)}
                style={{ width: packWidth }}
              >
                <View style={[styles.pack, on && styles.packOn]}>
                  <PackPreview set={set} width={packWidth - (on ? 6 : 0)} />
                  {on ? (
                    <View style={styles.check}>
                      <Feather name="check" size={16} color={colors.accentText} />
                    </View>
                  ) : null}
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {set.title}
                </Text>
                <Text style={on ? styles.metaOn : styles.meta}>
                  {on ? 'Following' : `${set.card_count} cards`}
                </Text>
              </Pressable>
            );
          })}
      </View>

      <ErrorText>{error}</ErrorText>
      <Button title="Browse every set" kind="secondary" onPress={() => router.push('/(tabs)')} />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  root: {
    gap: 14,
    padding: 20,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderRadius: 8,
  },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 26 },
  lead: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  shelf: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingBottom: 14,
    borderBottomWidth: 6,
    borderBottomColor: colors.bdr2,
  },
  pack: { marginBottom: 6, borderRadius: 4, overflow: 'hidden' },
  packOn: { borderWidth: 3, borderColor: colors.accent },
  name: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  meta: { color: colors.faint, fontFamily: fonts.body, fontSize: 14 },
  metaOn: { color: colors.accent, fontFamily: fonts.medium, fontSize: 14 },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
}));
