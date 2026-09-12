import { View } from 'react-native'
import { LANGUAGE_NAMES } from '@loro/core'
import { stationeryElevation } from '../elevation'
import { Pressable, SectionLabel, Stack, Text } from '../primitives'
import { useTheme } from '../ThemeProvider'
import { MIN_TAP, ink, line, onDark, radius, semantic, space, surface } from '../theme'

const RADIO = 22
const RADIO_DOT = 8
const PLATE = 28

/** Decorative marks only — the accessible name stays `LANGUAGE_NAMES`. */
const LANGUAGE_FLAG: Record<keyof typeof LANGUAGE_NAMES, string> = {
  en: '🇬🇧',
  bg: '🇧🇬',
  ru: '🇷🇺',
  'es-ES': '🇪🇸',
  'bg-BG': '🇧🇬',
  'ru-RU': '🇷🇺',
}

/** Controlled language list. Caller owns copy, selection rules and persistence. */
export function LanguageChoices<T extends keyof typeof LANGUAGE_NAMES>({
  title,
  values,
  selected,
  onSelect,
  detail,
  badge,
}: {
  title: string
  values: readonly T[]
  selected: T
  onSelect: (value: T) => void
  /** Optional edition line under the language name — caller owns the copy. */
  detail?: ((value: T) => string | undefined) | undefined
  /** Optional sage chip beside the name — caller owns the copy. */
  badge?: ((value: T) => string | undefined) | undefined
}) {
  const { accent } = useTheme()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={title}>
      <Stack gap={space['1']}>
        <SectionLabel>{title}</SectionLabel>
        {values.map((value) => {
          const chosen = value === selected
          const name = LANGUAGE_NAMES[value]
          const subtitle = detail?.(value)
          const chip = badge?.(value)
          return (
            <Pressable
              key={value}
              pressMotion="deboss"
              elevation={chosen ? 'card' : undefined}
              accessibilityRole="radio"
              accessibilityLabel={name}
              selected={chosen}
              onPress={() => {
                onSelect(value)
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: MIN_TAP,
                gap: space['3'],
                paddingVertical: space['1'],
                paddingHorizontal: space['3'],
                borderRadius: radius.xl,
                backgroundColor: chosen ? accent.tint : surface.sunken,
                borderWidth: 1,
                borderColor: chosen ? accent.tintBorder : line.default,
                ...(chosen ? stationeryElevation('card') : null),
              }}
            >
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  width: PLATE,
                  height: PLATE,
                  borderRadius: PLATE / 2,
                  backgroundColor: chosen ? accent.wash : surface.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 16 }}>{LANGUAGE_FLAG[value]}</Text>
              </View>
              <View style={{ flex: 1, gap: space['0.5'] }}>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: space['1.5'],
                  }}
                >
                  <Text variant="body" lang={value} color={ink.ink}>
                    {name}
                  </Text>
                  {chip !== undefined && chip.length > 0 ? (
                    <View
                      style={{
                        paddingHorizontal: space['2'],
                        paddingVertical: space['0.5'],
                        borderRadius: radius.pill,
                        backgroundColor: semantic.success.bg,
                      }}
                    >
                      <Text variant="labelSm" color={semantic.successAlt.text}>
                        {chip}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {subtitle !== undefined && subtitle.length > 0 ? (
                  <Text variant="captionSm" color={ink.muted}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <View
                style={{
                  width: RADIO,
                  height: RADIO,
                  borderRadius: RADIO / 2,
                  borderWidth: chosen ? 0 : 1,
                  borderColor: line.strong,
                  backgroundColor: chosen ? accent.accent : surface.app,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {chosen ? (
                  <View
                    style={{
                      width: RADIO_DOT,
                      height: RADIO_DOT,
                      borderRadius: RADIO_DOT / 2,
                      backgroundColor: onDark.primary,
                    }}
                  />
                ) : null}
              </View>
            </Pressable>
          )
        })}
      </Stack>
    </View>
  )
}
