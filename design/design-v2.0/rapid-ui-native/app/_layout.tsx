// The root: Intl for Hermes first, then the fonts and saved progress, read before the first render
// so the app never flashes an empty state (as the web prototype's main.tsx does). Until the learner
// has chosen their languages, onboarding stands in for the app.
import '../src/platform/intl';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { copyForNative } from '@shared/copy';
import { openStorage, Stored } from '@shared/state/storage';
import { usePlaybackDriver } from '../src/audio/driver';
import { Shell } from '../src/nav/Shell';
import { Onboarding } from '../src/screens/Onboarding';
import { StoreProvider, useStore } from '../src/state/store';
import { FONTS } from '../src/ui/fonts';
import { UiLocaleContext } from '../src/ui/locale';
import { colors } from '../src/ui/theme';
import { ToastProvider } from '../src/ui/Toast';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const [stored, setStored] = useState<Stored | null>(null);
  useEffect(() => {
    openStorage().then(setStored, () => setStored({ saved: null, pending: null }));
  }, []);
  const ready = (fontsLoaded || fontError !== null) && stored !== null;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StoreProvider stored={stored}>
          <App />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function App() {
  usePlaybackDriver();
  const { state } = useStore();
  const locale = copyForNative(state.learner.profile.nativeLang).locale;
  return (
    <UiLocaleContext.Provider value={locale}>
      <ToastProvider>
        <StatusBar style="dark" />
        <Shell>
          {state.learner.profile.onboarded ? (
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
              <Stack.Screen name="(tabs)" />
              {/* Full-screen overlays slide up over the tabs, as the web's player and queue do. */}
              <Stack.Screen name="player" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="queue" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="make" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
            </Stack>
          ) : (
            <Onboarding />
          )}
        </Shell>
      </ToastProvider>
    </UiLocaleContext.Provider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.surface } });
