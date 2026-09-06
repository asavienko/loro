import type { TargetLocale } from '../../domain/languages.js'
/** `refrain_day` — today's frozen set. "You always see today." */

import { firstRow, readJson, readText, type SqlRow } from '../driver.js'
import type { RefrainDayRow, RefrainDayTable } from '../tables.js'
import type { TableDeps } from './deps.js'

const REFRAIN_DAY_SELECT = `SELECT target_locale, local_day, set_ids, waves, substituted FROM refrain_day`

function rowToRefrainDay(row: SqlRow): RefrainDayRow {
  const target = readText(row, 'target_locale') as TargetLocale
  return {
    ...(target === 'es-ES' ? {} : { targetLocale: target }),
    localDay: readText(row, 'local_day'),
    setIds: readJson<string[]>(row, 'set_ids', []),
    waves: readJson<string[]>(row, 'waves', []),
    substituted: readJson<string[]>(row, 'substituted', []),
  }
}

export class SqlRefrainDayTable implements RefrainDayTable {
  constructor(private readonly deps: TableDeps) {}

  load(localDay: string, targetLocale: TargetLocale = 'es-ES'): RefrainDayRow | null {
    const row = firstRow(
      this.deps.driver,
      `${REFRAIN_DAY_SELECT} WHERE user_id = ? AND local_day = ? AND target_locale = ?`,
      [this.deps.userId, localDay, targetLocale],
    )
    return row === null ? null : rowToRefrainDay(row)
  }

  latest(targetLocale: TargetLocale = 'es-ES'): RefrainDayRow | null {
    const row = firstRow(
      this.deps.driver,
      `${REFRAIN_DAY_SELECT}
       WHERE user_id = ? AND target_locale = ? ORDER BY local_day DESC LIMIT 1`,
      [this.deps.userId, targetLocale],
    )
    return row === null ? null : rowToRefrainDay(row)
  }

  /**
   * Freeze (or re-freeze) one day's row.
   *
   * `waves` used to be a bound literal `'[]'`, so the column existed and could never hold
   * anything: the learner's completed waves were unwritable, and any value another writer
   * put there was destroyed by the next `save`. It is now a parameter like the other two.
   *
   * The row is keyed by `(user_id, local_day)` and every column here is the caller's, so a
   * whole-row replace is the right shape — unlike `user_phrase` and `settings`, this table
   * has no `field_hlc` and no `deleted_at` for a replace to erase (see `sqlite/deps.ts`).
   * Spelled as a conflict update rather than `INSERT OR REPLACE` so that adding a column
   * this repository does not own cannot silently reset it.
   */
  save(row: RefrainDayRow): void {
    this.deps.driver.run(
      `INSERT INTO refrain_day (user_id, local_day, set_ids, waves, substituted, target_locale)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, target_locale, local_day) DO UPDATE SET
         set_ids     = excluded.set_ids,
         waves       = excluded.waves,
         substituted = excluded.substituted`,
      [
        this.deps.userId,
        row.localDay,
        JSON.stringify(row.setIds),
        JSON.stringify(row.waves),
        JSON.stringify(row.substituted),
        row.targetLocale ?? 'es-ES',
      ],
    )
  }
}
