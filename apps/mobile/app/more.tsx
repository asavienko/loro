import { router } from 'expo-router'
import { ScrollView, StyleSheet } from 'react-native'
import { copy } from '../src/lib/copy'
import { useLocale } from '../src/lib/i18n'
import { destinationsForGroup, NAVIGATION_GROUPS } from '../src/lib/navigation'
import { ListRow, Screen, SectionLabel, Stack, Text } from '../src/ui/primitives'
import { ink, space } from '../src/ui/theme'

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
    <ListRow
      accessibilityLabel={destination.label}
      onPress={() => {
        router.push(destination.href)
      }}
      gap={space['2.5']}
    >
      <Text variant="body" color={ink.ink} style={s.label}>
        {destination.label}
      </Text>
      <Text variant="captionSm" color={ink.muted}>
        {copy.common.chevron.right}
      </Text>
    </ListRow>
  )
}

const s = StyleSheet.create({
  content: { padding: space['5'] },
  label: { flex: 1 },
})
