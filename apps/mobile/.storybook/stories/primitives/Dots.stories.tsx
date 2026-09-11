import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Dots } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/Dots',
  component: Dots,
  args: { count: 5, filled: 3 },
} satisfies Meta<typeof Dots>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { filled: 0 } }
