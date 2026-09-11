import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { CardHeader } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/CardHeader',
  component: CardHeader,
  args: { title: 'Card title', meta: '12 total' },
} satisfies Meta<typeof CardHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const CaptionMeta: Story = { args: { metaVariant: 'captionSm' } }
