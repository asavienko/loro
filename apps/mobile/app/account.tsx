import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { accountClient, useAccount, useSyncStatus, syncNow } from '../src/lib/account/runtime'
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
  const { textScale } = useTheme()
  const busy = state.status === 'working'
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
            <Text variant="body">{copy.account.intro}</Text>
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
            {Platform.OS === 'web' && <Text>{copy.account.webNote}</Text>}
          </Stack>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
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
