import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Equalizer } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/Equalizer',
  component: Equalizer,
  args: { active: true },
} satisfies Meta<typeof Equalizer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Idle: Story = { args: { active: false } }
