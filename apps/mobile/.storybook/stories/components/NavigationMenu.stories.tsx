import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { NavigationMenu } from '../../../src/ui/components'
import { noop } from '../helpers'

const meta = {
  title: 'Components/NavigationMenu',
  component: NavigationMenu,
  args: {
    place: 'Workbench',
    openLabel: 'Open specimen navigation',
    title: 'Specimen navigation',
    groupLabel: 'Destinations',
    dismissLabel: 'Close specimen navigation',
    hereLabel: 'You are here',
    reveal: '⌄',
    chevron: '›',
    destinations: [
      {
        label: 'Workbench',
        current: true,
        currentLabel: 'Workbench, current destination',
        onPress: noop,
      },
      {
        label: 'Example destination',
        current: false,
        currentLabel: 'Example destination',
        onPress: noop,
      },
    ],
  },
} satisfies Meta<typeof NavigationMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
