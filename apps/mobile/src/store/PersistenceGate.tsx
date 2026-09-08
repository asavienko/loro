import { useEffect, type ReactNode } from 'react'
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { copy } from '../lib/copy'
import { useLocale } from '../lib/i18n'
import { Pressable, Text } from '../ui/primitives'
import { accent, ink, MIN_TAP, space, surface, webLayout } from '../ui/theme'
import { ThemeProvider } from '../ui/ThemeProvider'
import { initializeAppPersistence, usePersistence } from './persistence'

/** Prevent onboarding effects and practice actions from running before durable hydration. */
export function PersistenceGate({ children }: { children: ReactNode }) {
  useLocale()
  const status = usePersistence((state) => state.status)
  useEffect(() => {
    void initializeAppPersistence()
  }, [])
  if (status === 'ready') return children
  return (
    <ThemeProvider>
      <View style={styles.canvas}>
        <View
          testID="app-viewport"
          style={[styles.viewport, Platform.OS === 'web' && styles.webColumn]}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            testID={status === 'error' ? 'storage-error' : 'storage-opening'}
          >
            {status === 'opening' ? (
              <>
                <ActivityIndicator
                  color={accent.accentInk}
                  accessibilityLabel={copy.persistence.loading}
                />
                <Text variant="body" color={ink.ink}>
                  {copy.persistence.loading}
                </Text>
              </>
            ) : (
              <>
                <Text variant="title2" color={ink.ink}>
                  {copy.persistence.title}
                </Text>
                <Text variant="body" color={ink.muted}>
                  {copy.persistence.body}
                </Text>
                <Pressable
                  feedback="smallButton"
                  accessibilityRole="button"
                  onPress={() => {
                    void initializeAppPersistence()
                  }}
                  style={styles.retry}
                >
                  <Text variant="body" color={accent.accentInk}>
                    {copy.persistence.retry}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </ThemeProvider>
  )
}
const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: surface.canvas },
  viewport: { flex: 1, width: '100%', alignSelf: 'center', backgroundColor: surface.app },
  webColumn: { maxWidth: webLayout.learnerMaxWidth },
  content: {
    flexGrow: 1,
    padding: space['6'],
    gap: space['4'],
    justifyContent: 'center',
  },
  retry: {
    minHeight: MIN_TAP,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: space['3'],
  },
})
