import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Button, PulseRing } from '../../../src/ui/primitives'
import { noop } from '../helpers'

const meta = {
  title: 'Primitives/PulseRing',
  component: PulseRing,
  args: {
    active: true,
    children: <Button label="Listening specimen" onPress={noop} />,
  },
} satisfies Meta<typeof PulseRing>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Idle: Story = { args: { active: false } }
