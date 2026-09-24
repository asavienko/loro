import { View, StyleSheet } from 'react-native'
import { useLocale } from '../../src/lib/i18n'
import { copy } from '../../src/lib/copy'
import { Arrival, PulseRing, Text } from '../../src/ui/primitives'
import { accent, ink } from '../../src/ui/theme'
import type { RhythmBand } from './rhythm'
import {
  GREETING_CYCLE_GAP,
  GREETING_CYCLE_MB,
  GREETING_DUE,
  GREETING_DUE_LINE,
  GREETING_DUE_MT,
  GREETING_DUE_WEIGHT,
  GREETING_LINE,
  GREETING_TITLE,
  GREETING_TRACK,
  LABEL_BOLD_WEIGHT,
  PULSE_DOT,
} from './geometry'

export function Greeting({ band, dueCount }: { band: RhythmBand; dueCount: number }) {
  useLocale()
  return (
    <Arrival kind="fadeIn">
      <View>
        <View testID="today-cycle" style={styles.cycle}>
          <View testID="today-cycle-pulse" style={styles.pulse}>
            <PulseRing active>
              <View style={styles.dot} />
            </PulseRing>
          </View>
          <View testID="today-cycle-label">
            <Text variant="labelSm" color={accent.accentInk} style={styles.cycleLabel}>
              {copy.today.rhythm.cycle(copy.today.rhythm.band[band])}
            </Text>
          </View>
        </View>
        <View testID="today-greeting">
          <Text variant="title1" color={ink.ink} style={styles.hello}>
            {copy.today.rhythm.hello[band]}
          </Text>
        </View>
        <View testID="today-due" style={styles.due}>
          <Text variant="bodyMd" color={ink.ink2} style={styles.dueText}>
            {copy.today.rhythm.dueLead}
          </Text>
          <View testID="today-due-count">
            <Text variant="bodyMd" color={ink.ink} style={[styles.dueText, styles.dueCount]}>
              {copy.today.rhythm.dueCount(dueCount)}
            </Text>
          </View>
        </View>
      </View>
    </Arrival>
  )
}

const styles = StyleSheet.create({
  cycle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GREETING_CYCLE_GAP,
    marginBottom: GREETING_CYCLE_MB,
  },
  pulse: {
    width: PULSE_DOT,
    height: PULSE_DOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: PULSE_DOT,
    height: PULSE_DOT,
    borderRadius: PULSE_DOT,
    backgroundColor: accent.accent,
  },
  cycleLabel: { fontWeight: LABEL_BOLD_WEIGHT },
  hello: {
    fontSize: GREETING_TITLE,
    lineHeight: GREETING_LINE,
    letterSpacing: GREETING_TRACK,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  due: {
    marginTop: GREETING_DUE_MT,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  dueText: {
    fontSize: GREETING_DUE,
    lineHeight: GREETING_DUE_LINE,
  },
  dueCount: { fontWeight: GREETING_DUE_WEIGHT },
})
