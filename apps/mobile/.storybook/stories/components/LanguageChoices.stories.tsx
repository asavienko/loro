import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { LanguageChoices } from '../../../src/ui/components'

function Playground() {
  const [selected, setSelected] = useState<'en' | 'bg' | 'ru'>('bg')
  return (
    <LanguageChoices
      title="UI language"
      values={['en', 'bg', 'ru']}
      selected={selected}
      onSelect={setSelected}
    />
  )
}

const meta = {
  title: 'Components/LanguageChoices',
  component: LanguageChoices,
  render: () => <Playground />,
} satisfies Meta<typeof LanguageChoices>

export default meta
type Story = StoryObj<typeof LanguageChoices>

export const Default: Story = {}
