// The root: Intl for Hermes first, then the fonts, saved progress, the content packs this device has
// and who is signed in, all read before the first render so the app never flashes an empty state.
// The course's content comes from the API (plan 106): until a copy of it is installed, the app says
// it is getting it, or that the server can't be reached. Until the learner has chosen their
// languages, onboarding stands in for the app.
import '../src/platform/intl';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { restoreContent } from '@shared/api/contentCache';
import { loadSession } from '@shared/api/session';
import { copyForNative } from '@shared/copy';
import { openStorage, Stored } from '@shared/state/storage';
import { Analytics } from '../src/analytics/Analytics';
import { usePlaybackDriver } from '../src/audio/driver';
import { MusicProvider } from '../src/music/MusicPlayer';
import { Shell } from '../src/nav/Shell';
import { ConnectionScreen } from '../src/screens/ConnectionScreen';
import { Onboarding } from '../src/screens/Onboarding';
import { AccountProvider } from '../src/state/account';
import { ContentProvider, useContent } from '../src/state/content';
import { useProgressSync } from '../src/state/progressSync';
import { StoreProvider, useStore } from '../src/state/store';
import { FONTS } from '../src/ui/fonts';
import { UiLocaleContext } from '../src/ui/locale';
import { colors } from '../src/ui/theme';
import { ToastProvider } from '../src/ui/Toast';

void SplashScreen.preventAutoHideAsync().catch(() => {});

/** What the device holds, read once: saved progress (the packs and the session are installed as a side effect). */
async function boot(): Promise<Stored> {
  const [stored] = await Promise.all([
    openStorage().catch(() => ({ saved: null, pending: null })),
    restoreContent().catch(() => []),
    loadSession().catch(() => null),
  ]);
  return stored;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const [stored, setStored] = useState<Stored | null>(null);
  useEffect(() => {
    void boot().then(setStored);
  }, []);
  const ready = (fontsLoaded || fontError !== null) && stored !== null;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AccountProvider>
          <Analytics>
            <StoreProvider stored={stored}>
              <App />
            </StoreProvider>
          </Analytics>
        </AccountProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function App() {
  usePlaybackDriver();
  useProgressSync();
  const { state } = useStore();
  const locale = copyForNative(state.learner.profile.nativeLang).locale;
  return (
    <UiLocaleContext.Provider value={locale}>
      <ToastProvider>
        <StatusBar style="dark" />
        <ContentProvider targetLang={state.learner.profile.targetLang}>
          <MusicProvider>
            <Shell>
              <Gate onboarded={state.learner.profile.onboarded} />
            </Shell>
          </MusicProvider>
        </ContentProvider>
      </ToastProvider>
    </UiLocaleContext.Provider>
  );
}

/** The app once the course is installed; onboarding before the learner has chosen their languages. */
function Gate({ onboarded }: { onboarded: boolean }) {
  const { status, refresh } = useContent();
  const pathname = usePathname();
  const router = useRouter();
  // A shared link opened before onboarding (a first visit): opened once the learner is in.
  const [pending] = useState(() => (!onboarded && pathname.startsWith('/shared/') ? pathname : null));
  useEffect(() => {
    if (onboarded && pending) router.replace(pending as never);
  }, [onboarded, pending, router]);
  if (status !== 'ready') return <ConnectionScreen status={status} onRetry={() => void refresh()} />;
  if (!onboarded) return <Onboarding />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="(tabs)" />
      {/* Full-screen overlays slide up over the tabs, as the web's player and queue do. */}
      <Stack.Screen name="player" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="queue" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="make" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="song" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: colors.surface } }} />
      <Stack.Screen name="account" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="shared/[code]" />
    </Stack>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.surface } });
