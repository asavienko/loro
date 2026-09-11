import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Card, Text } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/Card',
  component: Card,
  args: { children: <Text>Production card</Text> },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
