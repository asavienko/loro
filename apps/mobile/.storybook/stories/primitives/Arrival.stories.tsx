import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Arrival, Text } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/Arrival',
  component: Arrival,
  args: { kind: 'popIn', children: <Text>Reward arrival</Text> },
} satisfies Meta<typeof Arrival>

export default meta
type Story = StoryObj<typeof meta>

export const PopIn: Story = {}
export const StepIn: Story = { args: { kind: 'stepIn' } }
export const FadeIn: Story = { args: { kind: 'fadeIn' } }
