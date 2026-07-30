/** `refrain_day` — today's frozen set. "You always see today." */

import { firstRow, readJson, readText, type SqlDriver, type SqlRow } from '../driver.js'
import { LOCAL_USER_ID, type RefrainDayRow, type RefrainDayTable } from '../tables.js'

const REFRAIN_DAY_SELECT = `SELECT local_day, set_ids, substituted FROM refrain_day`

function rowToRefrainDay(row: SqlRow): RefrainDayRow {
  return {
    localDay: readText(row, 'local_day'),
    setIds: readJson<string[]>(row, 'set_ids', []),
    substituted: readJson<string[]>(row, 'substituted', []),
  }
}

export class SqlRefrainDayTable implements RefrainDayTable {
  constructor(
    private readonly driver: SqlDriver,
    private readonly userId: string = LOCAL_USER_ID,
  ) {}

  load(localDay: string): RefrainDayRow | null {
    const row = firstRow(this.driver, `${REFRAIN_DAY_SELECT} WHERE user_id = ? AND local_day = ?`, [
      this.userId,
      localDay,
    ])
    return row === null ? null : rowToRefrainDay(row)
  }

  latest(): RefrainDayRow | null {
    const row = firstRow(
      this.driver,
      `${REFRAIN_DAY_SELECT}
       WHERE user_id = ? ORDER BY local_day DESC LIMIT 1`,
      [this.userId],
    )
    return row === null ? null : rowToRefrainDay(row)
  }

  save(row: RefrainDayRow): void {
    this.driver.run(
      `INSERT OR REPLACE INTO refrain_day (user_id, local_day, set_ids, waves, substituted)
       VALUES (?, ?, ?, '[]', ?)`,
      [this.userId, row.localDay, JSON.stringify(row.setIds), JSON.stringify(row.substituted)],
    )
  }
}
