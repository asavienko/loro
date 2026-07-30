/**
 * `streak_day` — the days at least one rep landed on.
 *
 * A history, not a counter: the streak is derived by `streak()` so the app and the
 * widget cannot disagree (ADR-0002). `local_day` here is the STREAK day key — midnight
 * plus the grace window — not the calendar day the Refrain's set rolls on.
 */

import { readText, type SqlDriver } from '../driver.js'
import { LOCAL_USER_ID, type PracticeDayTable } from '../tables.js'

export class SqlPracticeDayTable implements PracticeDayTable {
  constructor(
    private readonly driver: SqlDriver,
    private readonly userId: string = LOCAL_USER_ID,
  ) {}

  all(): string[] {
    return this.driver
      .all(
        `SELECT local_day FROM streak_day WHERE user_id = ? AND practised = 1 ORDER BY local_day`,
        [this.userId],
      )
      .map((row) => readText(row, 'local_day'))
  }

  add(localDay: string, minutes = 0): void {
    // Practising twice on one day is one day. `minutes` accumulates because it is a
    // duration, not a flag.
    this.driver.run(
      `INSERT INTO streak_day (user_id, local_day, practised, minutes) VALUES (?, ?, 1, ?)
       ON CONFLICT(user_id, local_day)
       DO UPDATE SET practised = 1, minutes = minutes + excluded.minutes`,
      [this.userId, localDay, minutes],
    )
  }

  pruneBefore(localDay: string): void {
    this.driver.run(`DELETE FROM streak_day WHERE user_id = ? AND local_day < ?`, [
      this.userId,
      localDay,
    ])
  }
}
