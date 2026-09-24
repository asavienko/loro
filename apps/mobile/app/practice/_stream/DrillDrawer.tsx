import { StyleSheet, View } from 'react-native'
import { useLocale } from '../../../src/lib/i18n'
import { copy } from '../../../src/lib/copy'
import { haptics } from '../../../src/lib/haptics'
import { Arrival, Card, Pressable, Row, Text } from '../../../src/ui/primitives'
import { ink, semantic, space } from '../../../src/ui/theme'
import { DRILL_PAD_TOP } from './geometry'

export function DrillDrawer({
  open,
  onToggle,
  onMarkLearned,
}: {
  open: boolean
  onToggle: () => void
  onMarkLearned: () => void
}) {
  useLocale()
  return (
    <Arrival kind="fadeIn">
      <View testID="stream-drill-drawer" style={styles.wrap}>
      <Card padding={space['4']}>
        <Row justify="space-between" align="center" wrap>
          <View testID="stream-drill-title">
            <Text variant="labelSm" color={ink.ink2} style={styles.title}>
              {copy.stream.drill.title}
            </Text>
          </View>
          <Pressable
            feedback="row"
            pressMotion="deboss"
            accessibilityLabel={open ? copy.stream.drill.hide : copy.stream.drill.show}
            onPress={() => {
              haptics.select()
              onToggle()
            }}
          >
            <Text variant="labelSm" color={ink.ink} style={styles.toggle}>
              {open ? copy.stream.drill.hide : copy.stream.drill.show}
            </Text>
          </Pressable>
        </Row>
        {open && (
          <View style={styles.body}>
            <Pressable
              feedback="smallButton"
              pressMotion="deboss"
              accessibilityLabel={copy.common.markLearned}
              onPress={() => {
                haptics.confirm()
                onMarkLearned()
              }}
              style={styles.learned}
            >
              <Text variant="labelSm" color={semantic.success.text}>
                {copy.common.learnedBadge}
              </Text>
            </Pressable>
          </View>
        )}
      </Card>
      </View>
    </Arrival>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingTop: DRILL_PAD_TOP },
  title: { fontWeight: '700', textTransform: 'uppercase' },
  toggle: { fontWeight: '600' },
  body: { marginTop: space['3'] },
  learned: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
})
