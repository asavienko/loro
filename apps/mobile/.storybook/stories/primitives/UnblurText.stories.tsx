import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { UnblurText } from '../../../src/ui/primitives'
import { SAMPLE_SPANISH } from '../helpers'

const meta = {
  title: 'Primitives/UnblurText',
  component: UnblurText,
  args: { text: SAMPLE_SPANISH, revealed: true, hiddenLabel: 'Hidden word' },
} satisfies Meta<typeof UnblurText>

export default meta
type Story = StoryObj<typeof meta>

export const Revealed: Story = {}
export const Hidden: Story = { args: { revealed: false } }
