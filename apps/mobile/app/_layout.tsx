import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { surface, ink } from '../src/ui/theme'
import { ToastHost } from '../src/ui/ToastHost'
import { useDayRollover } from '../src/store/dayRollover'
import { copy } from '../src/lib/copy'
import { devToolsAreAvailable } from '../src/dev-tools/gate'
import { ThemeProvider } from '../src/ui/ThemeProvider'

export default function RootLayout() {
  // Mounted once, app-wide: every screen gets the new day, not just the one that
  // happened to remember to ask.
  useDayRollover()

  return (
    <ThemeProvider>
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
          <Stack.Screen name="add" options={{ title: copy.nav.add }} />
          {/* Empty on purpose — the hero IS the title. See copy.nav.phrase. */}
          <Stack.Screen name="phrase/[id]" options={{ title: copy.nav.phrase }} />
          <Stack.Screen name="practice/refrain" options={{ title: copy.nav.refrain }} />
          <Stack.Screen name="practice/stream" options={{ title: copy.nav.stream }} />
          <Stack.Screen name="progress" options={{ title: copy.nav.progress }} />
          {devToolsAreAvailable() ? (
            <Stack.Screen name="dev/tokens" options={{ headerShown: false }} />
          ) : null}
        </Stack>
        <ToastHost />
      </SafeAreaProvider>
    </ThemeProvider>
  )
}
