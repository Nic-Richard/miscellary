import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';

function icon(name: React.ComponentProps<typeof Feather>['name']) {
  return ({ color, size }: { color: string; size: number }) => (
    <Feather name={name} size={size} color={color} />
  );
}

function cardsIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7 4h10v16H7Zm-3 3h1v10H4Zm15 0h1v10h-1ZM10 8h4M10 11h4"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
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
      <Tabs.Screen name="collection" options={{ title: 'My cards', tabBarIcon: cardsIcon }} />
      <Tabs.Screen name="trades" options={{ title: 'Trades', tabBarIcon: icon('repeat') }} />
      <Tabs.Screen name="studio" options={{ title: 'Studio', tabBarIcon: icon('edit-3') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
