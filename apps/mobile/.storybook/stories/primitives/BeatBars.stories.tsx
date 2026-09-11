import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { BeatBars } from '../../../src/ui/primitives'
import { BEAT_TEMPO_MS } from '../../../src/ui/motion'

const meta = {
  title: 'Primitives/BeatBars',
  component: BeatBars,
  args: { tempoMs: BEAT_TEMPO_MS.default },
} satisfies Meta<typeof BeatBars>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Speed: Story = { args: { tempoMs: BEAT_TEMPO_MS.speed } }
export const Idle: Story = { args: { active: false } }
