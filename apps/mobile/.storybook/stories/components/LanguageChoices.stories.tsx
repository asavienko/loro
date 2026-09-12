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

function WelcomeCadence() {
  const [selected, setSelected] = useState<'es-ES' | 'bg-BG' | 'ru-RU'>('es-ES')
  return (
    <LanguageChoices
      title="I want to learn"
      values={['es-ES', 'bg-BG', 'ru-RU']}
      selected={selected}
      onSelect={setSelected}
      detail={(value) =>
        value === 'es-ES'
          ? 'Castilian & Latin'
          : value === 'bg-BG'
            ? 'Authentic phrases'
            : 'Conversational course'
      }
      badge={(value) => (value === 'es-ES' ? 'Recommended' : undefined)}
    />
  )
}

export const Default: Story = {}
export const Welcome: Story = { render: () => <WelcomeCadence /> }
