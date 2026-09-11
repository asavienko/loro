import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { AudioControls } from '../../../src/ui/components'
import { noop } from '../helpers'

const meta = {
  title: 'Components/AudioControls',
  component: AudioControls,
  args: {
    label: 'Play specimen audio',
    note: 'No device audio in this specimen.',
    enabled: false,
    onPress: noop,
  },
} satisfies Meta<typeof AudioControls>

export default meta
type Story = StoryObj<typeof meta>

export const Disabled: Story = {}
export const Enabled: Story = { args: { enabled: true, note: 'Ready to play.' } }
