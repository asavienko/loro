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
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Attributes, metric, reportError, since } from '@shared/analytics/telemetry';
import { restoreContent } from '@shared/api/contentCache';
import { loadSession } from '@shared/api/session';
import { copyForNative, languageName } from '@shared/copy';
import { coursesFor, installedCourses, NATIVE_LANGUAGES } from '@shared/content';
import { openStorage, Stored } from '@shared/state/storage';
import { Analytics, useLearnerPerson } from '../src/analytics/Analytics';
import { setContext } from '../src/analytics/posthog';
import { usePlaybackDriver } from '../src/audio/driver';
import { LockScreen } from '../src/audio/lockScreen';
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

/** When the root module ran: the start of what `app_start` measures. */
const LAUNCHED = performance.now();

/** What the device holds, read once: saved progress (the packs and the session are installed as a side effect). */
async function boot(): Promise<Stored> {
  const started = performance.now();
  const [stored, courses, session] = await Promise.all([
    openStorage().catch((error: unknown) => {
      reportError('open storage', error);
      return { saved: null, pending: null };
    }),
    restoreContent().catch((error: unknown) => {
      reportError('restore content', error);
      return [];
    }),
    loadSession().catch((error: unknown) => {
      reportError('load session', error);
      return null;
    }),
  ]);
  bootMeasure = { boot_ms: since(started), had_progress: stored.saved !== null, courses_installed: courses.length, signed_in: session?.status === 'signedIn' };
  return stored;
}

/** What `boot` found, sent once with `app_start` when the first screen can show. */
let bootMeasure: Attributes | null = null;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const [stored, setStored] = useState<Stored | null>(null);
  useEffect(() => {
    void boot().then(setStored);
  }, []);
  const ready = (fontsLoaded || fontError !== null) && stored !== null;
  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync().catch(() => {});
    if (!bootMeasure) return;
    if (fontError) reportError('load fonts', fontError);
    metric('app_start', { ...bootMeasure, fonts_failed: fontError !== null, ready_ms: since(LAUNCHED) });
    bootMeasure = null;
  }, [ready, fontError]);
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={styles.root}>
      {/* The keyboard's height, as it moves, for sheets and forms (src/ui/keyboard.ts). The app is
          edge to edge already, so the provider leaves the bars as they are. */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
        <SafeAreaProvider>
          <AccountProvider>
            <Analytics>
              <StoreProvider stored={stored}>
                <App />
              </StoreProvider>
            </Analytics>
          </AccountProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function App() {
  usePlaybackDriver();
  useProgressSync();
  const { state } = useStore();
  const { nativeLang, targetLang, onboarded } = state.learner.profile;
  useEffect(() => setContext({ course: targetLang, uiLang: nativeLang, onboarded }), [targetLang, nativeLang, onboarded]);
  useLearnerPerson(state.learner);
  const locale = copyForNative(nativeLang).locale;
  return (
    <UiLocaleContext.Provider value={locale}>
      <ToastProvider>
        <StatusBar style="dark" />
        <ContentProvider targetLang={state.learner.profile.targetLang}>
          <MusicProvider>
            <LockScreen />
            <Shell>
              <Gate onboarded={state.learner.profile.onboarded} />
            </Shell>
          </MusicProvider>
        </ContentProvider>
      </ToastProvider>
    </UiLocaleContext.Provider>
  );
}

/**
 * Onboarding until the learner has chosen their languages (once the server's list of them is here;
 * it waits for the course itself at its last step, so choosing another course doesn't send it back
 * to the start); then the app once the course is installed.
 */
function Gate({ onboarded }: { onboarded: boolean }) {
  const { status, retry } = useContent();
  const { state, actions } = useStore();
  const { nativeLang, targetLang } = state.learner.profile;
  const c = copyForNative(nativeLang);
  const pathname = usePathname();
  const router = useRouter();
  // A shared link opened before onboarding (a first visit): opened once the learner is in.
  const [pending] = useState(() => (!onboarded && pathname.startsWith('/shared/') ? pathname : null));
  useEffect(() => {
    if (onboarded && pending) router.replace(pending as never);
  }, [onboarded, pending, router]);
  // The demo phrase's player opens once the screens below are mounted: pushed from onboarding,
  // there is no navigator to take it, and the whole app remounts without the finished onboarding.
  const demo = useRef(false);
  useEffect(() => {
    if (!onboarded || !demo.current) return;
    demo.current = false;
    router.push('/player');
  }, [onboarded, router]);
  if (!onboarded && NATIVE_LANGUAGES.length === 0) return <ConnectionScreen status={status === 'offline' ? 'offline' : 'loading'} onRetry={() => void retry()} />;
  if (!onboarded)
    return (
      <Onboarding
        onDemo={() => {
          demo.current = true;
        }}
      />
    );
  if (status !== 'ready') {
    const kept = installedCourses().find((lang) => lang !== targetLang && coursesFor(nativeLang).includes(lang));
    return (
      <ConnectionScreen
        status={status}
        onRetry={() => void retry()}
        fallback={kept ? { label: c.connection.useCourse(languageName(kept, c.locale)), onPress: () => actions.setProfile({ targetLang: kept }) } : undefined}
      />
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="(tabs)" />
      {/* Full-screen overlays slide up over the tabs, as the web's player and queue do, and are pulled
          back down by their top (src/ui/PullDown.tsx): the app stays underneath to be seen as they go. */}
      <Stack.Screen name="player" options={OVERLAY} />
      <Stack.Screen name="queue" options={OVERLAY} />
      <Stack.Screen name="make" options={OVERLAY} />
      <Stack.Screen name="song" options={OVERLAY} />
      <Stack.Screen name="account" options={OVERLAY} />
      <Stack.Screen name="shared/[code]" />
    </Stack>
  );
}

/** A window over the tabs: it paints its own page, so the app shows only where it is pulled away. */
const OVERLAY = { presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } } as const;

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.surface } });
