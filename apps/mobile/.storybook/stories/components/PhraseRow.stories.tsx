import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { PhraseRow } from '../../../src/ui/components'
import { Pill } from '../../../src/ui/primitives'
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
export const Suggestion: Story = { args: { variant: 'suggestion' } }
export const WithTrailing: Story = {
  args: { trailing: <Pill label="Learning" /> },
}
