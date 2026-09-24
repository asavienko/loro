/** Local Review resume payload. Not a sync entity — no `field_hlc` / `deleted_at`. */
import type { TargetLocale } from '../../domain/languages.js'
import { firstRow, readText } from '../driver.js'
import type { SqlDriver } from '../driver.js'
import {
  decodeReviewCheckpoint,
  encodeReviewCheckpoint,
  reviewCheckpointKey,
  type ReviewCheckpoint,
} from '../reviewCheckpoint.js'

export function loadReviewCheckpoint(
  driver: SqlDriver,
  userId: string,
  targetLocale: TargetLocale,
): ReviewCheckpoint | null {
  const row = firstRow(
    driver,
    'SELECT value FROM local_metadata WHERE user_id = ? AND key = ?',
    [userId, reviewCheckpointKey(targetLocale)],
  )
  if (row === null) return null
  return decodeReviewCheckpoint(readText(row, 'value'))
}

export function saveReviewCheckpoint(
  driver: SqlDriver,
  userId: string,
  checkpoint: ReviewCheckpoint,
): void {
  const raw = encodeReviewCheckpoint(checkpoint)
  driver.run(
    `INSERT INTO local_metadata(user_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
    [userId, reviewCheckpointKey(checkpoint.targetLocale), raw],
  )
}

export function clearReviewCheckpoint(
  driver: SqlDriver,
  userId: string,
  targetLocale: TargetLocale,
): void {
  driver.run('DELETE FROM local_metadata WHERE user_id = ? AND key = ?', [
    userId,
    reviewCheckpointKey(targetLocale),
  ])
}
