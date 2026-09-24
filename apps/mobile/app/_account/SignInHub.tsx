import { StyleSheet, View, type TextStyle } from 'react-native'
import type { OAuthProvider } from '@loro/core/api/oauth'
import { copy } from '../../src/lib/copy'
import { haptics } from '../../src/lib/haptics'
import { useLocale } from '../../src/lib/i18n'
import { Arrival, Pressable, PulseRing, Stack, Text } from '../../src/ui/primitives'
import { stationeryElevation } from '../../src/ui/elevation'
import { useTheme } from '../../src/ui/ThemeProvider'
import {
  MIN_TAP,
  border,
  ink,
  line,
  radius,
  semantic,
  space,
  surface,
} from '../../src/ui/theme'
import { Emblem } from './Emblem'
import {
  BANNER_DOT,
  CONNECTING_DOT,
  CONNECTING_CANCEL,
  CONNECTING_CANCEL_TRACK,
  CONNECTING_CANCEL_WEIGHT,
  CONNECTING_HELP,
  CONNECTING_HELP_TRACK,
  CONNECTING_HELP_WEIGHT,
  CONTENT_PAD_BOTTOM,
  HUB_BODY,
  HUB_BODY_LINE,
  HUB_PAD,
  HUB_TITLE,
  HUB_TITLE_LINE,
  HUB_TITLE_TRACK,
  HUB_TITLE_WEIGHT,
  KEEP_PRACTISING_UNDERLINE_OFFSET,
  KEEP_PRACTISING_WEIGHT,
  DEVICE_PROGRESS,
  DEVICE_PROGRESS_TRACK,
  DEVICE_PROGRESS_WEIGHT,
  CANCELLED_HINT,
  CANCELLED_HINT_TRACK,
  CANCELLED_HINT_WEIGHT,
  ERROR_SAFE,
  ERROR_SAFE_TRACK,
  ERROR_SAFE_WEIGHT,
  SOCIAL_DOWN,
  SOCIAL_DOWN_BODY_TRACK,
  SOCIAL_DOWN_BODY_WEIGHT,
  SOCIAL_DOWN_TRACK,
  SOCIAL_DOWN_WEIGHT,
  MARK_APPLE,
  MARK_GOOGLE,
  MARK_MAIL,
  MARK_WARN,
  INFO_MARK,
  MAX_COPY_WIDTH,
  METHOD_GAP,
  METHOD_STACK_CANCELLED,
  METHOD_STACK_COMPACT,
  METHOD_STACK_TOP,
  NOTICE_GAP,
  NOTICE_GAP_ERROR,
  NOTICE_MARK,
  NOTICE_PAD,
  NOTICE_TOP,
  NOTICE_TOP_ERROR,
  CANCEL_HEIGHT,
  CANCEL_RADIUS,
  PROGRESS_PAD,
  PROGRESS_TOP,
} from './geometry'
import { appleMethodLabel, googleMethodLabel, type HubTone } from './hubState'
import { InfoMark } from './marks'
import { MethodTile } from './MethodTile'

type FeedbackTone = 'info' | 'warning' | 'danger'

export function SignInHub({
  tone,
  busy,
  activeProvider,
  googleAvailable,
  appleAvailable,
  emailAvailable,
  feedback,
  discoveryError,
  unconfigured,
  onGoogle,
  onApple,
  onEmail,
  onCancel,
  onKeepPractising,
  onRetryDiscovery,
}: {
  tone: HubTone
  busy: boolean
  activeProvider: OAuthProvider | null
  googleAvailable: boolean
  appleAvailable: boolean
  emailAvailable: boolean
  feedback: { tone: FeedbackTone; text: string } | null
  discoveryError: boolean
  unconfigured: boolean
  onGoogle: () => void
  onApple: () => void
  onEmail: () => void
  onCancel: () => void
  onKeepPractising: () => void
  onRetryDiscovery: () => void
}) {
  useLocale()
  const { accent } = useTheme()
  const connecting = tone === 'connecting'
  const googleLabel = googleMethodLabel(tone, {
    idle: copy.account.google,
    cancelled: copy.account.tryGoogleAgain,
    error: copy.account.retryGoogle,
    connecting: copy.account.connecting('google'),
  })
  const appleLabel = appleMethodLabel(tone, {
    idle: copy.account.apple,
    error: copy.account.retryApple,
  })
  const heading =
    tone === 'connecting'
      ? copy.account.connectingTitle
      : tone === 'cancelled'
        ? copy.account.cancelledTitle
        : tone === 'error'
          ? copy.account.errorTitle
          : copy.account.heroTitle
  const body =
    tone === 'connecting'
      ? copy.account.connectingBody
      : tone === 'cancelled'
        ? copy.account.cancelledBody
        : tone === 'error'
          ? copy.account.errorBody
          : tone === 'unavailable'
            ? copy.account.unavailableBody
            : copy.account.heroBody

  return (
    <View style={styles.hub} testID="sign-in-hub">
      <View style={styles.top}>
        <Emblem kind={tone} />
        <Stack gap={space['2']} style={styles.copy}>
          <View testID="account-hub-title">
            <Text variant="title1" align="center" style={styles.title}>
              {heading}
            </Text>
          </View>
          <View testID="account-hub-body">
          <Text variant="bodySm" align="center" color={ink.ink2} style={styles.body}>
            {body}
          </Text>
          </View>
        </Stack>
        {tone === 'cancelled' ? (
          <Arrival kind="popIn">
            <Notice
              tone="info"
              text={copy.account.cancelledHint}
              info
              centered
              testID="account-cancelled-notice"
              face={styles.cancelledHint}
            />
          </Arrival>
        ) : null}
        {tone === 'error' ? (
          <Arrival kind="popIn">
            <Notice
              tone="danger"
              text={copy.account.errorSafe}
              dotted
              top={NOTICE_TOP_ERROR}
              testID="account-error-notice"
              face={styles.errorSafe}
            />
          </Arrival>
        ) : null}
        {tone === 'unavailable' ? (
          <Arrival kind="popIn">
            <SocialDownNotice />
          </Arrival>
        ) : null}
        <View
          testID="account-method-stack"
          style={[
            styles.methods,
            tone === 'cancelled'
              ? { marginTop: METHOD_STACK_CANCELLED }
              : tone === 'error' || tone === 'unavailable'
                ? { marginTop: METHOD_STACK_COMPACT }
                : null,
          ]}
        >
        <Stack gap={METHOD_GAP}>
          <MethodTile
            icon={MARK_GOOGLE}
            label={googleLabel}
            chrome={
              connecting
                ? activeProvider === 'google'
                  ? 'connecting'
                  : 'resting'
                : tone === 'error'
                  ? 'retry'
                  : tone === 'unavailable'
                    ? 'down'
                    : 'google'
            }
            disabled={busy || !googleAvailable}
            loading={connecting && activeProvider === 'google'}
            badge={tone === 'unavailable' ? copy.account.unavailableBadge : undefined}
            onPress={() => {
              haptics.select()
              onGoogle()
            }}
          />
          <MethodTile
            icon={MARK_APPLE}
            label={appleLabel}
            chrome={
              connecting
                ? activeProvider === 'apple'
                  ? 'connecting'
                  : 'resting'
                : tone === 'unavailable'
                  ? 'down'
                  : tone === 'error'
                    ? 'appleSoft'
                    : 'apple'
            }
            disabled={busy || !appleAvailable}
            badge={tone === 'unavailable' ? copy.account.unavailableBadge : undefined}
            onPress={() => {
              haptics.select()
              onApple()
            }}
          />
          <MethodTile
            icon={MARK_MAIL}
            label={copy.account.emailMethod}
            chrome={connecting ? 'resting' : tone === 'unavailable' ? 'emailPrimary' : 'email'}
            disabled={busy || !emailAvailable}
            onPress={() => {
              haptics.select()
              onEmail()
            }}
          />
        </Stack>
        </View>
        {connecting ? (
          <Arrival kind="stepIn">
            <View
              testID="account-connecting-card"
              style={[
                styles.progress,
                { backgroundColor: surface.card, borderColor: line.default },
              ]}
            >
              <View style={styles.progressRow}>
                <View testID="account-connecting-ping" style={styles.pingWell}>
                  <PulseRing active>
                    <View style={[styles.ping, { backgroundColor: accent.accent }]} />
                  </PulseRing>
                </View>
                <View testID="account-connecting-help">
                  <Text variant="captionSm" color={ink.ink3} style={styles.connectingHelp}>
                    {copy.account.secureWindow}
                  </Text>
                </View>
              </View>
              <Pressable
                pressMotion="deboss"
                elevation="methodSoft"
                accessibilityLabel={copy.account.cancelSignIn}
                onPress={() => {
                  haptics.select()
                  onCancel()
                }}
                style={[
                  styles.cancel,
                  stationeryElevation('methodSoft'),
                  { backgroundColor: surface.app, borderColor: line.stronger },
                ]}
              >
                <View testID="account-connecting-cancel">
                  <Text variant="captionSm" color={ink.ink} style={styles.connectingCancel}>
                    {copy.account.cancelSignIn}
                  </Text>
                </View>
              </Pressable>
            </View>
          </Arrival>
        ) : null}
        {discoveryError ? (
          <Arrival kind="popIn">
            <Notice tone="warning" text={copy.account.discoveryError} />
          </Arrival>
        ) : null}
        {feedback && tone !== 'cancelled' && tone !== 'error' && tone !== 'connecting' ? (
          <Notice tone={feedback.tone} text={feedback.text} />
        ) : null}
        {unconfigured ? <Notice tone="info" text={copy.account.unconfigured} /> : null}
        {discoveryError ? (
          <Pressable
            pressMotion="deboss"
            accessibilityLabel={copy.account.retry}
            onPress={() => {
              haptics.select()
              onRetryDiscovery()
            }}
            style={[
              styles.retry,
              { backgroundColor: surface.track, borderColor: line.default },
            ]}
          >
            <Text color={ink.ink}>{copy.account.retry}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.footer, { borderTopColor: line.default }]}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={copy.account.keepPractising}
          disabled={busy}
          onPress={() => {
            haptics.select()
            onKeepPractising()
          }}
          style={styles.guest}
        >
          <View testID="account-keep-practising">
            <Text
              variant="bodySm"
              align="center"
              color={connecting ? ink.muted : accent.accentInk}
              style={[styles.keep, connecting ? undefined : styles.underline]}
            >
              {copy.account.keepPractising}
            </Text>
          </View>
        </Pressable>
        <View testID="account-device-progress">
          <Text variant="captionSm" align="center" color={ink.muted} style={styles.device}>
            {copy.account.deviceProgress}
          </Text>
        </View>
      </View>
    </View>
  )
}

function Notice({
  tone,
  text,
  icon,
  info,
  dotted,
  centered,
  top,
  testID,
  face,
}: {
  tone: FeedbackTone
  text: string
  icon?: string | undefined
  info?: boolean | undefined
  dotted?: boolean | undefined
  centered?: boolean | undefined
  top?: number | undefined
  testID?: string | undefined
  face?: TextStyle | undefined
}) {
  useLocale()
  const background =
    tone === 'danger' ? semantic.danger.bg : tone === 'warning' ? semantic.warn.bg : surface.card
  const color =
    tone === 'danger' ? semantic.danger.text : tone === 'warning' ? semantic.warn.text : ink.ink3
  const borderColor =
    tone === 'danger'
      ? semantic.danger.border
      : tone === 'warning'
        ? semantic.warn.border
        : line.stronger
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        {
          backgroundColor: background,
          borderColor,
          marginTop: top ?? NOTICE_TOP,
          gap: tone === 'danger' ? NOTICE_GAP_ERROR : NOTICE_GAP,
          justifyContent: centered ? 'center' : 'flex-start',
        },
      ]}
    >
      {dotted ? <View style={[styles.bannerDot, { backgroundColor: color }]} /> : null}
      {info ? <InfoMark size={INFO_MARK} color={color} /> : null}
      {icon ? (
        <Text color={color} style={styles.noticeIcon}>
          {icon}
        </Text>
      ) : null}
      <View
        testID={testID !== undefined ? `${testID}-face` : undefined}
        style={centered ? undefined : styles.noticeText}
      >
        <Text variant="captionSm" color={color} style={face}>
          {text}
        </Text>
      </View>
    </View>
  )
}

function SocialDownNotice() {
  useLocale()
  return (
    <View
      testID="account-social-notice"
      accessibilityLiveRegion="polite"
      style={[
        styles.social,
        stationeryElevation('emblemSoft'),
        { backgroundColor: semantic.warn.bg, borderColor: semantic.warn.border },
      ]}
    >
      <View
        style={[
          styles.socialMark,
          { backgroundColor: semantic.warn.bg, borderColor: semantic.warn.border },
        ]}
      >
        <Text color={semantic.warn.text}>{MARK_WARN}</Text>
      </View>
      <View style={styles.socialCopy}>
        <View testID="account-social-down-title">
          <Text variant="captionSm" color={semantic.warn.text} style={styles.socialTitle}>
            {copy.account.socialDownTitle}
          </Text>
        </View>
        <View testID="account-social-down-body">
          <Text variant="captionSm" color={ink.ink3} style={styles.socialBody}>
            {copy.account.providersUnavailable}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hub: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: HUB_PAD,
    paddingTop: HUB_PAD,
    paddingBottom: CONTENT_PAD_BOTTOM,
  },
  top: { alignItems: 'center' },
  title: {
    fontSize: HUB_TITLE,
    lineHeight: HUB_TITLE_LINE,
    letterSpacing: HUB_TITLE_TRACK,
    fontWeight: HUB_TITLE_WEIGHT,
  },
  copy: { alignItems: 'center', marginTop: space['2'] },
  body: {
    maxWidth: MAX_COPY_WIDTH,
    fontSize: HUB_BODY,
    lineHeight: HUB_BODY_LINE,
  },
  methods: { width: '100%', marginTop: METHOD_STACK_TOP },
  notice: {
    width: '100%',
    marginTop: NOTICE_TOP,
    padding: NOTICE_PAD,
    borderRadius: radius.lg,
    borderWidth: border.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: NOTICE_GAP,
  },
  noticeIcon: { marginRight: space['0.5'] },
  noticeText: { flex: 1 },
  cancelledHint: {
    fontSize: CANCELLED_HINT,
    fontWeight: CANCELLED_HINT_WEIGHT,
    letterSpacing: CANCELLED_HINT_TRACK,
  },
  errorSafe: {
    fontSize: ERROR_SAFE,
    fontWeight: ERROR_SAFE_WEIGHT,
    letterSpacing: ERROR_SAFE_TRACK,
  },
  bannerDot: {
    width: BANNER_DOT,
    height: BANNER_DOT,
    borderRadius: BANNER_DOT,
  },
  social: {
    width: '100%',
    marginTop: space['5'],
    padding: space['4'],
    borderRadius: radius.xl,
    borderWidth: border.hairline,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space['3'],
  },
  socialMark: {
    width: NOTICE_MARK,
    height: NOTICE_MARK,
    borderRadius: NOTICE_MARK,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.hairline,
    marginTop: space['0.5'],
  },
  socialCopy: { flex: 1, gap: space['0.5'] },
  socialTitle: {
    fontSize: SOCIAL_DOWN,
    fontWeight: SOCIAL_DOWN_WEIGHT,
    letterSpacing: SOCIAL_DOWN_TRACK,
  },
  socialBody: {
    fontSize: SOCIAL_DOWN,
    fontWeight: SOCIAL_DOWN_BODY_WEIGHT,
    letterSpacing: SOCIAL_DOWN_BODY_TRACK,
  },
  progress: {
    width: '100%',
    marginTop: PROGRESS_TOP,
    padding: PROGRESS_PAD,
    borderRadius: radius.xl,
    borderWidth: border.hairline,
    gap: space['3'],
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space['3'] },
  pingWell: {
    width: CONNECTING_DOT,
    height: CONNECTING_DOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ping: {
    width: CONNECTING_DOT,
    height: CONNECTING_DOT,
    borderRadius: CONNECTING_DOT,
  },
  connectingHelp: {
    fontSize: CONNECTING_HELP,
    fontWeight: CONNECTING_HELP_WEIGHT,
    letterSpacing: CONNECTING_HELP_TRACK,
  },
  connectingCancel: {
    fontSize: CONNECTING_CANCEL,
    fontWeight: CONNECTING_CANCEL_WEIGHT,
    letterSpacing: CONNECTING_CANCEL_TRACK,
  },
  cancel: {
    minHeight: CANCEL_HEIGHT,
    height: CANCEL_HEIGHT,
    borderRadius: CANCEL_RADIUS,
    borderWidth: border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retry: {
    marginTop: space['3'],
    minHeight: MIN_TAP,
    paddingHorizontal: space['4'],
    borderRadius: radius.lg,
    borderWidth: border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: space['4'],
    paddingTop: space['4'],
    alignItems: 'center',
    gap: space['1'],
  },
  guest: { minHeight: MIN_TAP, justifyContent: 'center', paddingHorizontal: space['2'] },
  keep: { fontWeight: KEEP_PRACTISING_WEIGHT },
  underline: {
    textDecorationLine: 'underline',
    ...({ textUnderlineOffset: KEEP_PRACTISING_UNDERLINE_OFFSET } as TextStyle),
  },
  device: {
    fontSize: DEVICE_PROGRESS,
    fontWeight: DEVICE_PROGRESS_WEIGHT,
    letterSpacing: DEVICE_PROGRESS_TRACK,
  },
})
