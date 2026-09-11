import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { ProgressBar } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/ProgressBar',
  component: ProgressBar,
  args: { value: 0.64, label: 'Production progress' },
} satisfies Meta<typeof ProgressBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { value: 0 } }
export const Complete: Story = { args: { value: 1 } }
