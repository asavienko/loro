import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { StatTile } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/StatTile',
  component: StatTile,
  args: { value: '12', label: 'phrases' },
} satisfies Meta<typeof StatTile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { value: '0' } }
