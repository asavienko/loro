import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ActionBar } from '../../../src/ui/components'
import { Button } from '../../../src/ui/primitives'
import { noop } from '../helpers'

const meta = {
  title: 'Components/ActionBar',
  component: ActionBar,
  args: {
    children: <Button label="Primary action" onPress={noop} />,
  },
  decorators: [
    (Story) => (
      <View style={{ minHeight: 180, position: 'relative' }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof ActionBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Row: Story = {
  args: {
    direction: 'row',
    children: (
      <>
        <Button label="Remove" variant="secondary" onPress={noop} />
        <Button label="Practice" onPress={noop} />
      </>
    ),
  },
}
