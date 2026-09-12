import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Field } from '../../../src/ui/primitives'

function Playground({
  initial,
  bordered,
  invalid,
  editable,
}: {
  initial: string
  bordered: boolean
  invalid: boolean
  editable: boolean
}) {
  const [value, setValue] = useState(initial)
  return (
    <Field
      accessibilityLabel="Story field"
      value={value}
      onChangeText={setValue}
      bordered={bordered}
      invalid={invalid}
      editable={editable}
    />
  )
}

const meta = {
  title: 'Primitives/Field',
  component: Field,
  render: () => <Playground initial="Search tokens" bordered invalid={false} editable />,
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof Field>

export const Default: Story = {}
export const Empty: Story = {
  render: () => (
    <Field
      accessibilityLabel="Empty story field"
      value=""
      onChangeText={() => undefined}
      placeholder="DM Sans placeholder"
      bordered
    />
  ),
}
export const Filled: Story = {
  render: () => <Playground initial="DM Sans account line" bordered invalid={false} editable />,
}
export const Literary: Story = {
  render: () => (
    <Field
      accessibilityLabel="Literary story field"
      literary
      value="¿Tienen una mesa para dos?"
      onChangeText={() => undefined}
      bordered
    />
  ),
}
export const Invalid: Story = {
  render: () => <Playground initial="oops" bordered invalid editable />,
}
export const Disabled: Story = {
  render: () => <Playground initial="Read only" bordered invalid={false} editable={false} />,
}
export const Unbordered: Story = {
  render: () => <Playground initial="Inside a card" bordered={false} invalid={false} editable />,
}
