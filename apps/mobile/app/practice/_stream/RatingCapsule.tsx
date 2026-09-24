import { StyleSheet, View } from 'react-native'
import { useLocale } from '../../../src/lib/i18n'
import { copy } from '../../../src/lib/copy'
import { Arrival } from '../../../src/ui/primitives'
import { DifficultySelector } from '../../../src/ui/components'
import { stationeryElevation } from '../../../src/ui/elevation'
import { line, radius, surface } from '../../../src/ui/theme'
import { CAPSULE_PAD, CAPSULE_PAD_BOTTOM, CAPSULE_PAD_TOP } from './geometry'
import type { Difficulty } from '@loro/core'

export function RatingCapsule({
  value,
  onRate,
}: {
  value: Difficulty
  onRate: (difficulty: Difficulty) => void
}) {
  useLocale()
  return (
    <Arrival kind="fadeIn">
      <View testID="stream-rating-wrap" style={styles.wrap}>
        <View testID="stream-rating-capsule" style={[styles.capsule, stationeryElevation('emblemSoft')]}>
          <DifficultySelector
            layout="segmented"
            value={value}
            labels={copy.difficulty}
            onChange={onRate}
          />
        </View>
      </View>
    </Arrival>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: '100%',
    paddingTop: CAPSULE_PAD_TOP,
    paddingBottom: CAPSULE_PAD_BOTTOM,
  },
  capsule: {
    alignSelf: 'stretch',
    maxWidth: 320,
    width: '100%',
    padding: CAPSULE_PAD,
    borderRadius: radius.pill,
    backgroundColor: surface.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.default,
  },
})
