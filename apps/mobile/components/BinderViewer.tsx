import Feather from '@expo/vector-icons/Feather';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/lib/theme';
import SharedSurface from './SharedSurface';

const HINT_KEY = 'binder-swipe-hint-seen';

// `surface` gives the surface mode and its data for a spread; set binders count pages and
// profile binders count spreads, so `spreadOf` maps a page event back to a spread.
export default function BinderViewer({
  title,
  subtitle,
  spreads,
  surface,
  spreadOf,
  onClose,
  onInspect,
  onEdit,
}: {
  title: string;
  subtitle: string;
  spreads: number;
  surface: (spread: number, editing: boolean) => { mode: string; data: object };
  spreadOf: (page: number) => number;
  onClose: () => void;
  onInspect: (id: string) => void;
  /** Sleeve edits for the owner's profile binder; adds an Edit toggle. */
  onEdit?: { pick: (position: number) => void; remove: (position: number) => void };
}) {
  const insets = useSafeAreaInsets();
  const [spread, setSpread] = useState(0);
  const [hint, setHint] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    StatusBar.setHidden(true, 'fade');
    void SecureStore.getItemAsync(HINT_KEY).then((seen) => setHint(!seen && spreads > 1));
    return () => {
      StatusBar.setHidden(false, 'fade');
      void ScreenOrientation.unlockAsync();
    };
  }, [spreads]);

  function turn(next: number) {
    const target = Math.max(0, Math.min(spreads - 1, next));
    if (target === spread) return;
    setSpread(target);
    if (hint) {
      setHint(false);
      void SecureStore.setItemAsync(HINT_KEY, '1');
    }
  }

  const side = { left: Math.max(insets.left, 16), right: Math.max(insets.right, 16) };
  const bottom = Math.max(insets.bottom, 10);
  return (
    <Modal
      visible
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['landscape']}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.stage}>
        <SharedSurface
          {...surface(spread, editing)}
          onEvent={(type, value) => {
            if (type === 'inspect' && typeof value === 'string') onInspect(value);
            if (type === 'pick' && typeof value === 'number') onEdit?.pick(value);
            if (type === 'remove' && typeof value === 'number') onEdit?.remove(value);
            if (type === 'page' && typeof value === 'number') turn(spreadOf(value));
          }}
        />
        <View pointerEvents="none" style={[styles.title, { left: side.left }]}>
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {onEdit ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setEditing((on) => !on)}
            style={({ pressed }) => [
              styles.editToggle,
              { right: side.right + 56 },
              editing && styles.editOn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.editText}>{editing ? 'Done' : 'Edit'}</Text>
          </Pressable>
        ) : null}
        <Round
          label="Close binder"
          icon="x"
          onPress={onClose}
          style={{ top: 12, right: side.right }}
        />
        <Round
          label="Previous pages"
          icon="chevron-left"
          disabled={spread === 0}
          onPress={() => turn(spread - 1)}
          style={{ left: side.left, top: '50%', marginTop: -22 }}
        />
        <Round
          label="Next pages"
          icon="chevron-right"
          disabled={spread >= spreads - 1}
          onPress={() => turn(spread + 1)}
          style={{ right: side.right, top: '50%', marginTop: -22 }}
        />
        {hint ? (
          <View pointerEvents="none" style={[styles.pill, styles.hint, { bottom: bottom + 32 }]}>
            <Text style={styles.hintText}>Swipe to turn the page</Text>
          </View>
        ) : null}
        <View pointerEvents="none" style={[styles.pill, { bottom }]}>
          <Text style={styles.pillText}>
            Pages {spread * 2 + 1}–{spread * 2 + 2} of {spreads * 2}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function Round({
  label,
  icon,
  disabled,
  onPress,
  style,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  disabled?: boolean;
  onPress: () => void;
  style: object;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        style,
        { opacity: disabled ? 0.3 : pressed ? 0.7 : 1 },
      ]}
    >
      <Feather name={icon} size={22} color="#f3ecdd" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#1d1712' },
  title: { position: 'absolute', top: 12, maxWidth: '30%' },
  titleText: { color: '#f3ecdd', fontFamily: fonts.display, fontSize: 24, letterSpacing: 0.4 },
  subtitle: { color: '#c9bca8', fontFamily: fonts.body, fontSize: 12 },
  round: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 16, 12, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(246, 240, 228, 0.18)',
  },
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 16, 12, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(246, 240, 228, 0.16)',
  },
  pillText: { color: '#efe6d6', fontFamily: fonts.medium, fontSize: 12 },
  editToggle: {
    position: 'absolute',
    top: 12,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 16, 12, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(246, 240, 228, 0.18)',
  },
  editOn: { backgroundColor: '#2b8f80', borderColor: 'transparent' },
  editText: { color: '#f3ecdd', fontFamily: fonts.medium, fontSize: 15 },
  hint: { backgroundColor: '#2b8f80', borderColor: 'transparent' },
  hintText: { color: '#fff', fontFamily: fonts.medium, fontSize: 12 },
});
