import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Pill } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/Pill',
  component: Pill,
  args: { label: 'Production pill', tone: 'accent' },
} satisfies Meta<typeof Pill>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Neutral: Story = { args: { tone: 'neutral' } }
export const OnDark: Story = { args: { tone: 'onDark' } }
export const WithEmoji: Story = { args: { emoji: '⭐' } }
