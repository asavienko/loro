/** F-08/P2-03: sync must accept the same courses as local language selection. */
import { describe, expect, it } from 'vitest'
import { NATIVE_LANGUAGES, TARGET_LOCALES, supportsPair } from '../domain/languages.js'
import {
  ChangeSchema,
  refrainDayValues,
  rowIdFor,
  settingsValues,
  userPhraseValues,
} from './sync.js'

describe('shared language registry across sync boundaries', () => {
  it('keeps every supported pair selectable and rejects same-language or unsupported pairs', () => {
    for (const nativeLanguage of [...NATIVE_LANGUAGES, 'de']) {
      for (const targetLocale of [...TARGET_LOCALES, 'en', 'en-US', 'de-DE']) {
        expect(
          settingsValues.languagePair.safeParse({ nativeLanguage, targetLocale }).success,
          `${nativeLanguage} → ${targetLocale}`,
        ).toBe(supportsPair(nativeLanguage, targetLocale))
      }
    }
  })

  it('carries each supported target through phrase fields, course days and catalog tombstones', () => {
    for (const targetLocale of TARGET_LOCALES) {
      expect(userPhraseValues.targetLocale.parse(targetLocale)).toBe(targetLocale)
      expect(refrainDayValues.targetLocale.parse(targetLocale)).toBe(targetLocale)
      const courseDay = `${targetLocale}:2026-09-09`
      expect(rowIdFor('refrain_day').parse(courseDay)).toBe(courseDay)
      const tombstone = {
        entity: 'user_phrase',
        entity_id: '0197a001-0000-7000-8000-000000000001',
        fields: {},
        deleted_at: 1,
        catalog_identity: { phraseId: 'a1', targetLocale },
      }
      expect(ChangeSchema.parse(tombstone)).toEqual(tombstone)
    }
  })

  it('preserves legacy day keys and rejects unsupported locales and malformed course days', () => {
    const schema = rowIdFor('refrain_day')
    expect(schema.parse('2026-09-09')).toBe('2026-09-09')
    for (const key of [
      'en-US:2026-09-09',
      'de-DE:2026-09-09',
      'es-ES2026-09-09',
      'es-ES:2026-02-30',
      'es-ES:2026-09-09:extra',
    ]) {
      expect(schema.safeParse(key).success, key).toBe(false)
    }
  })
})
