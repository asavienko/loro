import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Screen, Text } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/Screen',
  component: Screen,
  args: { children: <Text>Screen surface</Text> },
} satisfies Meta<typeof Screen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
