import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { SectionHeader } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/SectionHeader',
  component: SectionHeader,
  args: { label: 'Section', hint: 'tap to toggle' },
} satisfies Meta<typeof SectionHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Caption: Story = { args: { variant: 'caption' } }
export const WithoutHint: Story = { args: { hint: undefined } }
