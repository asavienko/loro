import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Button } from '../../../src/ui/primitives'
import { noop } from '../helpers'

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { label: 'Continue', onPress: noop },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Ghost: Story = { args: { variant: 'ghost' } }
export const GhostHover: Story = { args: { variant: 'ghost', forcedHover: true } }
export const Destructive: Story = { args: { variant: 'destructive' } }
export const Large: Story = { args: { size: 'lg' } }
export const Cta: Story = { args: { size: 'cta' } }
export const Disabled: Story = { args: { disabled: true } }
export const Loading: Story = { args: { loading: true } }
export const PressedFocused: Story = { args: { forcedState: 'pressed-focused' } }
