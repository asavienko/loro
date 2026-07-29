import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { surface, ink } from '../src/ui/theme'
import { ToastHost } from '../src/ui/ToastHost'
import { useDayRollover } from '../src/store/dayRollover'

export default function RootLayout() {
  // Mounted once, app-wide: every screen gets the new day, not just the one that
  // happened to remember to ask.
  useDayRollover()

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: surface.app },
          headerTintColor: ink.ink,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: surface.app },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ title: 'Add phrases' }} />
        <Stack.Screen name="phrase/[id]" options={{ title: '' }} />
        <Stack.Screen name="practice/refrain" options={{ title: 'The Refrain' }} />
        <Stack.Screen name="practice/stream" options={{ title: 'Stream' }} />
        <Stack.Screen name="progress" options={{ title: 'Progress' }} />
      </Stack>
      <ToastHost />
    </SafeAreaProvider>
  )
}
