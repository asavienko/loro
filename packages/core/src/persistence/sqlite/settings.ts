/** `settings` — the learner's one row. */

import {
  boolToSql,
  firstRow,
  readBool,
  readIntOrNull,
  readJson,
  readTextOrNull,
  type SqlDriver,
} from '../driver.js'
import { LOCAL_USER_ID, type SettingsRow, type SettingsTable } from '../tables.js'

export class SqlSettingsTable implements SettingsTable {
  constructor(
    private readonly driver: SqlDriver,
    private readonly hlc: () => string,
    private readonly userId: string = LOCAL_USER_ID,
  ) {}

  load(): SettingsRow | null {
    const row = firstRow(
      this.driver,
      `SELECT onboarded, goal, level, daily_minutes, wave_times FROM settings WHERE user_id = ?`,
      [this.userId],
    )
    if (row === null) return null
    const minutes = readIntOrNull(row, 'daily_minutes')
    return {
      onboarded: readBool(row, 'onboarded'),
      goal: readTextOrNull(row, 'goal'),
      level: readTextOrNull(row, 'level'),
      // A value outside the three the app offers is not a setting, it is corruption.
      dailyMinutes: minutes === 5 || minutes === 10 || minutes === 20 ? minutes : null,
      waveTimes: readJson<string[]>(row, 'wave_times', []),
    }
  }

  save(settings: SettingsRow): void {
    this.driver.run(
      `INSERT OR REPLACE INTO settings
         (user_id, onboarded, goal, level, daily_minutes, wave_times, updated_hlc)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        this.userId,
        boolToSql(settings.onboarded),
        settings.goal,
        settings.level,
        settings.dailyMinutes,
        JSON.stringify(settings.waveTimes),
        this.hlc(),
      ],
    )
  }
}
