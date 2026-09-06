import { View } from 'react-native'
import { LANGUAGE_NAMES } from '@loro/core'
import { Pressable, SectionLabel, Stack, Text } from '../primitives'
import { accent, border, line, radius, space, surface } from '../theme'

/** Controlled language list. Caller owns copy, selection rules and persistence. */
export function LanguageChoices<T extends keyof typeof LANGUAGE_NAMES>({
  title,
  values,
  selected,
  onSelect,
}: {
  title: string
  values: readonly T[]
  selected: T
  onSelect: (value: T) => void
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={title}>
      <Stack gap={space['2']}>
        <SectionLabel>{title}</SectionLabel>
        {values.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={LANGUAGE_NAMES[value]}
            selected={value === selected}
            onPress={() => {
              onSelect(value)
            }}
            style={{
              padding: space['3'],
              borderRadius: radius.md,
              borderWidth: border.hairline,
              borderColor: value === selected ? accent.accentInk : line.default,
              backgroundColor: value === selected ? accent.tint : surface.card,
            }}
          >
            <Text lang={value}>{LANGUAGE_NAMES[value]}</Text>
          </Pressable>
        ))}
      </Stack>
    </View>
  )
}
