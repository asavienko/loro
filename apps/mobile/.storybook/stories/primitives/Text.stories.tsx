import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Text } from '../../../src/ui/primitives'
import { SAMPLE_SPANISH } from '../helpers'

const meta = {
  title: 'Primitives/Text',
  component: Text,
  args: { children: 'Production text' },
} satisfies Meta<typeof Text>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Title: Story = { args: { variant: 'title3' } }
export const Body: Story = { args: { variant: 'body' } }
export const LongCopy: Story = {
  args: {
    children: 'A longer line that must wrap at large text scale instead of clipping the phrase.',
  },
}
export const Spanish: Story = { args: { children: SAMPLE_SPANISH, lang: 'es' } }
