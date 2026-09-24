import { StyleSheet, View } from 'react-native'
import { shadow } from '@loro/design-tokens'
import { Pressable, Row, Text } from '../../src/ui/primitives'
import { stationeryElevation } from '../../src/ui/elevation'
import { useTheme } from '../../src/ui/ThemeProvider'
import { MIN_TAP, border, ink, line, onDark, surface } from '../../src/ui/theme'
import {
  CONNECTING_BORDER,
  MARK_APPLE,
  METHOD_APPLE_MARK_NUDGE,
  METHOD_DOWN_WEIGHT,
  METHOD_EMAIL_DOWN_TRACK,
  METHOD_GAP,
  METHOD_HEIGHT,
  METHOD_LABEL_TRACK,
  METHOD_LABEL_WEIGHT,
  METHOD_MARK,
  METHOD_PAD_X,
  METHOD_RADIUS,
  SIBLING_OPACITY,
  UNAVAILABLE_BADGE_SIZE,
  UNAVAILABLE_OPACITY,
} from './geometry'
import { SpinnerMark } from './marks'

export type MethodChrome =
  | 'google'
  | 'apple'
  | 'appleSoft'
  | 'email'
  | 'emailPrimary'
  | 'connecting'
  | 'retry'
  | 'resting'
  | 'down'

function methodLift(chrome: MethodChrome): keyof typeof shadow | undefined {
  switch (chrome) {
    case 'google':
      return 'methodContact'
    case 'apple':
      return 'methodFilled'
    case 'appleSoft':
      return 'methodSoft'
    case 'emailPrimary':
      return 'accentGlowStrong'
    case 'connecting':
      return 'methodInset'
    case 'retry':
      return 'accentGlow'
    default:
      return undefined
  }
}

export function MethodTile({
  icon,
  label,
  chrome,
  disabled,
  loading,
  badge,
  onPress,
}: {
  icon: string
  label: string
  chrome: MethodChrome
  disabled: boolean
  loading?: boolean | undefined
  badge?: string | undefined
  onPress: () => void
}) {
  const { accent } = useTheme()
  const filled = chrome === 'apple' || chrome === 'appleSoft' || chrome === 'emailPrimary'
  const connecting = chrome === 'connecting'
  const retry = chrome === 'retry'
  const resting = chrome === 'resting' || chrome === 'down'
  const dimmed = (disabled && !connecting) || resting
  const lift = methodLift(chrome)
  const inset = lift === 'methodInset'
  const inkColor = dimmed
    ? ink.muted
    : filled
      ? chrome === 'apple' || chrome === 'appleSoft'
        ? onDark.primary
        : surface.app
      : connecting
        ? accent.accentInk
        : ink.ink
  const background = dimmed
    ? surface.card
    : connecting
      ? surface.card
      : chrome === 'apple' || chrome === 'appleSoft'
        ? ink.ink
        : chrome === 'emailPrimary'
          ? accent.accent
          : chrome === 'email'
            ? surface.card
            : onDark.primary
  const borderColor = dimmed
    ? line.default
    : connecting || retry
      ? accent.accent
      : chrome === 'apple' || chrome === 'appleSoft' || chrome === 'emailPrimary'
        ? 'transparent'
        : line.default
  const markColor = chrome === 'email' && !dimmed ? accent.accentInk : inkColor
  const appleNudge = icon === MARK_APPLE && chrome !== 'down'

  const tileStyle = [
    styles.tile,
    lift && !inset ? stationeryElevation(lift) : null,
    {
      backgroundColor: background,
      borderColor,
      borderWidth: connecting || retry ? CONNECTING_BORDER : border.hairline,
    },
  ]
  const labelRow = (
    <Row gap={METHOD_GAP} justify={badge ? 'space-between' : 'center'} style={styles.row}>
      <Row gap={METHOD_GAP} justify="center">
        {connecting || loading ? (
          <SpinnerMark size={METHOD_MARK} color={inkColor} testID="account-method-spinner" />
        ) : (
          <View
            testID="account-method-mark"
            style={[styles.markBox, appleNudge ? styles.appleNudge : null]}
          >
            <Text color={markColor} style={styles.mark}>
              {icon}
            </Text>
          </View>
        )}
        <View testID="account-method-label">
          <Text
            variant="body"
            color={inkColor}
            style={{
              fontWeight: chrome === 'down' ? METHOD_DOWN_WEIGHT : METHOD_LABEL_WEIGHT,
              letterSpacing:
                chrome === 'emailPrimary' ? METHOD_EMAIL_DOWN_TRACK : METHOD_LABEL_TRACK,
            }}
          >
            {label}
          </Text>
        </View>
      </Row>
      {badge ? (
        <View testID="account-method-badge">
          <Text
            variant="labelSm"
            color={ink.muted}
            style={{
              fontSize: UNAVAILABLE_BADGE_SIZE,
              textTransform: 'uppercase',
            }}
          >
            {badge}
          </Text>
        </View>
      ) : null}
    </Row>
  )

  if (resting) {
    return (
      <View
        testID="account-method-tile"
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: true }}
        aria-disabled={true}
        style={[
          styles.wrap,
          tileStyle,
          { opacity: chrome === 'down' ? UNAVAILABLE_OPACITY : SIBLING_OPACITY },
        ]}
      >
        {labelRow}
      </View>
    )
  }

  return (
    <View
      testID="account-method-tile"
      style={[styles.wrap, inset && lift ? stationeryElevation(lift) : null]}
    >
    <Pressable
      key={lift ?? 'flat'}
      pressMotion="deboss"
      elevation={lift && !inset ? lift : undefined}
      accessibilityLabel={label}
      disabled={disabled && !connecting}
      loading={loading}
      onPress={onPress}
      style={tileStyle}
    >
      {labelRow}
    </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: METHOD_HEIGHT },
  tile: {
    minHeight: MIN_TAP,
    height: METHOD_HEIGHT,
    paddingHorizontal: METHOD_PAD_X,
    borderRadius: METHOD_RADIUS,
    justifyContent: 'center',
  },
  row: { width: '100%', alignItems: 'center' },
  markBox: {
    width: METHOD_MARK,
    height: METHOD_MARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleNudge: { marginBottom: METHOD_APPLE_MARK_NUDGE },
  mark: {
    fontSize: METHOD_MARK,
    lineHeight: METHOD_MARK,
    fontWeight: '700',
    textAlign: 'center',
  },
})
