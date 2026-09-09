/**
 * One list of syncable phrase and settings fields: wire camelCase, SQL snake_case, merge class.
 *
 * `FIELD_POLICY` merge maps, SQL `PHRASE_COLUMN_NAMES` (drift-checked) and the mobile
 * wire→SQL dictionaries all consume this module so a fourth field cannot miss one of the
 * three former copies. Per-table `ON CONFLICT` upserts stay handwritten; this is not a
 * generic upsert helper.
 *
 * Policy `SyncEntity` includes trip / trip_drop / trip_phrase for planned merge (plan 69 /
 * Q-07). Wire `SyncEntity` in `api/sync.ts` does not — those entities must not be added to
 * the wire as a cleanup.
 */

import type { MergeClass } from './fieldPolicy.js'

export interface SyncableColumn {
  readonly wire: string
  readonly sql: string
  readonly merge: MergeClass
  /** Absent from the push/pull envelope. Device-only SQL that still has a merge class. */
  readonly onWire?: false
}

/**
 * Columns on `user_phrase` that are not syncable fields: identity, the write's HLC stamp,
 * and merge-owned clocks. `deleted_at` is syncable (tombstone).
 */
export const PHRASE_STORAGE_ONLY_COLUMNS = ['id', 'user_id', 'updated_hlc', 'field_hlc'] as const

export const USER_PHRASE_SYNC_FIELDS = [
  { wire: 'targetLocale', sql: 'target_locale', merge: 'lww' },
  { wire: 'ownMeaningLanguage', sql: 'own_meaning_language', merge: 'lww' },
  // identity — set once, never merged
  { wire: 'phraseId', sql: 'phrase_id', merge: 'lww' },
  // Learner-authored text for rows with no catalog entry (`phraseId: null`).
  { wire: 'ownEs', sql: 'own_es', merge: 'lww' },
  { wire: 'ownEn', sql: 'own_en', merge: 'lww' },
  { wire: 'ownTheme', sql: 'own_theme', merge: 'lww' },
  { wire: 'ownEmoji', sql: 'own_emoji', merge: 'lww' },
  { wire: 'source', sql: 'source', merge: 'lww' },

  { wire: 'difficulty', sql: 'difficulty', merge: 'lww' },
  { wire: 'tags', sql: 'tags', merge: 'lww' },
  { wire: 'loved', sql: 'loved', merge: 'lww' },
  { wire: 'learned', sql: 'learned', merge: 'lww' },
  { wire: 'note', sql: 'note', merge: 'lww' },

  { wire: 'plays', sql: 'plays', merge: 'max' },
  { wire: 'reps', sql: 'reps', merge: 'max' },
  { wire: 'addedAt', sql: 'added_at', merge: 'lww' },
  { wire: 'lastPracticedAt', sql: 'last_practiced_at', merge: 'max' },
  { wire: 'graduatedAt', sql: 'graduated_at', merge: 'lww' },

  { wire: 'srsStability', sql: 'srs_stability', merge: 'latest-review' },
  { wire: 'srsDifficulty', sql: 'srs_difficulty', merge: 'latest-review' },
  { wire: 'srsDue', sql: 'srs_due', merge: 'latest-review' },
  { wire: 'srsLastReview', sql: 'srs_last_review', merge: 'latest-review' },
  { wire: 'srsLapses', sql: 'srs_lapses', merge: 'latest-review' },
  { wire: 'srsState', sql: 'srs_state', merge: 'latest-review' },
  { wire: 'srsAlgorithm', sql: 'srs_algorithm', merge: 'latest-review' },

  { wire: 'repsToday', sql: 'reps_today', merge: 'lww' },
  { wire: 'repsTodayDay', sql: 'reps_today_day', merge: 'lww' },
  { wire: 'automaticity', sql: 'automaticity', merge: 'lww' },
  { wire: 'lockInDays', sql: 'lock_in_days', merge: 'max' },

  { wire: 'rung', sql: 'rung', merge: 'max' },
  { wire: 'stumbles', sql: 'stumbles', merge: 'lww' },

  { wire: 'cueLevel', sql: 'cue_level', merge: 'max' },
  { wire: 'axPerception', sql: 'ax_perception', merge: 'max' },
  { wire: 'axRecall', sql: 'ax_recall', merge: 'max' },
  { wire: 'axProduction', sql: 'ax_production', merge: 'max' },

  { wire: 'deletedAt', sql: 'deleted_at', merge: 'tombstone' },
] as const satisfies readonly SyncableColumn[]

/**
 * Settings merge classes, including device-only consents that stay off the wire
 * (`excludedSettingsFields` / `onWire: false`).
 */
export const SETTINGS_SYNC_FIELDS = [
  // Native/target selection merges atomically to avoid unsupported hybrid pairs.
  { wire: 'languagePair', sql: 'language_pair', merge: 'lww' },
  { wire: 'goal', sql: 'goal', merge: 'lww' },
  { wire: 'level', sql: 'level', merge: 'lww' },
  { wire: 'dailyMinutes', sql: 'daily_minutes', merge: 'lww' },
  { wire: 'activeEngine', sql: 'active_engine', merge: 'lww' },
  { wire: 'engineExplicit', sql: 'engine_explicit', merge: 'lww' },
  { wire: 'waveTimes', sql: 'wave_times', merge: 'lww' },
  { wire: 'reminderTime', sql: 'reminder_time', merge: 'lww' },
  { wire: 'notifications', sql: 'notifications', merge: 'lww' },
  { wire: 'accent', sql: 'accent', merge: 'lww' },
  { wire: 'theme', sql: 'theme', merge: 'lww' },
  { wire: 'analyticsOptOut', sql: 'analytics_opt_out', merge: 'lww' },
  { wire: 'cloudAsrConsent', sql: 'cloud_asr_consent', merge: 'lww', onWire: false },
  { wire: 'voiceCloneConsent', sql: 'voice_clone_consent', merge: 'lww', onWire: false },
] as const satisfies readonly SyncableColumn[]

export type UserPhraseWireField = (typeof USER_PHRASE_SYNC_FIELDS)[number]['wire']
export type SettingsWireField = (typeof SETTINGS_SYNC_FIELDS)[number]['wire']

function wireToSql(
  fields: readonly SyncableColumn[],
  onWireOnly = false,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    fields
      .filter((field) => !onWireOnly || field.onWire !== false)
      .map((field) => [field.wire, field.sql]),
  )
}

function mergePolicy(fields: readonly SyncableColumn[]): Readonly<Record<string, MergeClass>> {
  return Object.fromEntries(fields.map((field) => [field.wire, field.merge]))
}

/** Wire camelCase → SQL snake_case for every syncable phrase field, including `deletedAt`. */
export const PHRASE_WIRE_TO_SQL = wireToSql(USER_PHRASE_SYNC_FIELDS)

/** Wire camelCase → SQL for settings fields that travel on the sync envelope. */
export const SETTINGS_WIRE_TO_SQL: Readonly<Record<string, string>> = wireToSql(
  SETTINGS_SYNC_FIELDS,
  true,
)

export const USER_PHRASE_MERGE_POLICY = mergePolicy(USER_PHRASE_SYNC_FIELDS)
export const SETTINGS_MERGE_POLICY = mergePolicy(SETTINGS_SYNC_FIELDS)

export const PHRASE_SYNC_SQL_COLUMNS = USER_PHRASE_SYNC_FIELDS.map((field) => field.sql)

/** Consent columns that have a merge class but are excluded from the wire envelope. */
export const SETTINGS_DEVICE_ONLY_FIELDS = (SETTINGS_SYNC_FIELDS as readonly SyncableColumn[])
  .filter((field) => field.onWire === false)
  .map((field) => field.wire)
