import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useLocale } from '../../../src/lib/i18n'
import { copy } from '../../../src/lib/copy'
import { haptics } from '../../../src/lib/haptics'
import { Pressable, Text } from '../../../src/ui/primitives'
import { ink, radius, surface } from '../../../src/ui/theme'
import { BACK, BACK_FACE, BACK_NUDGE, HEADER_TITLE_TRACK } from './geometry'

/** HTML pack-detail `w-11 h-11` back. Warm pops; cold escapes to Today. Spine stays. */
export function PackBack({ canGoBack }: { canGoBack: boolean }) {
  useLocale()
  const warm = canGoBack
  return (
    <View testID="review-pack-back" style={styles.well}>
      <Pressable
        feedback="icon"
        pressMotion="deboss"
        accessibilityRole={warm ? 'link' : 'button'}
        accessibilityLabel={warm ? copy.a11y.common.back : copy.nav.home}
        onPress={() => {
          haptics.select()
          if (warm) router.back()
          else router.replace('/')
        }}
        style={styles.hit}
      >
        <View testID="review-pack-back-mark">
          <Text color={ink.ink} style={styles.backGlyph}>
            {copy.common.chevron.left}
          </Text>
        </View>
      </Pressable>
    </View>
  )
}

/** HTML pack-detail `font-headline-sm tracking-tight`. Size/weight stay title3. */
export function PackTitle() {
  useLocale()
  return (
    <View testID="review-pack-title">
      <Text variant="title3" color={ink.ink} numberOfLines={1} style={styles.title}>
        {copy.review.title}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  title: { letterSpacing: HEADER_TITLE_TRACK },
  backGlyph: { fontSize: BACK_FACE, lineHeight: BACK_FACE },
  well: {
    width: BACK,
    height: BACK,
    borderRadius: radius.pill,
    backgroundColor: surface.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginLeft: BACK_NUDGE,
  },
  hit: {
    width: BACK,
    height: BACK,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
