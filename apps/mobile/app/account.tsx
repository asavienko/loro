import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import type { OAuthProvider } from '@loro/core/api/oauth'
import {
  accountClient,
  beginSignIn,
  authConfigured,
  availableProviders,
  completeBrowserSignIn,
} from '../src/auth/runtime'
import { useLocale } from '../src/lib/i18n'
import { copy } from '../src/lib/copy'
import { Button, Screen, Stack, Text } from '../src/ui/primitives'
import { space } from '../src/ui/theme'

type Status = 'loading' | 'ready' | 'busy' | 'signedIn' | 'error' | 'cancelled' | 'localSignOut'
export default function Account() {
  useLocale()
  const [status, setStatus] = useState<Status>('loading')
  const [attempt, setAttempt] = useState(0)
  const [providers, setProviders] = useState<OAuthProvider[]>([])
  useEffect(() => {
    completeBrowserSignIn()
    const lifecycle = new AbortController()
    void (async () => {
      try {
        if (authConfigured) {
          const result = await availableProviders()
          if (!lifecycle.signal.aborted) setProviders(result)
          if (!accountClient.session) await accountClient.restore()
        }
        if (!lifecycle.signal.aborted) setStatus(accountClient.session ? 'signedIn' : 'ready')
      } catch {
        if (!lifecycle.signal.aborted) setStatus('error')
      }
    })()
    return () => {
      lifecycle.abort()
    }
  }, [attempt])
  const signIn = (provider: OAuthProvider): void => {
    setStatus('busy')
    void beginSignIn(provider)
      .then((result) => {
        setStatus(result)
      })
      .catch(() => {
        setStatus('error')
      })
  }
  const signOut = (): void => {
    setStatus('busy')
    void accountClient
      .signOut()
      .then((revoked) => {
        setStatus(revoked ? 'ready' : 'localSignOut')
      })
      .catch(() => {
        setStatus('error')
      })
  }
  const signedIn = Boolean(accountClient.session)
  const busy = status === 'busy' || status === 'loading'
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space['4'] }}>
        <Stack gap={space['4']}>
          <Text>{copy.account.intro}</Text>
          <Text>{copy.account.localData}</Text>
          {signedIn ? (
            <>
              <Text>{copy.account.signedIn}</Text>
              <Button label={copy.account.signOut} disabled={busy} onPress={signOut} />
            </>
          ) : (
            <>
              <Button
                label={copy.account.google}
                disabled={busy || !providers.includes('google')}
                onPress={() => {
                  signIn('google')
                }}
              />
              <Button
                label={copy.account.apple}
                variant="secondary"
                disabled={busy || !providers.includes('apple')}
                onPress={() => {
                  signIn('apple')
                }}
              />
              {!busy && providers.length === 0 && <Text>{copy.account.unavailable}</Text>}
            </>
          )}
          {busy && (
            <View accessibilityLiveRegion="polite">
              <Text>{copy.account.busy}</Text>
            </View>
          )}
          {status === 'error' && providers.length === 0 && (
            <Button
              label={copy.account.retry}
              onPress={() => {
                setStatus('loading')
                setAttempt((value) => value + 1)
              }}
            />
          )}
          {status === 'error' && (
            <View accessibilityLiveRegion="polite">
              <Text>{copy.account.error}</Text>
            </View>
          )}
          {status === 'cancelled' && (
            <View accessibilityLiveRegion="polite">
              <Text>{copy.account.cancelled}</Text>
            </View>
          )}
          {status === 'localSignOut' && (
            <View accessibilityLiveRegion="polite">
              <Text>{copy.account.localSignOut}</Text>
            </View>
          )}
        </Stack>
      </ScrollView>
    </Screen>
  )
}
