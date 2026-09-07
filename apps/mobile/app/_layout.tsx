import { Stack, router, usePathname } from 'expo-router'
import { useEffect, useState, type ReactNode } from 'react'
import { startLearningRuntime, useBootstrapStatus } from '../src/store/bootstrap'
import { getLocales } from 'expo-localization'
import { detectNativeLanguage } from '@loro/core'
import { useApp } from '../src/store'
import { attemptWrite } from '../src/store/attemptWrite'
import { subscribeWriteErrors } from '../src/store/store'
import { useLocale } from '../src/lib/i18n'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import {
  SafeAreaProvider,
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { surface, ink, accent, space, MIN_TAP, webLayout } from '../src/ui/theme'
import { ToastHost } from '../src/ui/ToastHost'
import { useDayRollover } from '../src/store/dayRollover'
import { copy } from '../src/lib/copy'
import { devToolsAreAvailable } from '../src/dev-tools/gate'
import { ThemeProvider } from '../src/ui/ThemeProvider'
import { BottomBarProvider } from '../src/ui/BottomBarContext'
import { Pressable, Text } from '../src/ui/primitives'
import { NavigationMenu } from '../src/ui/components/NavigationMenu'
import { DESTINATIONS, placeForPath } from '../src/lib/navigation'

export default function RootLayout() {
  useLocale()
  const status = useBootstrapStatus()
  useEffect(() => {
    void startLearningRuntime()
  }, [])
  const pathname = usePathname()
  const constrainWidth = Platform.OS === 'web' && !pathname.startsWith('/dev/')
  const place = placeForPath(pathname)

  return (
    <ThemeProvider>
      <SafeAreaProvider style={styles.canvas}>
        <StatusBar style="dark" />
        <View
          testID="app-viewport"
          style={[styles.viewport, constrainWidth && styles.learnerColumn]}
        >
          {status !== 'ready' ? (
            <ScrollView contentContainerStyle={styles.bootstrap}>
              <View
                accessibilityRole={status === 'error' ? 'alert' : undefined}
                accessibilityLiveRegion="polite"
              >
                <Text variant="body" color={ink.ink}>
                  {status === 'error' ? copy.bootstrap.error : copy.bootstrap.loading}
                </Text>
              </View>
              {status === 'error' && (
                <Pressable
                  feedback="smallButton"
                  accessibilityLabel={copy.bootstrap.retry}
                  onPress={() => {
                    void startLearningRuntime()
                  }}
                  style={styles.retry}
                >
                  <Text variant="body" color={accent.accentInk}>
                    {copy.bootstrap.retry}
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          ) : (
            <ReadyApp>
              <BottomBarProvider>
                {place !== undefined && (
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
                <BelowSpine hasSpine={place !== undefined}>
                  <Stack
                    screenOptions={({ navigation }) => ({
                      headerStyle: { backgroundColor: surface.app },
                      headerTintColor: ink.ink,
                      headerTitleStyle: { fontWeight: '700' },
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
                                <Text variant="title2" color={ink.ink}>
                                  {copy.common.chevron.left}
                                </Text>
                              </Pressable>
                            ),
                          }
                        : {
                            headerLeft: () => (
                              <Pressable
                                feedback="smallButton"
                                style={{
                                  paddingHorizontal: space['3'],
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
                          }),
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
                      options={{ title: copy.nav.stream, gestureEnabled: false }}
                    />
                    <Stack.Screen name="account" options={{ title: copy.account.title }} />
                    <Stack.Screen name="languages" options={{ title: copy.languages.title }} />
                    <Stack.Screen name="progress" options={{ title: copy.nav.progress }} />
                    {devToolsAreAvailable() ? (
                      <Stack.Screen name="dev/tokens" options={{ headerShown: false }} />
                    ) : null}
                  </Stack>
                  <ToastHost />
                </BelowSpine>
              </BottomBarProvider>
            </ReadyApp>
          )}
        </View>
      </SafeAreaProvider>
    </ThemeProvider>
  )
}

/** Effects that mutate learning state must run only after core and hydration succeed. */
function ReadyApp({ children }: { children: ReactNode }) {
  const [writeFailed, setWriteFailed] = useState(false)
  useEffect(
    () =>
      subscribeWriteErrors(() => {
        setWriteFailed(true)
      }),
    [],
  )
  useEffect(() => {
    const state = useApp.getState()
    if (!state.languageChosen && !state.onboarded) {
      attemptWrite(() => {
        useApp.setState({ nativeLanguage: detectNativeLanguage(getLocales()[0]?.languageTag) })
      })
    }
  }, [])
  useDayRollover()
  return (
    <>
      {writeFailed && (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={styles.writeError}
        >
          <Text variant="bodySm" color={ink.ink}>
            {copy.persistence.error}
          </Text>
          <Pressable
            feedback="smallButton"
            accessibilityLabel={copy.a11y.common.dismiss}
            onPress={() => {
              setWriteFailed(false)
            }}
            style={styles.retry}
          >
            <Text variant="bodySm" color={accent.accentInk}>
              {copy.a11y.common.dismiss}
            </Text>
          </Pressable>
        </View>
      )}
      {children}
    </>
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
  writeError: { paddingHorizontal: space['4'], paddingVertical: space['3'] },
  bootstrap: { flexGrow: 1, justifyContent: 'center', padding: space['6'], gap: space['4'] },
  retry: { minHeight: MIN_TAP, justifyContent: 'center', paddingVertical: space['3'] },
  canvas: { backgroundColor: surface.canvas },
  viewport: { flex: 1, width: '100%', alignSelf: 'center', backgroundColor: surface.app },
  learnerColumn: { maxWidth: webLayout.learnerMaxWidth },
})
