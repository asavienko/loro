/** `refrain_day` — today's frozen set. "You always see today." */

import { firstRow, readJson, readText, type SqlRow } from '../driver.js'
import type { RefrainDayRow, RefrainDayTable } from '../tables.js'
import type { TableDeps } from './deps.js'

const REFRAIN_DAY_SELECT = `SELECT local_day, set_ids, substituted FROM refrain_day`

function rowToRefrainDay(row: SqlRow): RefrainDayRow {
  return {
    localDay: readText(row, 'local_day'),
    setIds: readJson<string[]>(row, 'set_ids', []),
    substituted: readJson<string[]>(row, 'substituted', []),
  }
}

export class SqlRefrainDayTable implements RefrainDayTable {
  constructor(private readonly deps: TableDeps) {}

  load(localDay: string): RefrainDayRow | null {
    const row = firstRow(
      this.deps.driver,
      `${REFRAIN_DAY_SELECT} WHERE user_id = ? AND local_day = ?`,
      [this.deps.userId, localDay],
    )
    return row === null ? null : rowToRefrainDay(row)
  }

  latest(): RefrainDayRow | null {
    const row = firstRow(
      this.deps.driver,
      `${REFRAIN_DAY_SELECT}
       WHERE user_id = ? ORDER BY local_day DESC LIMIT 1`,
      [this.deps.userId],
    )
    return row === null ? null : rowToRefrainDay(row)
  }

  save(row: RefrainDayRow): void {
    this.deps.driver.run(
      `INSERT OR REPLACE INTO refrain_day (user_id, local_day, set_ids, waves, substituted)
       VALUES (?, ?, ?, '[]', ?)`,
      [this.deps.userId, row.localDay, JSON.stringify(row.setIds), JSON.stringify(row.substituted)],
    )
  }
}
