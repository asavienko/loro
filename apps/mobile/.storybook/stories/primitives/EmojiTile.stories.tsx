import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { EmojiTile } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/EmojiTile',
  component: EmojiTile,
  args: { emoji: '🦜' },
} satisfies Meta<typeof EmojiTile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
