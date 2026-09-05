import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.sur },
          headerTintColor: colors.text,
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
    </AuthProvider>
  );
}
