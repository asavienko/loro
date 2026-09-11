import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Chip } from '../../../src/ui/primitives'
import { noop } from '../helpers'

const meta = {
  title: 'Primitives/Chip',
  component: Chip,
  args: { label: 'Selected chip', selected: true, onPress: noop },
} satisfies Meta<typeof Chip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unselected: Story = { args: { selected: false } }
