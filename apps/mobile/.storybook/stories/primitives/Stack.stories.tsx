import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Stack, Text } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/Stack',
  component: Stack,
  args: {
    children: (
      <>
        <Text>First</Text>
        <Text>Second</Text>
      </>
    ),
  },
} satisfies Meta<typeof Stack>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
