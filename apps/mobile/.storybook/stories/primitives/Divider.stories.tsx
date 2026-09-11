import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Divider } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/Divider',
  component: Divider,
} satisfies Meta<typeof Divider>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
