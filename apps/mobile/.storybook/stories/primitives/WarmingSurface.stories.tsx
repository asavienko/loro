import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Text, WarmingSurface } from '../../../src/ui/primitives'
import { space } from '../../../src/ui/theme'

const meta = {
  title: 'Primitives/WarmingSurface',
  component: WarmingSurface,
  args: {
    automaticity: 50,
    style: { padding: space['3'] },
    children: <Text>Warming specimen</Text>,
  },
} satisfies Meta<typeof WarmingSurface>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Cold: Story = { args: { automaticity: 0 } }
export const Hot: Story = { args: { automaticity: 100 } }
