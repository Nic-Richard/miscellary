import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider } from '@/lib/auth';
import DevMenu from '@/components/DevMenu';
import { colors, fonts } from '@/lib/theme';
import displayFont from '../assets/fonts/BebasNeue-Regular.ttf';
import bodyFont from '../assets/fonts/RobotoCondensed-Regular.ttf';
import mediumFont from '../assets/fonts/RobotoCondensed-SemiBold.ttf';
import playfair from '../assets/fonts/PlayfairDisplay_400Regular.ttf';
import cinzel from '../assets/fonts/Cinzel_400Regular.ttf';
import archivo from '../assets/fonts/ArchivoBlack_400Regular.ttf';
import spacemono from '../assets/fonts/SpaceMono_400Regular.ttf';
import caveat from '../assets/fonts/Caveat_400Regular.ttf';
import alfa from '../assets/fonts/AlfaSlabOne_400Regular.ttf';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BebasNeue: displayFont,
    RobotoCondensed: bodyFont,
    'RobotoCondensed-SemiBold': mediumFont,
    PlayfairDisplay: playfair,
    Cinzel: cinzel,
    ArchivoBlack: archivo,
    SpaceMono: spacemono,
    Caveat: caveat,
    AlfaSlabOne: alfa,
  });
  if (!loaded && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.accent} accessibilityLabel="Opening Miscellary" />
      </View>
    );
  }
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.sur },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 24 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ title: 'Log in' }} />
        <Stack.Screen name="(auth)/register" options={{ title: 'Sign up' }} />
        <Stack.Screen name="sets/[slug]" options={{ title: 'Binder' }} />
        <Stack.Screen name="users/[username]" options={{ title: 'Profile' }} />
        <Stack.Screen name="studio/[id]" options={{ title: 'Edit set' }} />
        <Stack.Screen name="studio/card" options={{ title: 'Card', presentation: 'modal' }} />
        <Stack.Screen name="trades/new" options={{ title: 'New offer' }} />
        <Stack.Screen name="search" options={{ title: 'Search' }} />
      </Stack>
      <DevMenu />
    </AuthProvider>
  );
}
