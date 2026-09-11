import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { ChartSummary } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/ChartSummary',
  component: ChartSummary,
  args: { children: 'Visible summary for a production chart.' },
} satisfies Meta<typeof ChartSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
