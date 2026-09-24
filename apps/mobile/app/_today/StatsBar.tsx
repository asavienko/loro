import { View, StyleSheet } from 'react-native'
import { useLocale } from '../../src/lib/i18n'
import { copy } from '../../src/lib/copy'
import { Arrival, Text } from '../../src/ui/primitives'
import { stationeryElevation } from '../../src/ui/elevation'
import { accent, ink, line, radius, surface } from '../../src/ui/theme'
import {
  STAT_BAR_GAP,
  STAT_CADENCE,
  STAT_CELL_GAP,
  STAT_DIVIDER_H,
  STAT_ICON,
  STAT_LOCKED,
  STAT_MARK_FACE,
  STAT_NEXT,
  STAT_NEXT_PAD_END,
  STAT_PAD,
  STAT_RADIUS,
  STAT_VALUE,
  STAT_VALUE_LINE,
  STAT_VALUE_TRACK,
  LABEL_BOLD_WEIGHT,
} from './geometry'

export function StatsBar({
  totalReps,
  lockedLabel,
  nextDue,
}: {
  totalReps: number
  lockedLabel: string
  nextDue: string
}) {
  useLocale()
  return (
    <Arrival kind="fadeIn">
      <View testID="today-stats" style={[styles.bar, stationeryElevation('emblemSoft')]}>
        <StatCell
          label={copy.today.rhythm.statCadence}
          value={copy.today.day.reps(totalReps)}
          tone="accent"
          mark={STAT_CADENCE}
        />
        <View style={styles.divider} />
        <StatCell
          label={copy.today.rhythm.statLocked}
          value={lockedLabel}
          tone="sunken"
          mark={STAT_LOCKED}
        />
        <View style={styles.divider} />
        <StatCell
          label={copy.today.rhythm.statNext}
          value={nextDue}
          tone="next"
          mark={STAT_NEXT}
          padEnd={STAT_NEXT_PAD_END}
        />
      </View>
    </Arrival>
  )
}

function StatCell({
  label,
  value,
  tone,
  mark,
  padEnd = 0,
}: {
  label: string
  value: string
  tone: 'accent' | 'sunken' | 'next'
  mark: string
  padEnd?: number | undefined
}) {
  useLocale()
  return (
    <View
      testID="today-stats-cell"
      style={[styles.cell, padEnd > 0 ? { paddingRight: padEnd } : null]}
    >
      <View
        testID="today-stats-icon"
        style={[
          styles.icon,
          tone === 'accent' ? styles.iconAccent : tone === 'next' ? styles.iconNext : styles.iconIdle,
        ]}
      >
        <View testID="today-stats-mark">
          <Text color={tone === 'next' ? accent.accentInk : ink.ink} style={styles.mark}>
            {mark}
          </Text>
        </View>
      </View>
      <View style={styles.copy}>
        <View testID="today-stats-label">
          <Text variant="labelSm" color={ink.ink2} style={styles.label}>
            {label}
          </Text>
        </View>
        <View testID="today-stats-value">
          <Text
            variant="captionSm"
            color={tone === 'next' ? accent.accentInk : ink.ink}
            style={styles.value}
          >
            {value}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: STAT_BAR_GAP,
    padding: STAT_PAD,
    backgroundColor: surface.sunken,
    borderRadius: STAT_RADIUS,
  },
  cell: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: STAT_CELL_GAP,
  },
  copy: { flexShrink: 1, minWidth: 0 },
  label: { textTransform: 'uppercase', fontWeight: LABEL_BOLD_WEIGHT },
  value: {
    fontSize: STAT_VALUE,
    lineHeight: STAT_VALUE_LINE,
    letterSpacing: STAT_VALUE_TRACK,
    fontWeight: '700',
    textTransform: 'none',
  },
  icon: {
    width: STAT_ICON,
    height: STAT_ICON,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { fontSize: STAT_MARK_FACE, lineHeight: STAT_MARK_FACE, fontWeight: LABEL_BOLD_WEIGHT },
  iconAccent: { backgroundColor: accent.tint },
  iconIdle: { backgroundColor: surface.sunken2 },
  iconNext: { backgroundColor: surface.track },
  divider: {
    width: 1,
    height: STAT_DIVIDER_H,
    backgroundColor: line.default,
  },
})
