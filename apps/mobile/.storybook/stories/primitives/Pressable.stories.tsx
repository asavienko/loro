import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Pressable, Text } from '../../../src/ui/primitives'
import { noop } from '../helpers'

const meta = {
  title: 'Primitives/Pressable',
  component: Pressable,
  args: {
    onPress: noop,
    accessibilityLabel: 'Production pressable',
    children: <Text>Focus or press this production control</Text>,
  },
} satisfies Meta<typeof Pressable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Selected: Story = { args: { selected: true } }
export const Disabled: Story = { args: { disabled: true } }
export const PressedFocused: Story = { args: { forcedState: 'pressed-focused' } }
