import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { StatRow } from '../../../src/ui/components'

const meta = {
  title: 'Components/StatRow',
  component: StatRow,
  args: {
    stats: [
      { value: '12', label: 'phrases' },
      { value: '3', label: 'reps' },
      { value: '2', label: 'days' },
    ],
  },
} satisfies Meta<typeof StatRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = {
  args: {
    stats: [
      { value: '0', label: 'phrases' },
      { value: '0', label: 'reps' },
      { value: '0', label: 'days' },
    ],
  },
}
