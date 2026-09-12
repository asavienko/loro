import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { PhraseRow } from '../../../src/ui/components'
import { Pill, Text } from '../../../src/ui/primitives'
import { accent, radius, space, surface } from '../../../src/ui/theme'
import { SAMPLE_SPANISH, noop } from '../helpers'

const meta = {
  title: 'Components/PhraseRow',
  component: PhraseRow,
  args: {
    targetText: SAMPLE_SPANISH,
    translation: 'Do you have a table for two?',
    emoji: '☕',
    onPress: noop,
    accessibilityLabel: 'Production phrase row',
  },
} satisfies Meta<typeof PhraseRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithEyebrow: Story = { args: { eyebrow: 'Café & ordering' } }
export const Queue: Story = {
  args: {
    variant: 'queue',
    eyebrow: 'Café & ordering',
    trailing: <Pill label="Learning" />,
  },
}
export const Suggestion: Story = { args: { variant: 'suggestion' } }
export const SuggestionQueue: Story = {
  args: {
    variant: 'suggestion',
    eyebrow: 'Café',
    trailing: (
      <View
        style={{
          paddingHorizontal: space['3'],
          paddingVertical: space['1.5'],
          borderRadius: radius.pill,
          backgroundColor: accent.accent,
        }}
      >
        <Text variant="labelSm" color={surface.app}>
          Queue
        </Text>
      </View>
    ),
  },
}
export const WithTrailing: Story = {
  args: { trailing: <Pill label="Learning" /> },
}
