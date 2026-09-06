import { parseLanguagePair } from '../../domain/languages.js'
/** `settings` — the learner's one row. */

import {
  boolToSql,
  firstRow,
  readBool,
  readIntOrNull,
  readJson,
  readTextOrNull,
} from '../driver.js'
import type { SettingsRow, SettingsTable } from '../tables.js'
import type { SyncedTableDeps } from './deps.js'

export class SqlSettingsTable implements SettingsTable {
  constructor(private readonly deps: SyncedTableDeps) {}

  load(): SettingsRow | null {
    const row = firstRow(
      this.deps.driver,
      `SELECT language_pair, onboarded, goal, level, daily_minutes, wave_times FROM settings WHERE user_id = ?`,
      [this.deps.userId],
    )
    if (row === null) return null
    const minutes = readIntOrNull(row, 'daily_minutes')
    return {
      ...(readTextOrNull(row, 'language_pair') === null
        ? {}
        : { languagePair: parseLanguagePair(readJson<unknown>(row, 'language_pair', null)) }),
      onboarded: readBool(row, 'onboarded'),
      goal: readTextOrNull(row, 'goal'),
      level: readTextOrNull(row, 'level'),
      // A value outside the three the app offers is not a setting, it is corruption.
      dailyMinutes: minutes === 5 || minutes === 10 || minutes === 20 ? minutes : null,
      waveTimes: readJson<string[]>(row, 'wave_times', []),
    }
  }

  /**
   * Write the five settings this repository owns, and nothing else.
   *
   * `INSERT OR REPLACE` stood here, and it is a DELETE followed by an INSERT: every column
   * absent from the list below reverted to its DDL default. Saving `onboarded` therefore
   * reset the learner's accent, theme, reminder time, notification choices AND their three
   * privacy consents — `analytics_opt_out`, `cloud_asr_consent`, `voice_clone_consent` all
   * default to 0. Silently un-revoking a consent is the worst version of this bug; the
   * others are merely a learner's preferences vanishing when they finish onboarding.
   *
   * It also erased `field_hlc`, the per-field merge history, exactly as the phrase upsert
   * did (see `sqlite/phrase.ts`). `updated_hlc` IS this write's to stamp, so it is set.
   */
  save(settings: SettingsRow): void {
    if (settings.languagePair) parseLanguagePair(settings.languagePair)
    this.deps.driver.run(
      `INSERT INTO settings
         (user_id, onboarded, goal, level, daily_minutes, wave_times, updated_hlc, language_pair)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         onboarded     = excluded.onboarded,
         goal          = excluded.goal,
         level         = excluded.level,
         daily_minutes = excluded.daily_minutes,
         wave_times    = excluded.wave_times,
         updated_hlc   = excluded.updated_hlc,
         language_pair = excluded.language_pair`,
      [
        this.deps.userId,
        boolToSql(settings.onboarded),
        settings.goal,
        settings.level,
        settings.dailyMinutes,
        JSON.stringify(settings.waveTimes),
        this.deps.hlc(),
        settings.languagePair ? JSON.stringify(settings.languagePair) : null,
      ],
    )
  }
}
