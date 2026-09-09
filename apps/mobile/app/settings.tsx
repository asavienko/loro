import { accents, type AccentName } from '@loro/design-tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { copy } from '../src/lib/copy'
import { useLocale } from '../src/lib/i18n'
import { useApp } from '../src/store'
import { Pressable, Screen, SectionLabel, Stack, Text } from '../src/ui/primitives'
import { border, ink, line, space, surface } from '../src/ui/theme'

const ACCENTS = Object.keys(accents) as AccentName[]

/** F-05/F-06: only durable settings with an implemented runtime effect appear here. */
export default function Settings() {
  useLocale()
  const preferences = useApp((state) => state.devicePreferences)
  const setAnalyticsConsent = useApp((state) => state.setAnalyticsConsent)
  const setVisualPreferences = useApp((state) => state.setVisualPreferences)
  const [saveError, setSaveError] = useState(false)

  const save = (operation: () => void): void => {
    try {
      operation()
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Stack gap={space['5']}>
          <Stack gap={space['1']}>
            <SectionLabel>{copy.settings.language}</SectionLabel>
            <SettingRow
              label={copy.languages.title}
              detail={copy.settings.languageDetail}
              onPress={() => {
                router.push('/languages')
              }}
            />
          </Stack>
          <Stack gap={space['1']}>
            <SectionLabel>{copy.settings.appearance}</SectionLabel>
            <Text variant="label">{copy.settings.accent}</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel={copy.settings.accent}>
              {ACCENTS.map((accent) => (
                <AccentRow
                  key={accent}
                  accent={accent}
                  selected={preferences.accent === accent}
                  onPress={() => {
                    save(() => {
                      setVisualPreferences(accent, preferences.motion)
                    })
                  }}
                />
              ))}
            </View>
            <Text variant="label">{copy.settings.motion}</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel={copy.settings.motion}>
              <ChoiceRow
                label={copy.settings.motionSystem}
                selected={preferences.motion === 'system'}
                onPress={() => {
                  save(() => {
                    setVisualPreferences(preferences.accent, 'system')
                  })
                }}
              />
              <ChoiceRow
                label={copy.settings.motionReduced}
                selected={preferences.motion === 'reduced'}
                onPress={() => {
                  save(() => {
                    setVisualPreferences(preferences.accent, 'reduced')
                  })
                }}
              />
            </View>
          </Stack>
          <Stack gap={space['1']}>
            <SectionLabel>{copy.settings.privacy}</SectionLabel>
            <ChoiceRow
              role="checkbox"
              label={copy.settings.analytics}
              detail={copy.settings.analyticsDetail}
              selected={preferences.analyticsConsent}
              onPress={() => {
                save(() => {
                  setAnalyticsConsent(!preferences.analyticsConsent)
                })
              }}
            />
          </Stack>
          {saveError && (
            <View accessibilityLiveRegion="polite">
              <Text>{copy.settings.saveError}</Text>
            </View>
          )}
        </Stack>
      </ScrollView>
    </Screen>
  )
}

function AccentRow({
  accent,
  selected,
  onPress,
}: {
  accent: AccentName
  selected: boolean
  onPress: () => void
}) {
  const labels: Record<AccentName, string> = {
    coral: copy.settings.accentCoral,
    sunset: copy.settings.accentSunset,
    teal: copy.settings.accentTeal,
    berry: copy.settings.accentBerry,
  }
  return (
    <ChoiceRow
      label={labels[accent]}
      selected={selected}
      onPress={onPress}
      markerColor={accents[accent].accent}
    />
  )
}

function SettingRow({
  label,
  detail,
  onPress,
}: {
  label: string
  detail: string
  onPress: () => void
}) {
  return (
    <Pressable feedback="row" accessibilityLabel={label} onPress={onPress} style={styles.row}>
      <View style={styles.copy}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" color={ink.muted}>
          {detail}
        </Text>
      </View>
      <Text color={ink.muted}>{copy.common.chevron.right}</Text>
    </Pressable>
  )
}

function ChoiceRow({
  label,
  detail,
  selected,
  onPress,
  markerColor,
  role = 'radio',
}: {
  label: string
  detail?: string
  selected: boolean
  onPress: () => void
  markerColor?: string
  role?: 'radio' | 'checkbox'
}) {
  return (
    <Pressable
      feedback="row"
      accessibilityRole={role}
      accessibilityLabel={label}
      selected={selected}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.copy}>
        <Text variant="body">{label}</Text>
        {detail && (
          <Text variant="caption" color={ink.muted}>
            {detail}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.marker,
          { backgroundColor: markerColor ?? surface.card, borderColor: markerColor ?? line.strong },
        ]}
      >
        {selected && (
          <Text variant="caption" color={markerColor ? ink.ink : ink.ink}>
            {copy.common.marks.reveal}
          </Text>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { padding: space['5'] },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
    paddingVertical: 13,
    borderBottomWidth: border.hairline,
    borderBottomColor: line.subtle,
  },
  copy: { flex: 1, gap: space['0.5'] },
  marker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
