import { useEffect, useState } from 'react'
import type { OAuthProvider } from '@loro/core/api/oauth'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { accountClient, useAccount, useSyncStatus, syncNow } from '../src/lib/account/runtime'
import { availableProviders, beginSignIn, completeBrowserSignIn } from '../src/auth/runtime'
import { checkBackend, type BackendStatus } from '../src/lib/backend'
import { copy } from '../src/lib/copy'
import { useLocale } from '../src/lib/i18n'
import { Button, Screen, Stack, Text } from '../src/ui/primitives'
import { ink, line, MIN_TAP, radius, space, surface, type } from '../src/ui/theme'
import { useTheme } from '../src/ui/ThemeProvider'
import { scaleTextStyle } from '../src/ui/runtimeStyles'

/** F-01/F-02: account is an optional utility in the shared navigation shell. */
export default function Account() {
  useLocale()
  const state = useAccount()
  const sync = useSyncStatus()
  const client = accountClient()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [requested, setRequested] = useState(false)
  const [providers, setProviders] = useState<OAuthProvider[]>([])
  const [providerStatus, setProviderStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [providerAttempt, setProviderAttempt] = useState(0)
  const { textScale } = useTheme()
  const busy = state.status === 'working'
  useEffect(() => {
    completeBrowserSignIn()
  }, [])
  useEffect(() => {
    let active = true
    if (!client?.configured) {
      setProviderStatus('ready')
      return
    }
    setProviderStatus('loading')
    void availableProviders()
      .then((result) => {
        if (active) {
          setProviders(result)
          setProviderStatus('ready')
        }
      })
      .catch(() => {
        if (active) setProviderStatus('error')
      })
    return () => {
      active = false
    }
  }, [client, providerAttempt])
  const providerSignIn = (provider: OAuthProvider): void => {
    setRequested(false)
    setCode('')
    void beginSignIn(provider).catch(() => {
      setProviderStatus('error')
    })
  }
  const send = (): void => {
    if (!client) return
    void client.requestCode(email).then(() => {
      if (client.getSnapshot().status === 'code-sent') setRequested(true)
    })
  }
  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Stack gap={space['4']}>
            <Text variant="title2">{copy.account.title}</Text>
            <BackendConnection />
            <Text variant="body">{copy.account.intro}</Text>
            <Text>{copy.account.localData}</Text>
            {state.session ? (
              <>
                <Text variant="body">{copy.account.signedIn}</Text>
                <View accessibilityLiveRegion="polite">
                  <Text>
                    {sync === 'synced'
                      ? copy.account.synced
                      : sync === 'syncing'
                        ? copy.account.syncing
                        : sync === 'error'
                          ? copy.account.syncError
                          : copy.account.syncPending}
                  </Text>
                </View>
                <Button
                  label={copy.account.syncNow}
                  disabled={sync === 'syncing'}
                  onPress={() => {
                    void syncNow()
                  }}
                />
                <Text>{copy.account.signOutNote}</Text>
                <Button
                  variant="secondary"
                  label={copy.account.signOut}
                  onPress={() => {
                    setRequested(false)
                    setCode('')
                    void client?.signOut()
                  }}
                />
              </>
            ) : !client?.configured ? (
              <Text>{copy.account.unconfigured}</Text>
            ) : (
              <>
                <Button
                  label={copy.account.google}
                  disabled={busy || providerStatus === 'loading' || !providers.includes('google')}
                  onPress={() => {
                    providerSignIn('google')
                  }}
                />
                <Button
                  label={copy.account.apple}
                  variant="secondary"
                  disabled={busy || providerStatus === 'loading' || !providers.includes('apple')}
                  onPress={() => {
                    providerSignIn('apple')
                  }}
                />
                {providerStatus === 'loading' && <Text>{copy.account.busy}</Text>}
                {providerStatus === 'ready' && providers.length === 0 && (
                  <Text>{copy.account.providersUnavailable}</Text>
                )}
                {providerStatus === 'error' && (
                  <>
                    <View accessibilityLiveRegion="polite">
                      <Text>{copy.account.error}</Text>
                    </View>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      label={copy.account.retry}
                      onPress={() => {
                        setProviderAttempt((value) => value + 1)
                        void client.restore()
                      }}
                    />
                  </>
                )}
                <Text variant="label">{copy.account.email}</Text>
                <TextInput
                  accessibilityLabel={copy.account.email}
                  value={email}
                  onChangeText={setEmail}
                  editable={!busy && !requested}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  maxLength={254}
                  style={[styles.input, scaleTextStyle(type.body, textScale)]}
                />
                {requested && (
                  <>
                    <Text>{copy.account.sent}</Text>
                    <Text variant="label">{copy.account.code}</Text>
                    <TextInput
                      accessibilityLabel={copy.account.code}
                      value={code}
                      onChangeText={setCode}
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
                      maxLength={6}
                      editable={!busy}
                      style={[styles.input, scaleTextStyle(type.body, textScale)]}
                    />
                  </>
                )}
                <Button
                  label={
                    busy
                      ? copy.account.working
                      : requested
                        ? copy.account.verify
                        : copy.account.send
                  }
                  disabled={
                    busy ||
                    (requested
                      ? !/^\d{6}$/.test(code)
                      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                  }
                  onPress={
                    requested
                      ? () => {
                          void client.verifyCode(email, code)
                        }
                      : send
                  }
                />
                {requested && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    label={copy.account.differentEmail}
                    onPress={() => {
                      setRequested(false)
                      setCode('')
                    }}
                  />
                )}
              </>
            )}
            {state.error && (
              <View accessibilityLiveRegion="polite">
                <Text>{copy.account[state.error]}</Text>
              </View>
            )}
            {busy && (
              <View accessibilityLiveRegion="polite">
                <Text>{copy.account.busy}</Text>
              </View>
            )}
            {state.status === 'cancelled' && (
              <View accessibilityLiveRegion="polite">
                <Text>{copy.account.cancelled}</Text>
              </View>
            )}
            {state.error === 'upgrade-offline' && (
              <Button
                variant="secondary"
                disabled={busy}
                label={copy.account.retry}
                onPress={() => {
                  void client?.restore()
                }}
              />
            )}
            {Platform.OS === 'web' && <Text>{copy.account.webNote}</Text>}
          </Stack>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
function BackendConnection() {
  const [status, setStatus] = useState<BackendStatus>('checking')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void checkBackend().then((result) => {
      if (active) setStatus(result)
    })
    return () => {
      active = false
    }
  }, [attempt])
  return (
    <Stack gap={space['2']}>
      <View accessibilityLiveRegion="polite">
        <Text>{copy.account.backend[status]}</Text>
      </View>
      <Text>{copy.account.backend.scope}</Text>
      <Button
        label={copy.account.backend.retry}
        disabled={status === 'checking'}
        onPress={() => {
          setStatus('checking')
          setAttempt((value) => value + 1)
        }}
      />
    </Stack>
  )
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space['4'], paddingBottom: space['6'] },
  input: {
    minHeight: MIN_TAP,
    padding: space['3'],
    borderWidth: 1,
    borderColor: line.strong,
    borderRadius: radius.lg,
    backgroundColor: surface.card,
    color: ink.ink,
    width: '100%',
  },
})
