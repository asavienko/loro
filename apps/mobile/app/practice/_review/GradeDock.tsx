import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  REVIEW_GRADES,
  ReviewEngine,
  type ReviewGrade,
  type SessionHandle,
  type UserPhraseId,
} from '@loro/core'
import { copy } from '../../../src/lib/copy'
import { formatInterval } from '../../../src/lib/format'
import { haptics } from '../../../src/lib/haptics'
import { useLocale } from '../../../src/lib/i18n'
import { Pressable, Text } from '../../../src/ui/primitives'
import { stationeryElevation } from '../../../src/ui/elevation'
import { useTheme } from '../../../src/ui/ThemeProvider'
import { MIN_TAP, onDark, radius, scale, semantic, space, surface } from '../../../src/ui/theme'
import { engineContext, useApp } from '../../../src/store'
import { Burst } from './Burst'
import {
  DOCK_MAX,
  DOCK_PAD_X,
  DOCK_PAD_Y,
  GRADE_FACE,
  GRADE_FACE_LINE,
  GRADE_FACE_TRACK,
  GRADE_GAP,
  GRADE_INNER_DIR,
  GRADE_INNER_GAP,
  GRADE_PAD_X,
  GRADE_PAD_Y,
} from './geometry'

const MS_PER_DAY = 86_400_000

const GRADE_LABEL: Record<ReviewGrade, () => string> = {
  again: () => copy.review.grade.again,
  hard: () => copy.review.grade.hard,
  good: () => copy.review.grade.good,
  easy: () => copy.review.grade.easy,
}

export function GradeDock({
  session,
  phraseId,
  at,
  onGrade,
}: {
  session: SessionHandle
  phraseId: UserPhraseId
  at: number
  onGrade: (grade: ReviewGrade) => Promise<void>
}) {
  useLocale()
  const { accent } = useTheme()
  const [intervals, setIntervals] = useState<Partial<Record<ReviewGrade, string>>>({})
  const [busy, setBusy] = useState(false)
  const [burst, setBurst] = useState<ReviewGrade | null>(null)
  const locale = useApp((state) => state.targetLocale)
  useEffect(() => {
    let cancelled = false
    const engine = new ReviewEngine(locale)
    const ctx = engineContext()
    void Promise.all(
      REVIEW_GRADES.map(async (grade) => {
        try {
          const delta = await engine.record(
            session,
            {
              itemId: `${phraseId}#review`,
              outcome: 'success',
              selfGrade: grade,
              latencyMs: null,
              hintsUsed: 0,
              at,
            },
            ctx,
          )
          if (delta.srs === undefined) return [grade, undefined] as const
          return [grade, formatInterval((delta.srs.due - at) / MS_PER_DAY)] as const
        } catch {
          return [grade, undefined] as const
        }
      }),
    ).then((rows) => {
      if (cancelled) return
      setIntervals(Object.fromEntries(rows.filter((row) => row[1] !== undefined)))
    })
    return () => {
      cancelled = true
    }
  }, [at, locale, phraseId, session])

  return (
    <View accessibilityLabel={copy.a11y.review.dock} style={styles.wrap}>
      <View testID="review-dock-capsule" style={[styles.capsule, stationeryElevation('dockFloat')]}>
        <Burst grade={burst} />
        <View testID="review-grade-row" style={styles.row}>
          {REVIEW_GRADES.map((grade) => {
            const label = GRADE_LABEL[grade]()
            const interval = intervals[grade]
            const look = gradeLook(grade, accent.accent)
            return (
              <Pressable
                key={grade}
                feedback="smallButton"
                pressMotion="deboss"
                elevation="emblemSoft"
                disabled={busy}
                accessibilityLabel={
                  interval === undefined ? label : copy.a11y.review.grade(label, interval)
                }
                onPress={() => {
                  if (busy) return
                  setBusy(true)
                  setBurst(grade)
                  haptics.select()
                  void onGrade(grade).finally(() => {
                    setBusy(false)
                  })
                }}
                style={[styles.grade, { backgroundColor: look.bg, borderColor: look.border }]}
              >
                <Text variant="captionSm" color={look.ink} style={styles.face}>
                  {label}
                </Text>
                {interval !== undefined && (
                  <Text variant="captionSm" color={look.meta} style={styles.face}>
                    {interval}
                  </Text>
                )}
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
  )
}

function gradeLook(
  grade: ReviewGrade,
  accentFill: string,
): { bg: string; border: string; ink: string; meta: string } {
  if (grade === 'hard') {
    return { bg: accentFill, border: accentFill, ink: onDark.primary, meta: onDark.primary }
  }
  if (grade === 'easy') {
    return {
      bg: scale.mastery.mastered,
      border: scale.mastery.mastered,
      ink: semantic.success.bg,
      meta: semantic.success.bg,
    }
  }
  if (grade === 'again') {
    return {
      bg: semantic.danger.bg,
      border: semantic.danger.border,
      ink: semantic.danger.text,
      meta: semantic.dangerAlt.text,
    }
  }
  return {
    bg: semantic.success.bg,
    border: semantic.success.border,
    ink: semantic.success.text,
    meta: semantic.successMeta.text,
  }
}

const styles = StyleSheet.create({
  wrap: { gap: space['2'], width: '100%', maxWidth: DOCK_MAX, alignSelf: 'center' },
  capsule: {
    position: 'relative',
    overflow: 'visible',
    backgroundColor: surface.dark,
    borderRadius: radius.pill,
    paddingHorizontal: DOCK_PAD_X,
    paddingVertical: DOCK_PAD_Y,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: onDark.line,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    flexWrap: 'wrap',
    gap: GRADE_GAP,
  },
  grade: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: MIN_TAP,
    minHeight: MIN_TAP,
    paddingHorizontal: GRADE_PAD_X,
    paddingVertical: GRADE_PAD_Y,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: GRADE_INNER_DIR,
    justifyContent: 'center',
    alignItems: 'center',
    gap: GRADE_INNER_GAP,
  },
  face: {
    fontSize: GRADE_FACE,
    lineHeight: GRADE_FACE_LINE,
    letterSpacing: GRADE_FACE_TRACK,
    fontWeight: '600',
    textTransform: 'none',
  },
})
