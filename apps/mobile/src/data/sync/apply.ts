import type { SqlDriver, SqlValue } from '@loro/core'
import { SyncError } from '../../lib/sync/types'
import {
  PHRASE_COLUMNS,
  REVIEW_RATINGS,
  SETTINGS_COLUMNS,
  encodeHlc,
  type Row,
  readText,
  sqlValue,
} from './row'

export function writeColumns(
  driver: SqlDriver,
  table: string,
  keys: Readonly<Record<string, SqlValue>>,
  values: Readonly<Record<string, SqlValue>>,
): void {
  const entries = Object.entries({ ...keys, ...values })
  driver.run(
    `INSERT INTO ${table}(${entries.map(([name]) => name).join(',')}) VALUES(${entries.map(() => '?').join(',')}) ON CONFLICT(${Object.keys(keys).join(',')}) DO UPDATE SET ${Object.keys(
      values,
    )
      .map((name) => `${name}=excluded.${name}`)
      .join(',')}`,
    entries.map(([, value]) => value),
  )
}

export function applyReview(
  driver: SqlDriver,
  userId: string,
  row: Row,
  values: Readonly<Record<string, unknown>>,
): void {
  const target = values['targetLocale']
  const grade = values['grade']
  const rating = typeof grade === 'string' ? REVIEW_RATINGS[grade] : undefined
  // Older journal rows do not include the full scheduler snapshot. Keep them in
  // sync_rows until a complete record exists; never manufacture state or lapses.
  if (
    (target !== 'es-ES' && target !== 'bg-BG' && target !== 'ru-RU') ||
    typeof rating !== 'number' ||
    typeof values['algorithm'] !== 'string' ||
    typeof values['state'] !== 'string' ||
    typeof values['phraseId'] !== 'string' ||
    typeof values['at'] !== 'number' ||
    typeof values['stability'] !== 'number' ||
    typeof values['difficulty'] !== 'number' ||
    typeof values['due'] !== 'number' ||
    typeof values['lapses'] !== 'number' ||
    (values['lastReview'] !== null && typeof values['lastReview'] !== 'number')
  )
    return
  const prefix = `review-id:${target}:`
  const mapping = driver
    .all("SELECT k FROM kv WHERE v=? AND k LIKE 'review-id:%'", [row.id])
    .find((entry) => readText(entry, 'k').startsWith(prefix))
  // A local review's wire UUID is deliberately distinct from the practice attempt
  // id. Reuse its durable mapping so a server echo cannot count the review twice.
  const attemptId = mapping ? readText(mapping, 'k').slice(prefix.length) : `remote:${row.id}`
  if (row.deleted_at !== null) {
    driver.run('DELETE FROM review_event WHERE user_id=? AND target_locale=? AND attempt_id=?', [
      userId,
      target,
      attemptId,
    ])
    return
  }
  driver.run(
    `INSERT INTO review_event(user_id,target_locale,attempt_id,phrase_id,reviewed_at,rating,algorithm,stability,difficulty,due,last_review,lapses,state)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,target_locale,attempt_id) DO NOTHING`,
    [
      userId,
      target,
      attemptId,
      sqlValue(values['phraseId']),
      sqlValue(values['at']),
      rating,
      sqlValue(values['algorithm']),
      sqlValue(values['stability']),
      sqlValue(values['difficulty']),
      sqlValue(values['due']),
      sqlValue(values['lastReview']),
      sqlValue(values['lapses']),
      sqlValue(values['state']),
    ],
  )
}

export function applyRemoteRow(
  driver: SqlDriver,
  userId: string,
  row: Row,
  serverHlc: string,
  pendingDeletes: Record<string, { at: number; readyAt: number }>,
  writeKv: (key: string, value: unknown) => void,
): void {
  const values = Object.fromEntries(
    Object.entries(row.fields).map(([key, field]) => [key, field.v]),
  )
  const fieldHlc = JSON.stringify(
    Object.fromEntries(
      Object.entries(row.fields).map(([key, field]) => [key, encodeHlc(field.hlc)]),
    ),
  )
  if (row.entity === 'user_phrase') {
    if (row.deleted_at !== null) {
      if (pendingDeletes[row.id]) {
        Reflect.deleteProperty(pendingDeletes, row.id)
        writeKv('pending_phrase_deletes', pendingDeletes)
      }
      driver.run(
        'UPDATE user_phrase SET deleted_at=?,field_hlc=?,updated_hlc=? WHERE user_id=? AND id=?',
        [row.deleted_at, fieldHlc, serverHlc, userId, row.id],
      )
      return
    }
    if (
      (!values['phraseId'] && !values['ownEs']) ||
      typeof values['source'] !== 'string' ||
      typeof values['addedAt'] !== 'number'
    )
      throw new SyncError('INCOMPLETE_PHRASE')
    const columns: Record<string, SqlValue> = {
      user_id: userId,
      field_hlc: fieldHlc,
      updated_hlc: serverHlc,
    }
    for (const [key, field] of Object.entries(row.fields)) {
      const column = PHRASE_COLUMNS[key]
      if (column) columns[column] = sqlValue(field.v)
    }
    // The Rust tombstone, never a LWW scalar, owns deletion.
    columns['deleted_at'] = pendingDeletes[row.id]?.at ?? row.deleted_at
    writeColumns(driver, 'user_phrase', { id: row.id }, columns)
    const target = typeof values['targetLocale'] === 'string' ? values['targetLocale'] : 'es-ES'
    writeColumns(
      driver,
      'course_session',
      { user_id: userId, target_locale: target },
      { onboarded: 1 },
    )
    return
  }
  if (row.entity === 'review_log') {
    applyReview(driver, userId, row, values)
    return
  }
  if (row.entity === 'settings') {
    if (row.deleted_at !== null) return
    const columns: Record<string, SqlValue> = { field_hlc: fieldHlc, updated_hlc: serverHlc }
    for (const [key, field] of Object.entries(row.fields)) {
      const column = SETTINGS_COLUMNS[key]
      if (column) columns[column] = sqlValue(field.v)
    }
    writeColumns(driver, 'settings', { user_id: userId }, columns)
    return
  }
  if (row.entity === 'streak_day') {
    if (row.deleted_at !== null) {
      driver.run('DELETE FROM streak_day WHERE user_id=? AND local_day=?', [userId, row.id])
      return
    }
    writeColumns(
      driver,
      'streak_day',
      { user_id: userId, local_day: row.id },
      {
        practised: values['practised'] === false ? 0 : 1,
        minutes: typeof values['minutes'] === 'number' ? values['minutes'] : 0,
      },
    )
    return
  }
  if (row.entity === 'refrain_day') {
    const day = row.id.slice(-10)
    const idTarget = row.id.includes(':') ? row.id.split(':')[0] : 'es-ES'
    const target = typeof values['targetLocale'] === 'string' ? values['targetLocale'] : idTarget
    if (target !== 'es-ES' && target !== 'bg-BG' && target !== 'ru-RU')
      throw new SyncError('INVALID_COURSE')
    if (row.deleted_at !== null) {
      driver.run('DELETE FROM refrain_day WHERE user_id=? AND target_locale=? AND local_day=?', [
        userId,
        target,
        day,
      ])
      return
    }
    const waves = Array.isArray(values['waves'])
      ? values['waves'].map((wave: unknown) =>
          typeof wave === 'object' && wave && 'wave' in wave ? wave.wave : wave,
        )
      : []
    writeColumns(
      driver,
      'refrain_day',
      { user_id: userId, target_locale: target, local_day: day },
      { set_ids: JSON.stringify(values['setIds'] ?? []), waves: JSON.stringify(waves) },
    )
  }
  // Reviewed append-only wire entities have no learner UI yet. Their validated rows
  // remain durable in sync_rows so an older screen set never stalls account convergence.
}
