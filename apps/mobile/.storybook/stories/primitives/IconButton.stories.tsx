import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { IconButton } from '../../../src/ui/primitives'
import { noop } from '../helpers'

const meta = {
  title: 'Primitives/IconButton',
  component: IconButton,
  args: { glyph: '♪', label: 'Play', onPress: noop },
} satisfies Meta<typeof IconButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
export const PressedFocused: Story = { args: { forcedState: 'pressed-focused' } }
