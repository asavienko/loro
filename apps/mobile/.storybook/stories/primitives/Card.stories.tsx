import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { stationeryElevation } from '../../../src/ui/elevation'
import { Card, Pressable, Text } from '../../../src/ui/primitives'
import { radius, space, surface } from '../../../src/ui/theme'
import { noop } from '../helpers'

const meta = {
  title: 'Primitives/Card',
  component: Card,
  args: { children: <Text>Production card</Text> },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const RaisedInteractive: Story = {
  render: () => (
    <Pressable
      pressMotion="deboss"
      elevation="interactive"
      accessibilityLabel="Raised interactive card"
      onPress={noop}
      style={{
        borderRadius: radius.xl,
        padding: space['4'],
        backgroundColor: surface.card,
        ...stationeryElevation('interactive'),
      }}
    >
      <Text>Raised interactive card</Text>
    </Pressable>
  ),
}
export const DebossedPress: Story = {
  render: () => (
    <Pressable
      pressMotion="deboss"
      elevation="card"
      forcedState="pressed-focused"
      accessibilityLabel="Pressed stationery card"
      onPress={noop}
      style={stationeryElevation('card')}
    >
      <Card elevate={false}>
        <Text>Pressed stationery card</Text>
      </Card>
    </Pressable>
  ),
}
