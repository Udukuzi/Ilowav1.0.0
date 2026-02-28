import { Stack } from 'expo-router';
import { ILOWA_COLORS } from '../../theme/colors';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: ILOWA_COLORS.deepBlack },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="wallet" />
      <Stack.Screen name="region" />
      <Stack.Screen name="language" />
      <Stack.Screen name="reveal" />
      <Stack.Screen name="guardians" />
    </Stack>
  );
}
