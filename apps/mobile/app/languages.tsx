import { useLocale } from '../src/lib/i18n'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { router } from 'expo-router'
import { NATIVE_LANGUAGES, TARGET_LOCALES, supportsPair } from '@loro/core'
import { useApp } from '../src/store'
import { LanguageChoices } from '../src/ui/components/LanguageChoices'
import { Button, Screen, Stack, Text } from '../src/ui/primitives'
import { space } from '../src/ui/theme'
import { copy } from '../src/lib/copy'
export default function Languages() {
  useLocale()
  const currentNative = useApp((state) => state.nativeLanguage)
  const currentTarget = useApp((state) => state.targetLocale)
  const setLanguages = useApp((state) => state.setLanguages)
  const [native, setNative] = useState(currentNative)
  const [target, setTarget] = useState(currentTarget)
  const valid = supportsPair(native, target)
  const save = (): void => {
    if (!valid) return
    setLanguages(native, target)
    router.replace(useApp.getState().onboarded ? '/' : '/onboarding')
  }
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space['4'] }}>
        <Stack gap={space['4']}>
          <LanguageChoices
            title={copy.languages.native}
            values={NATIVE_LANGUAGES}
            selected={native}
            onSelect={setNative}
          />
          <LanguageChoices
            title={copy.languages.target}
            values={TARGET_LOCALES.filter((value) => supportsPair(native, value))}
            selected={target}
            onSelect={setTarget}
          />
          {!valid && <Text>{copy.languages.invalid}</Text>}
          <Text>{copy.languages.review}</Text>
          <Button label={copy.languages.save} disabled={!valid} onPress={save} />
        </Stack>
      </ScrollView>
    </Screen>
  )
}
