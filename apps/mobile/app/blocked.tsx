import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import BlockedPeople from '@/components/BlockedPeople';
import LoginGate from '@/components/LoginGate';
import { createThemedStyles } from '@/lib/theme';

export default function BlockedScreen() {
  const styles = useStyles();
  return (
    <LoginGate>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Blocked collectors' }} />
        <View style={styles.panel}>
          <BlockedPeople />
        </View>
      </ScrollView>
    </LoginGate>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 12 },
  panel: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
}));
