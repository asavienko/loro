import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { SectionLabel } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/SectionLabel',
  component: SectionLabel,
  args: { children: 'Section label' },
} satisfies Meta<typeof SectionLabel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Small: Story = { args: { size: 'sm' } }
