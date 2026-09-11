import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import type { Difficulty } from '@loro/core'
import { DifficultySelector } from '../../../src/ui/components'

const LABELS = { easy: 'Easy', med: 'Medium', hard: 'Hard' } as const

function Playground({
  layout,
  density,
}: {
  layout: 'cards' | 'segmented'
  density: 'default' | 'tight'
}) {
  const [value, setValue] = useState<Difficulty>('med')
  return (
    <DifficultySelector
      value={value}
      onChange={setValue}
      labels={LABELS}
      layout={layout}
      density={density}
    />
  )
}

const meta = {
  title: 'Components/DifficultySelector',
  component: DifficultySelector,
  render: () => <Playground layout="cards" density="default" />,
} satisfies Meta<typeof DifficultySelector>

export default meta
type Story = StoryObj<typeof DifficultySelector>

export const Cards: Story = {}
export const TightCards: Story = { render: () => <Playground layout="cards" density="tight" /> }
export const Segmented: Story = {
  render: () => <Playground layout="segmented" density="default" />,
}
