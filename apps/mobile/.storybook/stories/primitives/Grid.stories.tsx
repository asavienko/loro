import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Grid, Pill } from '../../../src/ui/primitives'

const meta = {
  title: 'Primitives/Grid',
  component: Grid,
  args: {
    children: (
      <>
        <Pill label="First" />
        <Pill label="Second" />
      </>
    ),
  },
} satisfies Meta<typeof Grid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
