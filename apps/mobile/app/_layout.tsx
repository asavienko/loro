import 'react-native-reanimated'
import { Redirect, Stack, router, usePathname } from 'expo-router'
import { useEffect, type ReactNode } from 'react'
import { getLocales } from 'expo-localization'
import { detectNativeLanguage } from '@loro/core'
import { useApp } from '../src/store'
import { useLocale } from '../src/lib/i18n'
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import {
  SafeAreaProvider,
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { surface, ink, accent, type as typeScale, MIN_TAP, webLayout } from '../src/ui/theme'
import { CHROME_GUTTER, chromeHairlineShadow, parchmentGlassStyle } from '../src/ui/parchmentGlass'
import { ToastHost } from '../src/ui/ToastHost'
import { useDayRollover } from '../src/store/dayRollover'
import { copy } from '../src/lib/copy'
import { devToolsAreAvailable } from '../src/dev-tools/gate'
import { ThemeProvider } from '../src/ui/ThemeProvider'
import { BottomBarProvider } from '../src/ui/BottomBarContext'
import { Pressable, Text } from '../src/ui/primitives'
import { NavigationMenu } from '../src/ui/components'
import {
  DESTINATIONS,
  isSessionlessPath,
  placeForPath,
  surfaceLawForPath,
} from '../src/lib/navigation'
import { startAccountSync } from '../src/services/accountSync'
import { useAccount, useAccountReady } from '../src/lib/account/runtime'
import { PersistenceGate } from '../src/store/PersistenceGate'
import { completeBrowserSignIn } from '../src/auth/runtime'
import { localTimeLabel } from '../src/lib/clock'
import { PRODUCTION_WAVES, PRODUCTION_WAVE_TIMES, type ProductionWave } from '../src/store'
import { waveEntryWithResume } from '../src/lib/waves'
import { PackBack, PackTitle } from './practice/_review/PackBack'
import { HEADER_H } from './practice/_review/geometry'

const editorialStationeryFonts =
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&display=swap'

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const loaded = document.getElementById('loro-editorial-fonts')
  if (loaded === null) {
    const link = document.createElement('link')
    link.id = 'loro-editorial-fonts'
    link.rel = 'stylesheet'
    link.href = editorialStationeryFonts
    document.head.appendChild(link)
  }
}

// The OAuth popup must notify its opener before hydration asks for the database's writer lease.
completeBrowserSignIn()

export default function RootLayout() {
  return (
    <PersistenceGate>
      <ReadyLayout />
    </PersistenceGate>
  )
}

function ReadyLayout() {
  useLocale()
  const preferences = useApp((state) => state.devicePreferences)
  const accountReady = useAccountReady()
  const signedIn = useAccount().session !== null
  useEffect(() => {
    void startAccountSync()
  }, [])
  useEffect(() => {
    const state = useApp.getState()
    if (!state.languageChosen && !state.onboarded) {
      state.previewNativeLanguage(detectNativeLanguage(getLocales()[0]?.languageTag))
    }
  }, [])
  // Mounted once, app-wide: every screen gets the new day, not just the one that
  // happened to remember to ask.
  useDayRollover()
  const pathname = usePathname()
  const surfaceLaw = surfaceLawForPath(pathname)
  const refrainResume = useApp((state) => state.refrainResume)
  const refrainWaves = useApp((state) => state.refrainWaves)
  const ongoingEntry = waveEntryWithResume(
    PRODUCTION_WAVES,
    PRODUCTION_WAVE_TIMES,
    localTimeLabel(),
    refrainWaves.filter((wave): wave is ProductionWave =>
      PRODUCTION_WAVES.includes(wave as ProductionWave),
    ),
    refrainResume,
  )
  const refrainRep =
    ongoingEntry.kind !== 'resume' || refrainResume.session === null
      ? null
      : Math.min(refrainResume.cursor + 1, refrainResume.session.plan.items.length)
  const ongoing =
    surfaceLaw?.surfaceClass === 'session' || refrainRep === null || ongoingEntry.kind !== 'resume'
      ? undefined
      : {
          heading: copy.nav.ongoing.heading,
          label: copy.nav.ongoing.refrain(refrainRep),
          onPress: () => {
            router.dismissTo({
              pathname: '/practice/refrain',
              params: { wave: ongoingEntry.wave },
            })
          },
        }
  const constrainWidth = Platform.OS === 'web' && !pathname.startsWith('/dev/')
  const place = placeForPath(pathname)
  if (!accountReady) {
    return (
      <ThemeProvider
        accent={preferences.accent}
        reducedMotion={preferences.motion === 'reduced' ? true : undefined}
      >
        <SafeAreaProvider style={styles.canvas}>
          <StatusBar style="dark" />
          <View
            testID="account-restoring"
            style={[styles.viewport, styles.restoring, constrainWidth && styles.learnerColumn]}
          >
            <ActivityIndicator
              color={accent.accentInk}
              accessibilityLabel={copy.persistence.loading}
            />
          </View>
        </SafeAreaProvider>
      </ThemeProvider>
    )
  }
  if (!signedIn && !isSessionlessPath(pathname)) {
    return <Redirect href="/account" />
  }

  return (
    <ThemeProvider
      accent={preferences.accent}
      reducedMotion={preferences.motion === 'reduced' ? true : undefined}
    >
      <SafeAreaProvider style={styles.canvas}>
        <StatusBar style="dark" />
        <View
          testID="app-viewport"
          style={[styles.viewport, constrainWidth && styles.learnerColumn]}
        >
          <BottomBarProvider>
            {place !== undefined && signedIn && (
              <NavigationMenu
                key={pathname}
                place={place}
                openLabel={copy.a11y.today.place(place)}
                title={copy.today.switcher.title}
                groupLabel={copy.today.switcher.go}
                dismissLabel={copy.a11y.common.dismiss}
                hereLabel={copy.today.switcher.here}
                reveal={copy.common.marks.reveal}
                chevron={copy.common.chevron.right}
                ongoing={ongoing}
                destinations={DESTINATIONS.map((destination) => ({
                  label: destination.label,
                  current: pathname === destination.href,
                  currentLabel: copy.a11y.today.hereNow(destination.label),
                  onPress: () => {
                    router.dismissTo(destination.href)
                  },
                }))}
              />
            )}
            <BelowSpine hasSpine={place !== undefined && signedIn}>
              <Stack
                screenOptions={({ navigation }) => ({
                  headerBackground: HeaderGlass,
                  headerStyle: { backgroundColor: 'transparent' },
                  headerTintColor: ink.ink,
                  headerTitleStyle: {
                    fontFamily: typeScale.title3.fontFamily,
                    fontSize: typeScale.title3.fontSize,
                    fontWeight: typeScale.title3.fontWeight,
                    letterSpacing: typeScale.title3.letterSpacing,
                    color: ink.ink,
                  },
                  headerLeftContainerStyle: { paddingStart: CHROME_GUTTER },
                  headerRightContainerStyle: { paddingEnd: CHROME_GUTTER },
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: surface.app },
                  // A cold URL has no stack to pop. Never strand it with an absent Back button.
                  // Warm entries retain the platform's actual Back destination and behavior.
                  ...(navigation.canGoBack()
                    ? {
                        headerLeft: () => (
                          <Pressable
                            feedback="icon"
                            accessibilityRole="link"
                            accessibilityLabel={copy.a11y.common.back}
                            onPress={() => {
                              router.back()
                            }}
                          >
                            <Text variant="body" color={accent.accentInk}>
                              {copy.common.chevron.left}
                            </Text>
                          </Pressable>
                        ),
                      }
                    : signedIn
                      ? {
                          headerLeft: () => (
                            <Pressable
                              feedback="smallButton"
                              style={{
                                minHeight: MIN_TAP,
                                justifyContent: 'center',
                              }}
                              accessibilityLabel={copy.nav.home}
                              onPress={() => {
                                router.replace('/')
                              }}
                            >
                              <Text variant="bodySm" color={accent.accentInk}>
                                {copy.nav.home}
                              </Text>
                            </Pressable>
                          ),
                        }
                      : { headerLeft: () => null }),
                })}
              >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="add" options={{ title: copy.nav.add }} />
                {/* Empty on purpose — the hero IS the title. See copy.nav.phrase. */}
                <Stack.Screen name="phrase/[id]" options={{ title: copy.nav.phrase }} />
                <Stack.Screen
                  name="practice/refrain"
                  options={{ title: copy.nav.refrain, gestureEnabled: false }}
                />
                <Stack.Screen
                  name="practice/stream"
                  options={{ title: copy.stream.queue.title, gestureEnabled: false }}
                />
                <Stack.Screen name="account" options={{ title: copy.account.title }} />
                <Stack.Screen name="settings" options={{ title: copy.settings.title }} />
                <Stack.Screen
                  name="practice/speak"
                  options={{ title: copy.audioSpeech.speakTitle, gestureEnabled: false }}
                />
                <Stack.Screen
                  name="practice/review"
                  options={({ navigation }) => ({
                    title: copy.review.title,
                    headerTitle: () => <PackTitle />,
                    gestureEnabled: false,
                    headerStyle: { height: HEADER_H, backgroundColor: 'transparent' },
                    headerLeft: () => <PackBack canGoBack={navigation.canGoBack()} />,
                  })}
                />
                <Stack.Screen name="more" options={{ title: copy.nav.more }} />
                <Stack.Screen name="music" options={{ title: copy.nav.music }} />
                <Stack.Screen name="languages" options={{ title: copy.languages.title }} />
                <Stack.Screen name="progress" options={{ title: copy.nav.progress }} />
                <Stack.Screen name="listen-export" options={{ title: copy.nav.listenExport }} />
                {devToolsAreAvailable() ? (
                  <Stack.Screen name="dev/tokens" options={{ headerShown: false }} />
                ) : null}
              </Stack>
              <ToastHost />
            </BelowSpine>
          </BottomBarProvider>
        </View>
      </SafeAreaProvider>
    </ThemeProvider>
  )
}

/** Parchment glass under the existing stack header — not a 64-px Study Desk band. */
function HeaderGlass() {
  return (
    <View
      testID="stack-header-glass"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, parchmentGlassStyle(), chromeHairlineShadow()]}
    />
  )
}

/** The shared spine already consumes the top inset; route headers must not consume it twice. */
function BelowSpine({ hasSpine, children }: { hasSpine: boolean; children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <SafeAreaInsetsContext.Provider value={hasSpine ? { ...insets, top: 0 } : insets}>
      {children}
    </SafeAreaInsetsContext.Provider>
  )
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: surface.canvas },
  viewport: { flex: 1, width: '100%', alignSelf: 'center', backgroundColor: surface.app },
  restoring: { justifyContent: 'center', alignItems: 'center' },
  learnerColumn: { maxWidth: webLayout.learnerMaxWidth },
})
