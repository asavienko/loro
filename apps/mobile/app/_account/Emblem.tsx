import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Arrival, PulseRing } from '../../src/ui/primitives'
import { useTheme } from '../../src/ui/ThemeProvider'
import { stationeryElevation } from '../../src/ui/elevation'
import { border, ink, line, semantic, surface } from '../../src/ui/theme'
import {
  BADGE,
  BADGE_INSET_X,
  BADGE_INSET_X_SM,
  BADGE_INSET_Y,
  BADGE_INSET_Y_SM,
  BADGE_RADIUS,
  BADGE_RADIUS_SM,
  BADGE_SM,
  BADGE_TILT_DEG,
  EMBLEM,
  EMBLEM_MY,
  EMBLEM_MY_SM,
  EMBLEM_SM,
  MARK,
  MARK_SM,
  RING_BORDER,
  RING_MS_BUSY,
  RING_MS_IDLE,
  TILE,
  TILE_RADIUS,
  TILE_SM,
  TILE_TILT_BUSY_DEG,
  TILE_TILT_DEG,
} from './geometry'
import type { HubTone } from './hubState'
import {
  BoltMark,
  CloseMark,
  LogoutMark,
  LoroBird,
  ShieldCheck,
  SpinnerMark,
  WarnTriangle,
} from './marks'

export type EmblemKind = HubTone | 'signOut'

const SPINNER_MS = 1_000

export function Emblem({ kind }: { kind: EmblemKind }) {
  const { accent, reducedMotion } = useTheme()
  const spin = useSharedValue(0)
  const spinner = useSharedValue(0)
  const compact = kind === 'signOut'
  const spinning = kind === 'idle' || kind === 'connecting' || kind === 'signOut'
  const busy = kind === 'connecting'

  useEffect(() => {
    if (!spinning || reducedMotion) {
      cancelAnimation(spin)
      spin.value = 0
    } else {
      spin.value = 0
      spin.value = withRepeat(
        withTiming(1, {
          duration: busy ? RING_MS_BUSY : RING_MS_IDLE,
          easing: Easing.linear,
        }),
        -1,
        false,
      )
    }
    if (!busy || reducedMotion) {
      cancelAnimation(spinner)
      spinner.value = 0
      return
    }
    spinner.value = 0
    spinner.value = withRepeat(
      withTiming(1, { duration: SPINNER_MS, easing: Easing.linear }),
      -1,
      false,
    )
  }, [busy, reducedMotion, spin, spinner, spinning])

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }))
  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinner.value * 360}deg` }],
  }))

  const tile = compact ? TILE_SM : TILE
  const badge = compact ? BADGE_SM : BADGE
  const frame = compact ? EMBLEM_SM : EMBLEM
  const mark = compact ? MARK_SM : MARK
  const badgeFill =
    kind === 'cancelled'
      ? ink.ink
      : kind === 'unavailable'
        ? semantic.warn.bg
        : accent.accent
  const badgeInk = kind === 'unavailable' ? semantic.warn.text : surface.app
  const tileFill = surface.card
  const tileBorder = line.default
  const icon = Math.round(badge * 0.5)

  return (
    <View
      testID="account-emblem"
      style={[
        styles.frame,
        {
          width: frame,
          height: frame,
          marginVertical: compact ? EMBLEM_MY_SM : EMBLEM_MY,
        },
      ]}
    >
      <Arrival kind="fadeIn" style={styles.emblemIn}>
        {spinning ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                borderColor: accent.tintBorder,
                borderWidth: RING_BORDER,
              },
              reducedMotion ? null : ringStyle,
            ]}
          />
        ) : null}
        <View
          testID="account-emblem-tile"
          style={[
            styles.tile,
            stationeryElevation('emblemSoft'),
            {
              width: tile,
              height: tile,
              backgroundColor: tileFill,
              borderColor: tileBorder,
              transform: [
                {
                  rotate: `${kind === 'idle' ? TILE_TILT_DEG : TILE_TILT_BUSY_DEG}deg`,
                },
              ],
            },
          ]}
        >
          {kind === 'signOut' ? (
            <ShieldCheck size={mark} color={accent.accent} />
          ) : (
            <LoroBird size={mark} fill={accent.accent} eye={surface.app} beak={accent.accentInk} />
          )}
        </View>
        <View
          testID="account-emblem-badge"
          style={[
            styles.badge,
            stationeryElevation(kind === 'unavailable' ? 'emblemSoft' : 'emblemRaised'),
            {
              width: badge,
              height: badge,
              borderRadius: compact ? BADGE_RADIUS_SM : BADGE_RADIUS,
              backgroundColor: badgeFill,
              borderColor: kind === 'unavailable' ? semantic.warn.border : 'transparent',
              borderWidth: kind === 'unavailable' ? border.hairline : 0,
              right: compact ? BADGE_INSET_X_SM : BADGE_INSET_X,
              bottom: compact ? BADGE_INSET_Y_SM : BADGE_INSET_Y,
              transform: kind === 'connecting' ? undefined : [{ rotate: `${BADGE_TILT_DEG}deg` }],
            },
          ]}
        >
          {kind === 'connecting' ? (
            <PulseRing active style={{ width: badge, height: badge }}>
              <View style={styles.badgeInner}>
                <Animated.View style={reducedMotion ? undefined : spinnerStyle}>
                  <SpinnerMark size={icon} color={badgeInk} />
                </Animated.View>
              </View>
            </PulseRing>
          ) : kind === 'cancelled' ? (
            <CloseMark size={icon} color={badgeInk} />
          ) : kind === 'error' || kind === 'unavailable' ? (
            <WarnTriangle size={icon} color={badgeInk} knockout={badgeFill} />
          ) : kind === 'signOut' ? (
            <LogoutMark size={icon} color={badgeInk} />
          ) : (
            <BoltMark size={icon} color={badgeInk} />
          )}
        </View>
      </Arrival>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemIn: { alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderStyle: 'dashed',
    borderRadius: 999,
  },
  tile: {
    borderWidth: border.hairline,
    borderRadius: TILE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInner: { alignItems: 'center', justifyContent: 'center' },
})
