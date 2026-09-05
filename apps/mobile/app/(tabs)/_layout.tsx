import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/lib/theme';

function icon(glyph: string) {
  return ({ color }: { color: string }) => <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.sur },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.sur, borderTopColor: colors.bdr },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Browse', tabBarIcon: icon('◫') }} />
      <Tabs.Screen name="collection" options={{ title: 'Collection', tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="studio" options={{ title: 'Studio', tabBarIcon: icon('✎') }} />
      <Tabs.Screen name="trades" options={{ title: 'Trades', tabBarIcon: icon('⇄') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('◯') }} />
    </Tabs>
  );
}
