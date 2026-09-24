import { StyleSheet, View } from 'react-native'
import { copy } from '../../src/lib/copy'
import { haptics } from '../../src/lib/haptics'
import { useLocale } from '../../src/lib/i18n'
import { Arrival, Pressable, Stack, Text } from '../../src/ui/primitives'
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
  CONTENT_PAD_BOTTOM,
  HUB_BODY,
  HUB_BODY_LINE,
  HUB_PAD,
  HUB_TITLE,
  HUB_TITLE_LINE,
  HUB_TITLE_TRACK,
  MARK_CHECK,
  MAX_COPY_WIDTH,
  LEAVE_HEIGHT,
  SAFE_MARK,
  SIGN_OUT_ACTIONS_TOP,
  SIGN_OUT_SAFE,
  SIGN_OUT_SAFE_TITLE_TRACK,
  SIGN_OUT_STAY_TRACK,
  SIGN_OUT_LEAVE_TRACK,
  SIGN_OUT_NOTE,
  SIGN_OUT_NOTE_TRACK,
  SIGN_OUT_NOTE_WEIGHT,
  STAY_HEIGHT,
} from './geometry'

export function SignOutConfirm({
  email,
  streakDays,
  onStay,
  onSignOut,
}: {
  email: string | null
  streakDays: number
  onStay: () => void
  onSignOut: () => void
}) {
  useLocale()
  const { accent } = useTheme()
  return (
    <View style={styles.hub} testID="sign-out-confirm">
      <View style={styles.top}>
        <Emblem kind="signOut" />
        <Stack gap={space['1']} style={styles.copy}>
          <View testID="account-hub-title">
            <Text variant="title1" align="center" style={styles.title}>
              {copy.account.signOutConfirmTitle}
            </Text>
          </View>
          <Text variant="bodySm" align="center" color={ink.ink2} style={styles.body}>
            {email
              ? copy.account.signOutConfirmBodyEmail(email)
              : copy.account.signOutConfirmBody}
          </Text>
        </Stack>
        <Arrival kind="stepIn" style={styles.safeWrap}>
          <View
            style={[
              styles.safe,
              stationeryElevation('methodContact'),
              { backgroundColor: semantic.hook.bg, borderColor: semantic.hook.border },
            ]}
          >
            <View style={styles.safeHead}>
              <View style={[styles.safeMark, { backgroundColor: accent.wash }]}>
                <Text color={accent.accentInk}>{MARK_CHECK}</Text>
              </View>
              <View testID="account-sign-out-safe-title">
                <Text
                  variant="body"
                  color={ink.ink}
                  style={styles.safeTitle}
                >
                  {copy.account.signOutSafeTitle}
                </Text>
              </View>
            </View>
            <Stack gap={space['2']}>
              <SafeLine text={copy.account.signOutSafeVocab} />
              <SafeLine
                text={
                  streakDays > 0
                    ? copy.account.signOutSafeStreak(streakDays)
                    : copy.account.signOutSafeStreakKept
                }
              />
              <SafeLine text={copy.account.signOutSafeReconnect} />
            </Stack>
          </View>
        </Arrival>
        <View testID="sign-out-actions" style={styles.actions}>
        <Stack gap={space['2.5']}>
          <Pressable
            pressMotion="deboss"
            elevation="accentGlowStay"
            accessibilityLabel={copy.account.staySignedIn}
            onPress={() => {
              haptics.confirm()
              onStay()
            }}
            style={[
              styles.stay,
              stationeryElevation('accentGlowStay'),
              { backgroundColor: accent.accent },
            ]}
          >
            <Text variant="body" color={surface.app} style={styles.stayFace}>
              {copy.account.staySignedIn}
            </Text>
          </Pressable>
          <Pressable
            pressMotion="deboss"
            accessibilityLabel={copy.account.signOutDevice}
            onPress={() => {
              haptics.select()
              onSignOut()
            }}
            style={[
              styles.leave,
              { backgroundColor: surface.app, borderColor: semantic.danger.border },
            ]}
          >
            <Text variant="body" color={semantic.danger.text} style={styles.leaveFace}>
              {copy.account.signOutDevice}
            </Text>
          </Pressable>
        </Stack>
        </View>
      </View>
      <View style={[styles.footer, { borderTopColor: line.default }]}>
        <View testID="account-sign-out-note">
          <Text variant="captionSm" align="center" color={ink.muted} style={styles.note}>
            {copy.account.offlineFirstNote}
          </Text>
        </View>
      </View>
    </View>
  )
}

function SafeLine({ text }: { text: string }) {
  useLocale()
  const { accent } = useTheme()
  return (
    <View testID="account-sign-out-safe" style={styles.line}>
      <Text color={accent.accentInk}>{copy.common.marks.dot}</Text>
      <Text variant="caption" color={ink.ink3} style={styles.lineText}>
        {text}
      </Text>
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
    fontWeight: '700',
  },
  copy: { alignItems: 'center', marginTop: space['2'] },
  body: {
    maxWidth: MAX_COPY_WIDTH,
    fontSize: HUB_BODY,
    lineHeight: HUB_BODY_LINE,
  },
  safeWrap: { width: '100%', marginTop: space['4'] },
  safe: {
    width: '100%',
    padding: space['4'],
    borderRadius: radius.xl,
    borderWidth: border.hairline,
  },
  safeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
    marginBottom: space['2.5'],
  },
  safeTitle: { letterSpacing: SIGN_OUT_SAFE_TITLE_TRACK },
  safeMark: {
    width: SAFE_MARK,
    height: SAFE_MARK,
    borderRadius: SAFE_MARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { width: '100%', marginTop: SIGN_OUT_ACTIONS_TOP },
  stay: {
    minHeight: MIN_TAP,
    height: STAY_HEIGHT,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stayFace: { letterSpacing: SIGN_OUT_STAY_TRACK },
  leave: {
    minHeight: MIN_TAP,
    height: LEAVE_HEIGHT,
    borderRadius: radius.lg,
    borderWidth: border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveFace: { letterSpacing: SIGN_OUT_LEAVE_TRACK },
  footer: {
    marginTop: space['3'],
    paddingTop: space['3'],
    borderTopWidth: border.hairline,
    alignItems: 'center',
  },
  note: {
    fontSize: SIGN_OUT_NOTE,
    fontWeight: SIGN_OUT_NOTE_WEIGHT,
    letterSpacing: SIGN_OUT_NOTE_TRACK,
  },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space['2'] },
  lineText: { flex: 1, fontSize: SIGN_OUT_SAFE },
})
