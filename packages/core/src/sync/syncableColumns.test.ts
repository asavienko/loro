/**
 * Phrase/settings SQL names, wire keys and merge classes must stay one list.
 * A fourth copy is how a new field silently misses the wire or the upsert.
 */
import { describe, expect, it } from 'vitest'
import { excludedSettingsFields, settingsValues, userPhraseValues } from '../api/sync.js'
import { PHRASE_COLUMN_NAMES } from '../persistence/sqlite/phrase.js'
import { FIELD_POLICY } from './fieldPolicy.js'
import {
  PHRASE_STORAGE_ONLY_COLUMNS,
  PHRASE_SYNC_SQL_COLUMNS,
  PHRASE_WIRE_TO_SQL,
  SETTINGS_DEVICE_ONLY_FIELDS,
  SETTINGS_SYNC_FIELDS,
  SETTINGS_WIRE_TO_SQL,
  USER_PHRASE_SYNC_FIELDS,
} from './syncableColumns.js'

const sorted = (values: readonly string[]): string[] => [...values].sort()

describe('syncable column map', () => {
  it('is the merge policy for user_phrase and settings', () => {
    expect(sorted(Object.keys(FIELD_POLICY.user_phrase))).toEqual(
      sorted(USER_PHRASE_SYNC_FIELDS.map((field) => field.wire)),
    )
    expect(sorted(Object.keys(FIELD_POLICY.settings))).toEqual(
      sorted(SETTINGS_SYNC_FIELDS.map((field) => field.wire)),
    )
  })

  it('covers every user_phrase SQL column except identity and HLC stamps', () => {
    expect(sorted(PHRASE_COLUMN_NAMES)).toEqual(
      sorted([...PHRASE_STORAGE_ONLY_COLUMNS, ...PHRASE_SYNC_SQL_COLUMNS]),
    )
  })

  it('matches the wire value shapes', () => {
    expect(sorted(Object.keys(userPhraseValues))).toEqual(
      sorted(USER_PHRASE_SYNC_FIELDS.map((field) => field.wire)),
    )
    expect(sorted(Object.keys(settingsValues))).toEqual(sorted(Object.keys(SETTINGS_WIRE_TO_SQL)))
    expect(sorted(excludedSettingsFields)).toEqual(sorted(SETTINGS_DEVICE_ONLY_FIELDS))
  })

  it('exposes the wire→SQL dictionaries the mobile sync adapter consumes', () => {
    expect(PHRASE_WIRE_TO_SQL.deletedAt).toBe('deleted_at')
    expect(PHRASE_WIRE_TO_SQL.targetLocale).toBe('target_locale')
    expect(SETTINGS_WIRE_TO_SQL.languagePair).toBe('language_pair')
    expect(SETTINGS_WIRE_TO_SQL).not.toHaveProperty('cloudAsrConsent')
  })
})
