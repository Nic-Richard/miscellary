import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';

function icon(name: React.ComponentProps<typeof Feather>['name']) {
  return ({ color, size }: { color: string; size: number }) => (
    <Feather name={name} size={size} color={color} />
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 26 },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.sur,
          borderTopColor: colors.bdr2,
          height: 62 + Math.max(insets.bottom, 8),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          elevation: 0,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, marginTop: 3 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Browse', headerShown: false, tabBarIcon: icon('book-open') }}
      />
      <Tabs.Screen
        name="collection"
        options={{ title: 'Collection', tabBarIcon: icon('layers') }}
      />
      <Tabs.Screen name="studio" options={{ title: 'Studio', tabBarIcon: icon('edit-3') }} />
      <Tabs.Screen name="trades" options={{ title: 'Trades', tabBarIcon: icon('repeat') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
