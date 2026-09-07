import type { TargetLocale } from '../../domain/languages.js'
import { firstRow, readBool, readInt, readTextOrNull } from '../driver.js'
import type { CourseRow, CourseTable } from '../tables.js'
import type { TableDeps } from './deps.js'

export class SqlCourseTable implements CourseTable {
  constructor(private readonly deps: TableDeps) {}
  all(): CourseRow[] {
    return this.deps.driver
      .all('SELECT target_locale FROM course_session WHERE user_id = ?', [this.deps.userId])
      .flatMap((row) => {
        const course = this.load(row['target_locale'] as TargetLocale)
        return course ? [course] : []
      })
  }
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
      `INSERT INTO course_session
      (user_id, target_locale, onboarded, selected_id, stream_cursor, refrain_session) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, target_locale) DO UPDATE SET
      onboarded = excluded.onboarded, selected_id = excluded.selected_id,
      stream_cursor = excluded.stream_cursor, refrain_session = excluded.refrain_session`,
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
