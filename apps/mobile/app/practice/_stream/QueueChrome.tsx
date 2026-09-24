import { StyleSheet, View } from 'react-native'
import { useLocale } from '../../../src/lib/i18n'
import { copy } from '../../../src/lib/copy'
import { Text } from '../../../src/ui/primitives'
import { ink } from '../../../src/ui/theme'
import {
  KICKER_PAD_X,
  QUEUE_HEADER_COUNT,
  QUEUE_HEADER_COUNT_MAX,
  QUEUE_HEADER_COUNT_MT,
  QUEUE_HEADER_TITLE,
  QUEUE_HEADER_TITLE_LINE,
  QUEUE_HEADER_TITLE_TRACK,
} from './geometry'

export function QueueChrome({ count }: { count: number }) {
  useLocale()
  return (
    <View testID="stream-queue-chrome" style={styles.wrap}>
      <Text variant="title3" color={ink.ink} align="center" numberOfLines={1} style={styles.title}>
        {copy.stream.queue.title}
      </Text>
      <Text variant="caption" color={ink.ink2} align="center" numberOfLines={1} style={styles.kicker}>
        {copy.stream.queue.kicker(count)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: KICKER_PAD_X },
  title: {
    fontSize: QUEUE_HEADER_TITLE,
    fontWeight: '600',
    lineHeight: QUEUE_HEADER_TITLE_LINE,
    letterSpacing: QUEUE_HEADER_TITLE_TRACK,
  },
  kicker: {
    fontSize: QUEUE_HEADER_COUNT,
    fontWeight: '500',
    marginTop: QUEUE_HEADER_COUNT_MT,
    maxWidth: QUEUE_HEADER_COUNT_MAX,
    textTransform: 'none',
  },
})
