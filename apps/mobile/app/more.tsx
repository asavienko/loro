import { router } from 'expo-router'
import { ScrollView, StyleSheet } from 'react-native'
import { copy } from '../src/lib/copy'
import { useLocale } from '../src/lib/i18n'
import { destinationsForGroup, NAVIGATION_GROUPS } from '../src/lib/navigation'
import { Pressable, Screen, SectionLabel, Stack, Text } from '../src/ui/primitives'
import { border, ink, line, space } from '../src/ui/theme'

/** NAV-01/NAV-08; Navigation.dc.html:494–496. Only declared, built destinations. */
export default function More() {
  useLocale()
  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content}>
        {NAVIGATION_GROUPS.map((group) => {
          const destinations = destinationsForGroup(group)
          return destinations.length === 0 ? null : (
            <Stack key={group} gap={space['1']}>
              <SectionLabel>{copy.nav.moreGroups[group]}</SectionLabel>
              {destinations.map((destination) => (
                <DestinationRow key={destination.href} destination={destination} />
              ))}
            </Stack>
          )
        })}
      </ScrollView>
    </Screen>
  )
}

function DestinationRow({
  destination,
}: {
  destination: ReturnType<typeof destinationsForGroup>[number]
}) {
  return (
    <Pressable
      feedback="row"
      accessibilityLabel={destination.label}
      onPress={() => {
        router.push(destination.href)
      }}
      style={s.row}
    >
      <Text variant="body" color={ink.ink} style={s.label}>
        {destination.label}
      </Text>
      <Text variant="captionSm" color={ink.muted}>
        {copy.common.chevron.right}
      </Text>
    </Pressable>
  )
}

const ROW_PADDING = 13
const MIN_ROW_HEIGHT = 48
const s = StyleSheet.create({
  content: { padding: space['5'] },
  row: {
    minHeight: MIN_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2.5'],
    paddingVertical: ROW_PADDING,
    borderBottomWidth: border.hairline,
    borderBottomColor: line.subtle,
  },
  label: { flex: 1 },
})
