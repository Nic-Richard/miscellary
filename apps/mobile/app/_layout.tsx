import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ActivityIndicator, View } from 'react-native';
import { contrast } from '@miscellary/shared';
import SurfaceWarmup from '@/components/SurfaceWarmup';
import { AuthProvider } from '@/lib/auth';
import { colors, fonts, useColors } from '@/lib/theme';
import displayFont from '../assets/fonts/BebasNeue-Regular.ttf';
import bodyFont from '../assets/fonts/RobotoCondensed-Regular.ttf';
import mediumFont from '../assets/fonts/RobotoCondensed-SemiBold.ttf';
import playfair from '../assets/fonts/PlayfairDisplay_400Regular.ttf';
import cinzel from '../assets/fonts/Cinzel_400Regular.ttf';
import archivo from '../assets/fonts/ArchivoBlack_400Regular.ttf';
import spacemono from '../assets/fonts/SpaceMono_400Regular.ttf';
import caveat from '../assets/fonts/Caveat_400Regular.ttf';
import alfa from '../assets/fonts/AlfaSlabOne_400Regular.ttf';

// Android draws the app edge to edge, so headerless screens would scroll under the
// status bar. A strip in the page colour keeps the clock and icons readable.
function StatusBarScrim() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: insets.top,
        backgroundColor: colors.bg,
      }}
    />
  );
}

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
      <Navigation />
    </AuthProvider>
  );
}

function Navigation() {
  const colors = useColors();
  return (
    <>
      <StatusBar style={contrast('#ffffff', colors.bg) >= 4.5 ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.pageText,
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 24 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ title: '' }} />
        <Stack.Screen name="(auth)/register" options={{ title: '' }} />
        <Stack.Screen name="(auth)/forgot-password" options={{ title: 'Reset password' }} />
        <Stack.Screen name="sets/[slug]" options={{ title: '' }} />
        <Stack.Screen name="users/[username]" options={{ title: 'Profile' }} />
        <Stack.Screen name="studio/[id]" options={{ title: 'Edit set' }} />
        <Stack.Screen name="studio/card" options={{ title: 'Card', presentation: 'modal' }} />
        <Stack.Screen name="trades/new" options={{ title: 'New offer' }} />
        <Stack.Screen name="search" options={{ title: 'Search' }} />
        <Stack.Screen name="membership" options={{ title: 'Membership' }} />
      </Stack>
      <StatusBarScrim />
      <SurfaceWarmup />
    </>
  );
}
