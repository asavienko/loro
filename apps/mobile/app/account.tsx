import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { router, Stack as RouteStack } from 'expo-router'
import { streak as streakOf } from '@loro/core'
import { useApp } from '../src/store'
import { deviceClock } from '../src/lib/clock'
import { conditionalHome } from '../src/lib/navigation'
import type { OAuthProvider } from '@loro/core/api/oauth'
import { SignInHub } from './_account/SignInHub'
import { SignOutConfirm } from './_account/SignOutConfirm'
import { resolveHubTone } from './_account/hubState'
import {
  HUB_NAV_TITLE,
  HUB_NAV_TITLE_LINE,
  HUB_NAV_TITLE_TRACK,
  HUB_NAV_TITLE_WEIGHT,
  HUB_NAV_TODAY,
  HUB_NAV_TODAY_TRACK,
  HUB_NAV_TODAY_WEIGHT,
} from './_account/geometry'
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
import { copy } from '../src/lib/copy'
import { useLocale } from '../src/lib/i18n'
import { Button, Card, Field, Pressable, Screen, Stack, Text } from '../src/ui/primitives'
import { ink, MIN_TAP, radius, semantic, space, surface, type } from '../src/ui/theme'
import { useTheme } from '../src/ui/ThemeProvider'
import { scaleTextStyle } from '../src/ui/runtimeStyles'

type ViewState = 'methods' | 'email' | 'code' | 'confirmation' | 'account' | 'signOutConfirm'
type HubOutcome = 'idle' | 'cancelled' | 'error'
type ProviderState = 'loading' | 'ready' | 'error'
type FeedbackTone = 'info' | 'warning' | 'danger'
type AccountErrorCode = NonNullable<ReturnType<typeof useAccount>['error']>

const EMAIL_MAX_LENGTH = 254
const CODE_MAX_LENGTH = 6

/** F-01/F-02: required sign-in gate, then account management in the shared shell. */
export default function Account() {
  useLocale()
  const onboarded = useApp((current) => current.onboarded)
  const state = useAccount()
  const sync = useSyncStatus()
  const repair = useSyncRepair()
  const client = accountClient()
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
  const [outcome, setOutcome] = useState<HubOutcome>('idle')
  const practiceDays = useApp((current) => current.practiceDays)
  const streakDays = streakOf(practiceDays, deviceClock.streakDay())
  const scrollRef = useRef<ScrollView>(null)

  const busy = state.status === 'working'
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const submitted = submittedEmail || email.trim()
  const socialUnavailable =
    providerStatus === 'ready' && capabilityStatus === 'ready' && providers.length === 0

  useEffect(() => {
    completeBrowserSignIn()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [view])

  useEffect(() => {
    if (!state.session && (view === 'account' || view === 'signOutConfirm')) {
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
      setOutcome('cancelled')
      setFeedback({ tone: 'info', text: copy.account.cancelled })
    } else if (!state.session && activeProvider && state.status === 'error' && state.error) {
      setActiveProvider(null)
      setOutcome('error')
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
    setOutcome('idle')
  }

  const cancelAttemptIfBusy = (): void => {
    if (busy) client?.cancelSignIn()
  }

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
      if (view === 'signOutConfirm') {
        setView('account')
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
        : view === 'signOutConfirm'
          ? copy.account.signOutConfirmNav
          : copy.account.title
  const hubNavTitle = view === 'methods' || view === 'signOutConfirm'
  const headerBackLabel =
    view === 'email'
      ? copy.account.signInOptions
      : view === 'code'
        ? copy.account.emailBack
        : view === 'signOutConfirm'
          ? copy.a11y.common.back
          : view === 'methods'
            ? copy.nav.home
            : null
  const hubTone = resolveHubTone({
    busy,
    activeProvider,
    socialUnavailable,
    outcome,
  })

  const leaveToPractice = (): void => {
    cancelAttemptIfBusy()
    resetAttempt()
    setFreshConfirmation(false)
    router.replace(conditionalHome({ signedIn: true, onboarded }))
  }

  const startEmail = (): void => {
    setFeedback(null)
    setOutcome('idle')
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
    setOutcome('idle')
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
    setOutcome('cancelled')
    setFeedback({ tone: 'info', text: copy.account.cancelled })
  }

  const footer = (
    <Stack gap={space['2']} style={styles.footer}>
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
          ...(hubNavTitle
            ? { headerTitle: () => <AccountNavTitle label={headerTitle} /> }
            : {}),
          gestureEnabled: view === 'methods' || view === 'account',
          ...(headerBackLabel
            ? {
                headerLeft: () => (
                  <Pressable
                    feedback="smallButton"
                    accessibilityRole="link"
                    accessibilityLabel={headerBackLabel}
                    disabled={view === 'methods' && busy}
                    onPress={() => {
                      if (view === 'code') backToEmail()
                      else if (view === 'email') backToMethods()
                      else if (view === 'signOutConfirm') setView('account')
                      else router.replace('/')
                    }}
                    style={styles.headerTarget}
                  >
                    {view === 'methods' ? (
                      <View testID="account-nav-today">
                        <Text
                          variant="bodySm"
                          color={busy ? ink.muted : accent.accentInk}
                          style={styles.navToday}
                        >
                          {copy.nav.home}
                        </Text>
                      </View>
                    ) : (
                      <Text variant="title2" color={ink.ink}>
                        {copy.common.chevron.left}
                      </Text>
                    )}
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
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            view === 'methods' || view === 'signOutConfirm' ? styles.hubContent : styles.content
          }
        >
          {view === 'methods' && (
            <SignInHub
              tone={hubTone}
              busy={busy}
              activeProvider={activeProvider}
              googleAvailable={providerStatus === 'ready' && providers.includes('google')}
              appleAvailable={providerStatus === 'ready' && providers.includes('apple')}
              emailAvailable={capabilityStatus === 'ready' && emailAvailable}
              feedback={feedback}
              discoveryError={providerStatus === 'error' || capabilityStatus === 'error'}
              unconfigured={!client?.configured}
              onGoogle={() => {
                providerSignIn('google')
              }}
              onApple={() => {
                providerSignIn('apple')
              }}
              onEmail={startEmail}
              onCancel={cancelProvider}
              onKeepPractising={() => {
                cancelAttemptIfBusy()
              }}
              onRetryDiscovery={() => {
                setCapabilityAttempt((value) => value + 1)
              }}
            />
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
            <Confirmation email={confirmedEmail} onContinue={leaveToPractice} footer={footer} />
          )}
          {view === 'account' && state.session && (
            <AccountManagement
              sync={sync}
              quarantined={repair.quarantined}
              onSync={() => void syncNow()}
              onSignOut={() => {
                setView('signOutConfirm')
              }}
            />
          )}
          {view === 'signOutConfirm' && state.session && (
            <SignOutConfirm
              email={state.session?.email ?? confirmedEmail}
              streakDays={streakDays}
              onStay={() => {
                setView('account')
              }}
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
  useLocale()
  const { accent } = useTheme()
  return (
    <View accessible={false} accessibilityElementsHidden style={styles.hero}>
      <View style={[styles.heroDisc, { backgroundColor: accent.wash }]}>
        <View style={[styles.heroMark, { borderColor: accent.accent }]}>
          <View style={[styles.phraseStroke, { backgroundColor: ink.ink }]} />
          <View
            style={[styles.phraseStroke, styles.phraseStrokeShort, { backgroundColor: ink.ink }]}
          />
        </View>
      </View>
      {success && (
        <View style={[styles.successMark, { backgroundColor: accent.accent }]}>
          <Text color={surface.card}>{copy.common.marks.check}</Text>
        </View>
      )}
    </View>
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
  useLocale()
  return (
    <>
      <AccountHero />
      <Stack gap={space['3']}>
        <Text variant="title1" align="center">
          {copy.account.emailTitle}
        </Text>
        <Text variant="bodyMd" align="center">
          {copy.account.emailBody}
        </Text>
      </Stack>
      <Stack gap={space['2']} style={styles.form}>
        <Text variant="label">{copy.account.email}</Text>
        <Field
          bordered
          invalid={feedback !== null && feedback.tone !== 'info'}
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
          style={scaleTextStyle(type.bodyMd, textScale)}
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
  useLocale()
  return (
    <>
      <AccountHero />
      <Stack gap={space['3']}>
        <Text variant="title1" align="center">
          {copy.account.codeTitle}
        </Text>
        <Text variant="bodyMd" align="center">
          {copy.account.codeSentTo(email)}
        </Text>
      </Stack>
      <Stack gap={space['2']} style={styles.form}>
        <Text variant="label">{copy.account.code}</Text>
        <Field
          bordered
          invalid={feedback !== null && feedback.tone !== 'info'}
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
          style={[scaleTextStyle(type.bodyMd, textScale), styles.codeField]}
        />
        {feedback && <SignInFeedback tone={feedback.tone} text={feedback.text} />}
        <Button
          size="cta"
          label={busy ? copy.account.working : copy.account.verify}
          disabled={busy || !/^\d{6}$/.test(code)}
          loading={busy}
          onPress={onVerify}
        />
        <Button variant="ghost" label={copy.account.resend} disabled={busy} onPress={onResend} />
        <Button variant="ghost" label={copy.account.differentEmail} onPress={onChangeEmail} />
      </Stack>
      {footer}
    </>
  )
}

function Confirmation({
  email,
  onContinue,
  footer,
}: {
  email: string | null
  onContinue: () => void
  footer: ReactNode
}) {
  useLocale()
  return (
    <>
      <AccountHero success />
      <Stack gap={space['3']}>
        <Text variant="title2" align="center">
          {copy.account.confirmationTitle}
        </Text>
        {email ? (
          <Text variant="bodyMd" align="center">
            {email}
          </Text>
        ) : null}
        <Text variant="bodyMd" align="center">
          {copy.account.confirmationBody}
        </Text>
      </Stack>
      <Button size="cta" label={copy.account.backToPractice} onPress={onContinue} />
      {footer}
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
  useLocale()
  return (
    <Stack gap={space['4']}>
      <AccountHero success />
      <Text variant="title1" align="center" color={ink.ink}>
        {copy.account.signedIn}
      </Text>
      <Card padding={space['4']}>
        <View accessibilityLiveRegion="polite">
          <Text align="center" color={ink.ink2}>
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
      </Card>
      <Button
        size="cta"
        label={copy.account.syncNow}
        disabled={sync === 'syncing'}
        loading={sync === 'syncing'}
        onPress={onSync}
      />
      <Text align="center" color={ink.muted} variant="bodyMd">
        {copy.account.signOutNote}
      </Text>
      <Button variant="secondary" label={copy.account.signOut} onPress={onSignOut} />
    </Stack>
  )
}

function SignInFeedback({ tone, text }: { tone: FeedbackTone; text: string }) {
  useLocale()
  const background =
    tone === 'danger' ? semantic.danger.bg : tone === 'warning' ? semantic.warn.bg : surface.card
  const color =
    tone === 'danger' ? semantic.danger.text : tone === 'warning' ? semantic.warn.text : ink.ink2
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

function AccountNavTitle({ label }: { label: string }) {
  return (
    <View testID="account-nav-title">
      <Text variant="title3" color={ink.ink} numberOfLines={1} style={styles.navTitle}>
        {label}
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
  content: { padding: space['5'], paddingBottom: space['6'], gap: space['5'] },
  hubContent: {
    flexGrow: 1,
  },
  hero: { height: 88, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  heroDisc: {
    width: 72,
    height: 72,
    borderRadius: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMark: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space['1.5'],
    paddingVertical: space['2'],
    justifyContent: 'center',
    backgroundColor: surface.card,
  },
  phraseStroke: { height: 3, borderRadius: 3, width: 22, marginBottom: 4 },
  phraseStrokeShort: { width: 16, marginBottom: 0 },
  successMark: {
    position: 'absolute',
    right: '32%',
    bottom: 8,
    width: 22,
    height: 22,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { marginTop: space['2'] },
  codeField: { textAlign: 'center', letterSpacing: space['1'] },
  feedback: { borderWidth: 1, borderRadius: radius.lg, padding: space['3'] },
  footer: { marginTop: space['5'] },
  headerTarget: {
    minWidth: MIN_TAP,
    minHeight: MIN_TAP,
    paddingHorizontal: space['2'],
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: type.title3.fontFamily,
    fontSize: HUB_NAV_TITLE,
    lineHeight: HUB_NAV_TITLE_LINE,
    fontWeight: HUB_NAV_TITLE_WEIGHT,
    letterSpacing: HUB_NAV_TITLE_TRACK,
  },
  navToday: {
    fontSize: HUB_NAV_TODAY,
    fontWeight: HUB_NAV_TODAY_WEIGHT,
    letterSpacing: HUB_NAV_TODAY_TRACK,
  },
})
