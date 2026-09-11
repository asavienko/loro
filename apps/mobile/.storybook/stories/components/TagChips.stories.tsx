import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { TAGS, type Tag } from '@loro/core'
import { TagChips } from '../../../src/ui/components'

const LABELS = {
  pron: 'Pronunciation',
  remember: 'Hard to remember',
  useful: 'Useful',
  words: 'New words',
} as const

function Playground() {
  const [value, setValue] = useState<Tag[]>(['useful'])
  return (
    <TagChips
      value={value}
      order={TAGS}
      labels={LABELS}
      selectedSuffix=" ✓"
      onToggle={(tag) => {
        setValue((current) =>
          current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
        )
      }}
    />
  )
}

const meta = {
  title: 'Components/TagChips',
  component: TagChips,
  render: () => <Playground />,
} satisfies Meta<typeof TagChips>

export default meta
type Story = StoryObj<typeof TagChips>

export const Default: Story = {}
