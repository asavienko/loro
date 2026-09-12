import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Segmented } from '../../../src/ui/primitives'

const OPTIONS = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two' },
] as const

const ADD_MODES = [
  { value: 'discover', label: 'Discover' },
  { value: 'browse', label: 'Browse' },
  { value: 'import', label: 'Import' },
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
export const ThreeModes: Story = {
  render: () => {
    const [value, setValue] = useState<(typeof ADD_MODES)[number]['value']>('browse')
    return <Segmented options={ADD_MODES} value={value} onChange={setValue} />
  },
}
export const Track: Story = { render: () => <Playground variant="track" /> }
