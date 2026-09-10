import type { ListeningVoice, TargetLocale } from '@loro/core'

/** Fixture model id for `__DEV__` native generate. Not a Q-15 pin. */
export const DEV_LISTENING_FIXTURE_MODEL_ID = 'dev-listen-fixture'

/** Unlicensed development voices. Never merge into `APPROVED_LISTENING_VOICES`. */
export function devListeningFixtureVoices(locale: TargetLocale): readonly ListeningVoice[] {
  return [
    { id: 'dev-listen-a', locale, name: 'Dev A', licensed: false },
    { id: 'dev-listen-b', locale, name: 'Dev B', licensed: false },
  ]
}
