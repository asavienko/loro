import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Dot } from '../../../src/ui/primitives'
import { semantic } from '../../../src/ui/theme'

const meta = {
  title: 'Primitives/Dot',
  component: Dot,
  args: { size: 9, color: semantic.danger.text },
} satisfies Meta<typeof Dot>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
