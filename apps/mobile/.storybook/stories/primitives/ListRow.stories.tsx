import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { ListRow, Text } from '../../../src/ui/primitives'
import { space } from '../../../src/ui/theme'
import { noop } from '../helpers'

const meta = {
  title: 'Primitives/ListRow',
  component: ListRow,
  args: {
    accessibilityLabel: 'Production list row',
    gap: space['2.5'],
    onPress: noop,
    children: <Text>Production list row</Text>,
  },
} satisfies Meta<typeof ListRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Selected: Story = { args: { selected: true } }
export const Disabled: Story = { args: { disabled: true } }
export const SettingsGap: Story = { args: { gap: space['3'] } }
