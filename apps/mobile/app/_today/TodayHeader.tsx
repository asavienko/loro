import { View, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useLocale } from '../../src/lib/i18n'
import { copy } from '../../src/lib/copy'
import { haptics } from '../../src/lib/haptics'
import { localDateLabel } from '../../src/lib/clock'
import { Pressable, Row, Text } from '../../src/ui/primitives'
import { parchmentGlassStyle, chromeHairlineShadow } from '../../src/ui/parchmentGlass'
import { accent, ink, radius, space, surface } from '../../src/ui/theme'
import {
  HEADER_CLUSTER_GAP,
  HEADER_H,
  PAGE_GUTTER,
  PROFILE,
  PROFILE_AVATAR,
  PROFILE_ML,
  PROFILE_GLYPH,
  STREAK_FLAME,
  STREAK_GAP,
  STREAK_PX,
  STREAK_PY,
  TARGET_PX,
  WORDMARK_TRACK,
  LABEL_BOLD_WEIGHT,
} from './geometry'

const DATE_SIZE = 11

export function TodayHeader({
  streak,
  targetName,
}: {
  streak: number
  targetName: string
}) {
  useLocale()
  return (
    <View
      testID="today-header"
      style={[styles.header, parchmentGlassStyle(), chromeHairlineShadow()]}
    >
      <Row justify="space-between" align="center" style={styles.row}>
        <Row gap={HEADER_CLUSTER_GAP} align="baseline">
          <View testID="today-wordmark">
            <Text variant="title3" color={ink.ink} style={styles.wordmark}>
              {copy.today.wordmark.label}
            </Text>
          </View>
          <Text variant="title3" color={ink.ink}>
            {copy.today.title}
          </Text>
        </Row>
        <Row gap={HEADER_CLUSTER_GAP} align="center">
          {targetName.length > 0 && (
            <View style={styles.targetPill}>
              <Text variant="labelSm" color={ink.ink2} style={styles.caps}>
                {targetName}
              </Text>
            </View>
          )}
          <Text variant="caption" color={ink.ink2} style={styles.date}>
            {localDateLabel()}
          </Text>
          <View testID="today-streak" style={styles.streak}>
            {streak > 0 && (
              <Text variant="caption" color={accent.accentInk} style={styles.flame}>
                {copy.common.flame}
              </Text>
            )}
            <Text variant="labelSm" color={accent.accentInk} style={styles.streakLabel}>
              {streak === 0 ? copy.common.noValue : copy.today.streakDays(streak)}
            </Text>
          </View>
          <View testID="today-profile" style={styles.profileNudge}>
          <Pressable
            feedback="icon"
            pressMotion="deboss"
            accessibilityLabel={copy.a11y.today.profile}
            onPress={() => {
              haptics.select()
              router.push('/account')
            }}
            style={styles.profile}
          >
            <View style={styles.avatar}>
              <Text variant="label" color={accent.accentInk}>
                {PROFILE_GLYPH}
              </Text>
            </View>
          </Pressable>
          </View>
        </Row>
      </Row>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    height: HEADER_H,
    paddingHorizontal: PAGE_GUTTER,
    justifyContent: 'center',
  },
  row: { width: '100%' },
  wordmark: { letterSpacing: WORDMARK_TRACK },
  targetPill: {
    backgroundColor: surface.sunken,
    paddingHorizontal: TARGET_PX,
    paddingVertical: space['1'],
    borderRadius: radius.pill,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: STREAK_GAP,
    paddingHorizontal: STREAK_PX,
    paddingVertical: STREAK_PY,
    borderRadius: radius.pill,
    backgroundColor: accent.wash,
  },
  flame: { fontSize: STREAK_FLAME, lineHeight: STREAK_FLAME },
  streakLabel: { textTransform: 'none', fontWeight: LABEL_BOLD_WEIGHT },
  caps: { textTransform: 'none', fontWeight: LABEL_BOLD_WEIGHT },
  profileNudge: { marginLeft: PROFILE_ML },
  profile: {
    width: PROFILE,
    height: PROFILE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: PROFILE_AVATAR,
    height: PROFILE_AVATAR,
    borderRadius: radius.pill,
    backgroundColor: accent.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  date: { fontSize: DATE_SIZE, textTransform: 'none' },
})
