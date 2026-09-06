import type { TargetLocale } from '../../domain/languages.js'
import { firstRow, readBool, readInt, readTextOrNull } from '../driver.js'
import type { CourseRow, CourseTable } from '../tables.js'
import type { TableDeps } from './deps.js'

export class SqlCourseTable implements CourseTable {
  constructor(private readonly deps: TableDeps) {}
  load(targetLocale: TargetLocale): CourseRow | null {
    const row = firstRow(
      this.deps.driver,
      'SELECT * FROM course_session WHERE user_id = ? AND target_locale = ?',
      [this.deps.userId, targetLocale],
    )
    return row
      ? {
          targetLocale,
          onboarded: readBool(row, 'onboarded'),
          selectedId: readTextOrNull(row, 'selected_id'),
          streamCursor: readInt(row, 'stream_cursor'),
          refrainSession: readTextOrNull(row, 'refrain_session'),
        }
      : null
  }
  save(row: CourseRow): void {
    this.deps.driver.run(
      `INSERT OR REPLACE INTO course_session
      (user_id, target_locale, onboarded, selected_id, stream_cursor, refrain_session) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        this.deps.userId,
        row.targetLocale,
        row.onboarded ? 1 : 0,
        row.selectedId,
        row.streamCursor,
        row.refrainSession,
      ],
    )
  }
}
