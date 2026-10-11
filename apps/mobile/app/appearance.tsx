import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';
import LoginGate from '@/components/LoginGate';
import ThemeSelector from '@/components/ThemeSelector';
import { Muted, Panel, PanelTitle } from '@/components/ui';
import { createThemedStyles } from '@/lib/theme';

export default function AppearanceScreen() {
  const styles = useStyles();
  return (
    <LoginGate>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Appearance' }} />
        <Panel>
          <PanelTitle>Colour theme</PanelTitle>
          <Muted style={styles.note}>Saved to your account, on the website and in the app.</Muted>
          <ThemeSelector />
        </Panel>
      </ScrollView>
    </LoginGate>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 14, paddingBottom: 40 },
  note: { fontSize: 14 },
}));
