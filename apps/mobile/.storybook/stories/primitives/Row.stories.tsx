import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Row, Text } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/Row',
  component: Row,
  args: {
    wrap: true,
    children: (
      <>
        <Text>First</Text>
        <Text>Second</Text>
      </>
    ),
  },
} satisfies Meta<typeof Row>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
