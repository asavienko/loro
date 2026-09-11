import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { EmptyState } from '../../../src/ui/components'
import { space } from '../../../src/ui/theme'
import { noop } from '../helpers'

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  args: {
    title: 'Nothing here yet',
    body: 'The same component learner routes use, with developer-only specimen copy.',
    padding: space['3'],
  },
  decorators: [
    (Story) => (
      <View style={{ minHeight: 180 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithAction: Story = {
  args: { action: { label: 'Add a phrase', onPress: noop } },
}
