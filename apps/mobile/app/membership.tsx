import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';
import LoginGate from '@/components/LoginGate';
import MembershipPanel from '@/components/MembershipPanel';
import { createThemedStyles } from '@/lib/theme';

export default function MembershipScreen() {
  const styles = useStyles();
  return (
    <LoginGate note="Supporters get bonus packs, tickets every month and extra room in the Lounge.">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Membership' }} />
        <MembershipPanel />
      </ScrollView>
    </LoginGate>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 12, paddingBottom: 40 },
}));
