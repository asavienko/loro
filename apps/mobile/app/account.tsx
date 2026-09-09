import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { router, Stack as RouteStack, useNavigation } from 'expo-router'
import type { OAuthProvider } from '@loro/core/api/oauth'
import {
  accountClient,
  syncNow,
  useAccount,
  useSyncRepair,
  useSyncStatus,
} from '../src/lib/account/runtime'
import {
  availableCapabilities,
  availableProviders,
  beginSignIn,
  completeBrowserSignIn,
} from '../src/auth/runtime'
import { methodNotice, methodUnavailableHint } from '../src/lib/account/availability'
import { copy } from '../src/lib/copy'
import { useLocale } from '../src/lib/i18n'
import { Button, Pressable, Row, Screen, Stack, Text } from '../src/ui/primitives'
import { ink, line, MIN_TAP, radius, semantic, space, surface, type } from '../src/ui/theme'
import { useTheme } from '../src/ui/ThemeProvider'
import { scaleTextStyle } from '../src/ui/runtimeStyles'

type ViewState = 'methods' | 'email' | 'code' | 'confirmation' | 'account'
type ProviderState = 'loading' | 'ready' | 'error'
type FeedbackTone = 'info' | 'warning' | 'danger'
type AccountErrorCode = NonNullable<ReturnType<typeof useAccount>['error']>

const HERO_CARD_HEIGHT = 56
const HERO_CARD_WIDTH = 86
const HERO_BAR_WIDTH = 7
const HERO_BAR_GAP = 4
const EMAIL_MAX_LENGTH = 254
const CODE_MAX_LENGTH = 6

/** F-01/F-02: optional account utility in the shared navigation shell. */
export default function Account() {
  useLocale()
  const state = useAccount()
  const sync = useSyncStatus()
  const repair = useSyncRepair()
  const client = accountClient()
  const navigation = useNavigation()
  const { textScale, accent } = useTheme()
  const [view, setView] = useState<ViewState>(state.session ? 'account' : 'methods')
  const [freshConfirmation, setFreshConfirmation] = useState(false)
  const [email, setEmail] = useState('')
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; text: string } | null>(null)
  const [providers, setProviders] = useState<OAuthProvider[]>([])
  const [providerStatus, setProviderStatus] = useState<ProviderState>('loading')
  const [emailAvailable, setEmailAvailable] = useState(false)
  const [capabilityStatus, setCapabilityStatus] = useState<ProviderState>('loading')
  const [activeProvider, setActiveProvider] = useState<OAuthProvider | null>(null)
  const [capabilityAttempt, setCapabilityAttempt] = useState(0)

  const busy = state.status === 'working'
  const attemptActive = busy || activeProvider !== null
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const submitted = submittedEmail || email.trim()
  const notice = methodNotice({
    configured: Boolean(client?.configured),
    providerStatus,
    capabilityStatus,
    providerCount: providers.length,
    emailAvailable,
  })

  useEffect(() => {
    completeBrowserSignIn()
  }, [])

  useEffect(() => {
    if (!state.session && view === 'account') {
      setView('methods')
      setFreshConfirmation(false)
    } else if (state.session && activeProvider && !freshConfirmation && view === 'methods') {
      setFreshConfirmation(true)
      setView('confirmation')
    } else if (state.session && !freshConfirmation && view === 'methods') {
      setView('account')
    }
  }, [activeProvider, freshConfirmation, state.session, view])

  useEffect(() => {
    if (!state.session && activeProvider && state.status === 'cancelled') {
      setActiveProvider(null)
      setFeedback({ tone: 'info', text: copy.account.cancelled })
    } else if (!state.session && activeProvider && state.status === 'error' && state.error) {
      setActiveProvider(null)
      setFeedback({ tone: 'danger', text: errorCopy(state.error) })
    }
  }, [activeProvider, state.error, state.session, state.status])

  useEffect(() => {
    let active = true
    if (!client?.configured) {
      setProviders([])
      setEmailAvailable(false)
      setProviderStatus('ready')
      setCapabilityStatus('ready')
      return () => {
        active = false
      }
    }
    setProviderStatus('loading')
    setCapabilityStatus('loading')
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
    void availableCapabilities()
      .then((result) => {
        if (active) {
          setEmailAvailable(result.email)
          setCapabilityStatus('ready')
        }
      })
      .catch(() => {
        if (active) setCapabilityStatus('error')
      })
    return () => {
      active = false
    }
  }, [capabilityAttempt, client])

  const resetAttempt = (): void => {
    setFeedback(null)
    setCode('')
    setSubmittedEmail('')
    setConfirmedEmail(null)
    setActiveProvider(null)
  }

  const cancelAttemptIfBusy = (): void => {
    if (busy) client?.cancelSignIn()
  }

  const abandonRoute = useCallback(() => {
    if (state.status === 'working') client?.cancelSignIn()
    setFeedback(null)
    setCode('')
    setSubmittedEmail('')
    setConfirmedEmail(null)
    setActiveProvider(null)
    setFreshConfirmation(false)
  }, [client, state.status])

  useEffect(() => {
    return navigation.addListener('beforeRemove', abandonRoute)
  }, [abandonRoute, navigation])

  const backToEmail = (): void => {
    cancelAttemptIfBusy()
    setCode('')
    setFeedback(null)
    setView('email')
  }

  const backToMethods = (): void => {
    cancelAttemptIfBusy()
    resetAttempt()
    setView('methods')
  }

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view === 'code') {
        backToEmail()
        return true
      }
      if (view === 'email') {
        backToMethods()
        return true
      }
      cancelAttemptIfBusy()
      return false
    })
    return () => {
      subscription.remove()
    }
  }, [busy, client, view])

  const headerTitle =
    view === 'email'
      ? copy.account.signInOptions
      : view === 'code'
        ? copy.account.emailBack
        : copy.account.title
  const headerBackLabel =
    view === 'email' ? copy.account.signInOptions : view === 'code' ? copy.account.emailBack : null

  const leaveToPractice = (): void => {
    cancelAttemptIfBusy()
    resetAttempt()
    setFreshConfirmation(false)
    router.replace('/')
  }

  const startEmail = (): void => {
    setFeedback(null)
    setCode('')
    setSubmittedEmail('')
    setView('email')
  }

  const sendCode = async (): Promise<void> => {
    if (!client || !emailValid || busy) return
    setFeedback(null)
    await client.requestCode(email)
    const result = client.getSnapshot()
    if (result.status === 'code-sent') {
      setSubmittedEmail(email.trim())
      setCode('')
      setView('code')
    } else if (result.error) {
      setFeedback({ tone: errorTone(result.error), text: errorCopy(result.error) })
    }
  }

  const verifyCode = async (): Promise<void> => {
    if (!client || !/^\d{6}$/.test(code) || !submitted || busy) return
    setFeedback(null)
    await client.verifyCode(submitted, code)
    const result = client.getSnapshot()
    if (result.session) {
      setConfirmedEmail(submitted)
      setFreshConfirmation(true)
      setView('confirmation')
      setCode('')
    } else if (result.error) {
      setFeedback({ tone: errorTone(result.error), text: errorCopy(result.error) })
    }
  }

  const resendCode = async (): Promise<void> => {
    if (!client || !submitted || busy) return
    setFeedback(null)
    await client.requestCode(submitted)
    const result = client.getSnapshot()
    if (result.status === 'code-sent') {
      setCode('')
      setFeedback({ tone: 'info', text: copy.account.codeResent })
    } else if (result.error) {
      setFeedback({ tone: errorTone(result.error), text: errorCopy(result.error) })
    }
  }

  const providerSignIn = (provider: OAuthProvider): void => {
    if (!client || busy) return
    setFeedback(null)
    setActiveProvider(provider)
    void beginSignIn(provider)
      .then((started) => {
        if (!started) setActiveProvider(null)
      })
      .catch(() => {
        const result = client.getSnapshot()
        setActiveProvider(null)
        setFeedback({
          tone: 'danger',
          text: result.error ? errorCopy(result.error) : copy.account.error,
        })
      })
  }

  const cancelProvider = (): void => {
    client?.cancelSignIn()
    setActiveProvider(null)
    setFeedback({ tone: 'info', text: copy.account.cancelled })
  }

  const footer = (
    <Stack gap={space['2']} style={styles.footer}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={copy.account.keepPractising}
        onPress={leaveToPractice}
        style={styles.linkTarget}
      >
        <Text color={accent.accentInk} align="center">
          {copy.account.keepPractising}
        </Text>
      </Pressable>
      <Text align="center" color={ink.muted}>
        {copy.account.deviceProgress}
      </Text>
    </Stack>
  )

  return (
    <Screen>
      <RouteStack.Screen
        options={{
          title: headerTitle,
          gestureEnabled:
            !attemptActive &&
            (view === 'methods' || view === 'confirmation' || view === 'account'),
          ...(headerBackLabel
            ? {
                headerLeft: () => (
                  <Pressable
                    feedback="smallButton"
                    accessibilityRole="link"
                    accessibilityLabel={headerBackLabel}
                    onPress={view === 'code' ? backToEmail : backToMethods}
                    style={styles.headerTarget}
                  >
                    <Text variant="title2" color={ink.ink}>
                      {copy.common.chevron.left}
                    </Text>
                  </Pressable>
                ),
              }
            : {}),
        }}
      />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {view === 'methods' && (
            <>
              <AccountHero />
              <Stack gap={space['3']}>
                <Text variant="title2" align="center">
                  {copy.account.heroTitle}
                </Text>
                <Text variant="body" align="center">
                  {copy.account.heroBody}
                </Text>
              </Stack>
              <Stack gap={space['2.5']} style={styles.methods}>
                <ProviderMethod
                  provider="google"
                  label={copy.account.google}
                  ready={providerStatus === 'ready'}
                  available={providers.includes('google')}
                  active={activeProvider === 'google'}
                  busy={busy}
                  onPress={() => {
                    providerSignIn('google')
                  }}
                />
                <ProviderMethod
                  provider="apple"
                  label={copy.account.apple}
                  ready={providerStatus === 'ready'}
                  available={providers.includes('apple')}
                  active={activeProvider === 'apple'}
                  busy={busy}
                  onPress={() => {
                    providerSignIn('apple')
                  }}
                />
                <MethodButton
                  icon="✉"
                  label={copy.account.emailMethod}
                  disabled={busy || capabilityStatus !== 'ready' || !emailAvailable}
                  hint={
                    methodUnavailableHint({
                      busy,
                      ready: capabilityStatus === 'ready',
                      available: emailAvailable,
                    })
                      ? copy.account.methodUnavailable
                      : undefined
                  }
                  onPress={startEmail}
                />
              </Stack>
              {busy && activeProvider ? <ProviderProgress onCancel={cancelProvider} /> : null}
              {notice === 'checking' ? (
                <SignInFeedback tone="info" text={copy.account.checkingMethods} />
              ) : notice === 'discoveryError' ? (
                <SignInFeedback tone="warning" text={copy.account.discoveryError} />
              ) : notice === 'allUnavailable' ? (
                <SignInFeedback tone="info" text={copy.account.methodsUnavailable} />
              ) : notice === 'providersUnavailable' ? (
                <SignInFeedback tone="info" text={copy.account.providersUnavailable} />
              ) : notice === 'unconfigured' ? (
                <SignInFeedback tone="info" text={copy.account.unconfigured} />
              ) : null}
              {feedback && <SignInFeedback tone={feedback.tone} text={feedback.text} />}
              {notice === 'discoveryError' && (
                <Button
                  variant="secondary"
                  label={copy.account.retry}
                  onPress={() => {
                    setCapabilityAttempt((value) => value + 1)
                  }}
                />
              )}
              {footer}
            </>
          )}
          {view === 'email' && (
            <EmailEntry
              email={email}
              emailValid={emailValid}
              busy={busy}
              textScale={textScale}
              onChange={(value) => {
                setEmail(value)
                setFeedback(null)
              }}
              onSend={() => void sendCode()}
              feedback={feedback}
              footer={footer}
            />
          )}
          {view === 'code' && (
            <CodeEntry
              email={submitted}
              code={code}
              busy={busy}
              textScale={textScale}
              onChange={(value) => {
                setCode(value.replace(/\D/g, '').slice(0, CODE_MAX_LENGTH))
                setFeedback(null)
              }}
              onVerify={() => void verifyCode()}
              onResend={() => void resendCode()}
              onChangeEmail={backToEmail}
              feedback={feedback}
              footer={footer}
            />
          )}
          {view === 'confirmation' && (
            <Confirmation email={confirmedEmail} onContinue={leaveToPractice} />
          )}
          {view === 'account' && state.session && (
            <AccountManagement
              sync={sync}
              quarantined={repair.quarantined}
              onSync={() => void syncNow()}
              onSignOut={() => {
                if (!client) return
                resetAttempt()
                setFreshConfirmation(false)
                void client.signOut().then(() => {
                  const result = client.getSnapshot()
                  if (result.error) {
                    setFeedback({ tone: errorTone(result.error), text: errorCopy(result.error) })
                  }
                })
              }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

function AccountHero({ success = false }: { success?: boolean | undefined }) {
  const { accent } = useTheme()
  return (
    <View accessible={false} accessibilityElementsHidden style={styles.hero}>
      <View style={[styles.heroLoop, { borderColor: accent.accent }]} />
      <View
        style={[
          styles.heroCard,
          styles.heroLeft,
          { borderColor: line.strong, backgroundColor: surface.card },
        ]}
      >
        <View style={[styles.phraseStroke, { backgroundColor: ink.ink }]} />
        <View
          style={[styles.phraseStroke, styles.phraseStrokeShort, { backgroundColor: ink.ink }]}
        />
        <View
          style={[styles.phraseStroke, styles.phraseStrokeTiny, { backgroundColor: ink.ink }]}
        />
      </View>
      <View
        style={[
          styles.heroCard,
          styles.heroRight,
          { borderColor: accent.accent, backgroundColor: surface.card },
        ]}
      >
        <Row gap={HERO_BAR_GAP} align="flex-end" style={styles.bars}>
          {[20, 29, 39, 50].map((height) => (
            <View
              key={height}
              style={[styles.heroBar, { height, backgroundColor: accent.accent }]}
            />
          ))}
        </Row>
      </View>
      {success && (
        <View style={[styles.successMark, { backgroundColor: accent.accent }]}>
          <Text color={surface.card}>{copy.common.marks.check}</Text>
        </View>
      )}
    </View>
  )
}

function MethodButton({
  icon,
  label,
  disabled,
  hint,
  onPress,
}: {
  icon: string
  label: string
  disabled: boolean
  hint?: string | undefined
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityHint={hint}
      disabled={disabled}
      onPress={onPress}
      style={[styles.methodButton, disabled && styles.methodDisabled]}
    >
      <Row gap={space['3']} justify="center">
        <Text variant="title3" color={disabled ? ink.muted : ink.ink}>
          {icon}
        </Text>
        <Text color={disabled ? ink.muted : ink.ink}>{label}</Text>
      </Row>
    </Pressable>
  )
}

function ProviderMethod({
  provider,
  label,
  ready,
  available,
  active,
  busy,
  onPress,
}: {
  provider: OAuthProvider
  label: string
  ready: boolean
  available: boolean
  active: boolean
  busy: boolean
  onPress: () => void
}) {
  return (
    <MethodButton
      icon={active && busy ? '◌' : provider === 'google' ? 'G' : ''}
      label={active && busy ? copy.account.connecting(provider) : label}
      disabled={busy || !ready || !available}
      hint={
        methodUnavailableHint({ busy, ready, available })
          ? copy.account.methodUnavailable
          : undefined
      }
      onPress={onPress}
    />
  )
}

function ProviderProgress({ onCancel }: { onCancel: () => void }) {
  return (
    <Stack gap={space['2']} style={styles.progress}>
      <Row gap={space['2']} justify="center">
        <ActivityIndicator accessibilityLabel={copy.account.secureWindow} />
        <Text>{copy.account.secureWindow}</Text>
      </Row>
      <Button variant="secondary" label={copy.account.cancelSignIn} onPress={onCancel} />
    </Stack>
  )
}

function EmailEntry({
  email,
  emailValid,
  busy,
  textScale,
  onChange,
  onSend,
  feedback,
  footer,
}: {
  email: string
  emailValid: boolean
  busy: boolean
  textScale: 1 | 2 | 3.1
  onChange: (value: string) => void
  onSend: () => void
  feedback: { tone: FeedbackTone; text: string } | null
  footer: ReactNode
}) {
  return (
    <>
      <AccountHero />
      <Stack gap={space['3']}>
        <Text variant="title2" align="center">
          {copy.account.emailTitle}
        </Text>
        <Text variant="body" align="center">
          {copy.account.emailBody}
        </Text>
      </Stack>
      <Stack gap={space['2']} style={styles.form}>
        <Text variant="label">{copy.account.email}</Text>
        <TextInput
          accessibilityLabel={copy.account.email}
          value={email}
          autoFocus
          onChangeText={onChange}
          editable={!busy}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          maxLength={EMAIL_MAX_LENGTH}
          returnKeyType="send"
          onSubmitEditing={onSend}
          style={[styles.input, scaleTextStyle(type.body, textScale)]}
        />
        {feedback && <SignInFeedback tone={feedback.tone} text={feedback.text} />}
        <Button
          size="cta"
          label={busy ? copy.account.working : copy.account.send}
          disabled={busy || !emailValid}
          loading={busy}
          onPress={onSend}
        />
      </Stack>
      {footer}
    </>
  )
}

function CodeEntry({
  email,
  code,
  busy,
  textScale,
  onChange,
  onVerify,
  onResend,
  onChangeEmail,
  feedback,
  footer,
}: {
  email: string
  code: string
  busy: boolean
  textScale: 1 | 2 | 3.1
  onChange: (value: string) => void
  onVerify: () => void
  onResend: () => void
  onChangeEmail: () => void
  feedback: { tone: FeedbackTone; text: string } | null
  footer: ReactNode
}) {
  const { accent } = useTheme()
  return (
    <>
      <AccountHero />
      <Stack gap={space['3']}>
        <Text variant="title2" align="center">
          {copy.account.codeTitle}
        </Text>
        <Text variant="body" align="center">
          {copy.account.codeSentTo(email)}
        </Text>
      </Stack>
      <Stack gap={space['2']} style={styles.form}>
        <Text variant="label">{copy.account.code}</Text>
        <TextInput
          accessibilityLabel={copy.account.code}
          accessibilityHint={copy.account.codeHint}
          value={code}
          autoFocus
          onChangeText={onChange}
          editable={!busy}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          maxLength={CODE_MAX_LENGTH}
          placeholder={copy.account.codePlaceholder}
          returnKeyType="done"
          onSubmitEditing={onVerify}
          style={[
            styles.input,
            scaleTextStyle(type.body, textScale),
            feedback?.tone === 'danger' && { borderColor: semantic.danger.text },
          ]}
        />
        {feedback && <SignInFeedback tone={feedback.tone} text={feedback.text} />}
        <Button
          size="cta"
          label={busy ? copy.account.working : copy.account.verify}
          disabled={busy || !/^\d{6}$/.test(code)}
          loading={busy}
          onPress={onVerify}
        />
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={copy.account.resend}
          onPress={onResend}
          disabled={busy}
          style={styles.linkTarget}
        >
          <Text align="center" color={accent.accentInk}>
            {copy.account.resend}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={copy.account.differentEmail}
          onPress={onChangeEmail}
          style={styles.linkTarget}
        >
          <Text align="center" color={accent.accentInk}>
            {copy.account.differentEmail}
          </Text>
        </Pressable>
      </Stack>
      {footer}
    </>
  )
}

function Confirmation({
  email,
  onContinue,
}: {
  email: string | null
  onContinue: () => void
}) {
  return (
    <>
      <AccountHero success />
      <Stack gap={space['3']}>
        <Text variant="title2" align="center">
          {copy.account.confirmationTitle}
        </Text>
        {email ? (
          <Text variant="body" align="center">
            {email}
          </Text>
        ) : null}
        <Text variant="body" align="center">
          {copy.account.confirmationBody}
        </Text>
      </Stack>
      <Button size="cta" label={copy.account.backToPractice} onPress={onContinue} />
      <Text align="center" color={ink.muted}>
        {copy.account.deviceProgress}
      </Text>
    </>
  )
}

function AccountManagement({
  sync,
  quarantined,
  onSync,
  onSignOut,
}: {
  sync: 'pending' | 'syncing' | 'synced' | 'error'
  quarantined: number
  onSync: () => void
  onSignOut: () => void
}) {
  return (
    <Stack gap={space['4']}>
      <AccountHero success />
      <Text variant="title2" align="center">
        {copy.account.signedIn}
      </Text>
      <View accessibilityLiveRegion="polite">
        <Text align="center">
          {sync === 'synced'
            ? copy.account.synced
            : sync === 'syncing'
              ? copy.account.syncing
              : sync === 'error'
                ? copy.account.syncError
                : copy.account.syncPending}
        </Text>
        {quarantined > 0 && <Text>{copy.account.syncQuarantined(quarantined)}</Text>}
      </View>
      <Button
        size="cta"
        label={copy.account.syncNow}
        disabled={sync === 'syncing'}
        loading={sync === 'syncing'}
        onPress={onSync}
      />
      <Text align="center" color={ink.muted}>
        {copy.account.signOutNote}
      </Text>
      {Platform.OS === 'web' && (
        <Text align="center" color={ink.muted}>
          {copy.account.webNote}
        </Text>
      )}
      <Button variant="secondary" label={copy.account.signOut} onPress={onSignOut} />
    </Stack>
  )
}

function SignInFeedback({ tone, text }: { tone: FeedbackTone; text: string }) {
  const background =
    tone === 'danger'
      ? semantic.danger.bg
      : tone === 'warning'
        ? semantic.warn.bg
        : semantic.info.bg
  const color =
    tone === 'danger'
      ? semantic.danger.text
      : tone === 'warning'
        ? semantic.warn.text
        : semantic.info.text
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.feedback, { backgroundColor: background, borderColor: color }]}
    >
      <Text color={color} align="center">
        {text}
      </Text>
    </View>
  )
}

function errorTone(code: AccountErrorCode): FeedbackTone {
  return code === 'invalid-code' || code === 'invalid-email' || code === 'rate-limited'
    ? 'warning'
    : code === 'network' || code === 'unavailable'
      ? 'danger'
      : 'warning'
}

function errorCopy(code: AccountErrorCode): string {
  const value = copy.account[code as keyof typeof copy.account]
  return typeof value === 'string' ? value : copy.account.error
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space['4'], paddingBottom: space['6'], gap: space['5'] },
  hero: { height: 118, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  heroLoop: { position: 'absolute', width: 74, height: 74, borderRadius: 74, borderWidth: 3 },
  heroCard: {
    position: 'absolute',
    width: HERO_CARD_WIDTH,
    height: HERO_CARD_HEIGHT,
    borderWidth: 2,
    borderRadius: radius.xl,
    padding: space['3'],
    justifyContent: 'center',
  },
  heroLeft: { transform: [{ rotate: '-9deg' }, { translateX: -38 }] },
  heroRight: { transform: [{ rotate: '8deg' }, { translateX: 38 }] },
  phraseStroke: { height: 5, borderRadius: 5, width: 52, marginBottom: 7 },
  phraseStrokeShort: { width: 46 },
  phraseStrokeTiny: { width: 27, marginBottom: 0 },
  bars: { height: 42, alignItems: 'flex-end', justifyContent: 'center' },
  heroBar: { width: HERO_BAR_WIDTH, borderRadius: 3 },
  successMark: {
    position: 'absolute',
    right: '18%',
    bottom: 10,
    width: 26,
    height: 26,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methods: { marginTop: space['2'] },
  methodButton: {
    minHeight: MIN_TAP,
    paddingVertical: 13,
    paddingHorizontal: space['4'],
    borderWidth: 1,
    borderColor: line.strong,
    borderRadius: radius.lg,
    backgroundColor: surface.card,
  },
  methodDisabled: { backgroundColor: line.subtle, borderColor: line.default },
  progress: { paddingTop: space['2'] },
  form: { marginTop: space['2'] },
  input: {
    minHeight: MIN_TAP,
    padding: space['3'],
    borderWidth: 1,
    borderColor: line.strong,
    borderRadius: radius.lg,
    backgroundColor: surface.card,
    color: ink.ink,
    alignSelf: 'stretch',
  },
  feedback: { borderWidth: 1, borderRadius: radius.lg, padding: space['3'] },
  footer: { marginTop: space['5'] },
  linkTarget: { minHeight: MIN_TAP, justifyContent: 'center' },
  headerTarget: {
    minWidth: MIN_TAP,
    minHeight: MIN_TAP,
    paddingHorizontal: space['2'],
    justifyContent: 'center',
  },
})
