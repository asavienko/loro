import { Button, Stack, Text } from '../primitives'
import { ink, space } from '../theme'
import { View } from 'react-native'

/** Metadata-only control: parent provides translated labels and native commands. */
export function AudioControls({
  label,
  note,
  enabled,
  onPress,
}: {
  label: string
  note: string
  enabled: boolean
  onPress: () => void
}) {
  return (
    <Stack gap={space['2']}>
      <Button label={label} variant="secondary" disabled={!enabled} onPress={onPress} />
      <View accessibilityLiveRegion="polite">
        <Text variant="captionSm" color={ink.muted} align="center">
          {note}
        </Text>
      </View>
    </Stack>
  )
}
