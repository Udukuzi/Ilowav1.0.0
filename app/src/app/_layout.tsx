// Polyfills must be first — order matters
import 'react-native-get-random-values';
import '../polyfills';

import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { RegionProvider } from '../hooks/useRegion';

export default function RootLayout() {
  return (
    <RegionProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0A0A0F' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="market/[id]"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="radio/call-in"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
        <Stack.Screen
          name="podcast/[id]"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="settings/region"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="settings/voice"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
    </RegionProvider>
  );
}
