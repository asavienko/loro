import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Button, Sheet, Text } from '../../../src/ui/primitives'
import { space } from '../../../src/ui/theme'

function Playground() {
  const [visible, setVisible] = useState(false)
  return (
    <>
      <Button
        label="Open sheet"
        onPress={() => {
          setVisible(true)
        }}
      />
      <Sheet
        visible={visible}
        onDismiss={() => {
          setVisible(false)
        }}
        dismissLabel="Dismiss sheet"
      >
        <Text style={{ padding: space['4'] }}>Production sheet contents</Text>
      </Sheet>
    </>
  )
}

const meta = {
  title: 'Primitives/Sheet',
  component: Sheet,
  render: () => <Playground />,
} satisfies Meta<typeof Sheet>

export default meta
type Story = StoryObj<typeof Sheet>

export const Default: Story = {}
