import { View, StyleSheet } from 'react-native'
import { useLocale } from '../../src/lib/i18n'
import { copy } from '../../src/lib/copy'
import { Arrival, Text } from '../../src/ui/primitives'
import { stationeryElevation } from '../../src/ui/elevation'
import { accent, ink, surface, type } from '../../src/ui/theme'
import {
  INSIGHT_BODY,
  INSIGHT_BODY_LINE,
  INSIGHT_COUNT,
  INSIGHT_COUNT_LINE,
  INSIGHT_GAP,
  INSIGHT_ICON,
  INSIGHT_ICON_RADIUS,
  INSIGHT_PAD,
  INSIGHT_PB,
  INSIGHT_RADIUS,
  INSIGHT_TITLE,
  INSIGHT_TITLE_LINE,
} from './geometry'

export function InsightCard({ graduated }: { graduated: number }) {
  useLocale()
  return (
    <Arrival kind="fadeIn">
      <View testID="today-insight-section" style={styles.section}>
      <View
        testID="today-insight"
        accessible
        accessibilityLabel={copy.a11y.today.banked(graduated)}
        aria-label={copy.a11y.today.banked(graduated)}
        style={styles.card}
      >
        <View testID="today-insight-icon" style={[styles.icon, stationeryElevation('emblemSoft')]}>
          <View testID="today-insight-count">
            <Text variant="title3" color={accent.accentInk} style={styles.count}>
              {String(graduated)}
            </Text>
          </View>
        </View>
        <View style={styles.copy}>
          <View testID="today-insight-title">
            <Text variant="title3" color={ink.ink} numberOfLines={1} style={styles.title}>
              {copy.today.rhythm.insightTitle}
            </Text>
          </View>
          <Text variant="caption" color={ink.ink2} numberOfLines={2} style={styles.body}>
            {copy.today.day.banked}
          </Text>
        </View>
      </View>
      </View>
    </Arrival>
  )
}

const styles = StyleSheet.create({
  section: { paddingBottom: INSIGHT_PB },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: INSIGHT_GAP,
    padding: INSIGHT_PAD,
    borderRadius: INSIGHT_RADIUS,
    backgroundColor: surface.sunken2,
  },
  icon: {
    width: INSIGHT_ICON,
    height: INSIGHT_ICON,
    borderRadius: INSIGHT_ICON_RADIUS,
    backgroundColor: surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  count: {
    fontFamily: type.title3.fontFamily,
    fontSize: INSIGHT_COUNT,
    lineHeight: INSIGHT_COUNT_LINE,
    fontWeight: '600',
  },
  title: {
    fontFamily: type.title3.fontFamily,
    fontSize: INSIGHT_TITLE,
    lineHeight: INSIGHT_TITLE_LINE,
    fontWeight: '600',
  },
  body: {
    fontFamily: type.bodyMd.fontFamily,
    fontSize: INSIGHT_BODY,
    lineHeight: INSIGHT_BODY_LINE,
  },
})
