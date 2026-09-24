import { StyleSheet, View } from 'react-native'
import { useLocale } from '../../../src/lib/i18n'
import { copy } from '../../../src/lib/copy'
import { haptics } from '../../../src/lib/haptics'
import { Pressable, Row, Text } from '../../../src/ui/primitives'
import { stationeryElevations } from '../../../src/ui/elevation'
import { accent, ink, line, radius, space, surface } from '../../../src/ui/theme'
import { CADENCE_RATES, type CadenceRate } from '../../../src/lib/streamCadence'
import {
  CADENCE_FACE_WEIGHT,
  CADENCE_FACE_WEIGHT_ON,
  CADENCE_PAD_X,
  CADENCE_PAD_X_ON,
  CADENCE_PAD_Y,
  CADENCE_ROW_Y,
  ratePillShadows,
} from './geometry'

export function RatePills({ rate, onRate }: { rate: CadenceRate; onRate: (next: CadenceRate) => void }) {
  useLocale()
  return (
    <View testID="stream-rate-row" style={styles.row}>
    <Row justify="center" align="center" wrap gap={space['1.5']}>
      {CADENCE_RATES.map((option) => {
        const selected = option === rate
        return (
          <View
            key={String(option)}
            testID={selected ? 'stream-rate-pill-selected' : 'stream-rate-pill'}
            style={stationeryElevations(ratePillShadows(selected))}
          >
            <Pressable
              feedback="smallButton"
              pressMotion="deboss"
              accessibilityLabel={copy.a11y.stream.rate(option)}
              selected={selected}
              onPress={() => {
                haptics.select()
                onRate(option)
              }}
              style={[styles.pill, selected && styles.selected]}
            >
              <Text
                variant="labelSm"
                color={selected ? accent.accentInk : ink.ink2}
                style={selected ? styles.labelOn : styles.label}
              >
                {copy.stream.cadence.rate(option)}
              </Text>
            </Pressable>
          </View>
        )
      })}
    </Row>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { width: '100%', paddingVertical: CADENCE_ROW_Y },
  pill: {
    paddingHorizontal: CADENCE_PAD_X,
    paddingVertical: CADENCE_PAD_Y,
    borderRadius: radius.pill,
    backgroundColor: surface.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.default,
  },
  selected: {
    paddingHorizontal: CADENCE_PAD_X_ON,
    backgroundColor: accent.tint,
    borderColor: accent.tintBorder,
  },
  label: { fontWeight: String(CADENCE_FACE_WEIGHT) as '500' },
  labelOn: { fontWeight: String(CADENCE_FACE_WEIGHT_ON) as '700' },
})
