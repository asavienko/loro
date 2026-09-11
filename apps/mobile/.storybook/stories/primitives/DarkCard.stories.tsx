import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { DarkCard, Text } from '../../../src/ui/primitives'
import { onDark } from '../../../src/ui/theme'

const meta = {
  title: 'Primitives/DarkCard',
  component: DarkCard,
  args: { children: <Text color={onDark.primary}>Dark stage specimen</Text> },
} satisfies Meta<typeof DarkCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
