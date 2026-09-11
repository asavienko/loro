import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Segmented } from '../../../src/ui/primitives'

const OPTIONS = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two' },
] as const

function Playground({ variant }: { variant: 'pill' | 'track' }) {
  const [value, setValue] = useState<(typeof OPTIONS)[number]['value']>('one')
  return <Segmented options={OPTIONS} value={value} onChange={setValue} variant={variant} />
}

const meta = {
  title: 'Primitives/Segmented',
  component: Segmented,
  render: () => <Playground variant="pill" />,
} satisfies Meta<typeof Segmented>

export default meta
type Story = StoryObj<typeof Segmented>

export const Default: Story = {}
export const Track: Story = { render: () => <Playground variant="track" /> }
