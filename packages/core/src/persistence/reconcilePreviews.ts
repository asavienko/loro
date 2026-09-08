import { decodeCheckpoint } from './checkpoint.js'
import type { SqlDriver } from './driver.js'

/** Two native preview branches shipped different v3 schemas. Inspect, never rewrite receipts. */
export function reconcilePreviewSchemas(driver: SqlDriver): void {
  const columns = (table: string) =>
    new Set(driver.all(`PRAGMA table_info(${table})`).map((row) => row['name']))
  if (!columns('outbox').has('replaces')) driver.exec('ALTER TABLE outbox ADD COLUMN replaces TEXT')
  if (!columns('outbox').has('user_id'))
    driver.exec("ALTER TABLE outbox ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'")
  driver.exec('CREATE INDEX IF NOT EXISTS outbox_owner ON outbox(user_id, seq)')
  if (!columns('user_phrase').has('srs_algorithm')) {
    driver.exec('ALTER TABLE user_phrase ADD COLUMN srs_algorithm TEXT')
    const preview = driver.all('SELECT name FROM schema_version WHERE version = 3')[0]?.['name']
    if (preview === 'explicit_phrase_replacement') {
      driver.run('UPDATE user_phrase SET srs_algorithm = ? WHERE srs_stability IS NOT NULL', [
        'fsrs-6/py-fsrs-6.3.2/default-90-no-steps',
      ])
    }
  }
  // The integrated runtime uses course_session as its sole checkpoint authority. Keep
  // old preview records for provenance while copying only validated local resume data.
  for (const row of driver.all('SELECT user_id,target_locale,payload FROM session_checkpoint')) {
    if (typeof row['payload'] !== 'string') continue
    const checkpoint = decodeCheckpoint(row['payload'])
    if (!checkpoint || checkpoint.targetLocale !== row['target_locale']) continue
    driver.run(
      `UPDATE course_session SET stream_cursor = ?, refrain_session = ?
       WHERE user_id = ? AND target_locale = ? AND refrain_session IS NULL`,
      [
        checkpoint.streamCursor,
        JSON.stringify({
          ...checkpoint.refrainResume,
          version: 1,
          localDay: checkpoint.localDay,
          contentSignature:
            checkpoint.contentSignature === undefined
              ? undefined
              : convertLegacySignature(checkpoint.contentSignature),
        }),
        row['user_id'] ?? null,
        checkpoint.targetLocale,
      ],
    )
  }
  for (const row of driver.all("SELECT key,value FROM local_metadata WHERE user_id = 'local'")) {
    if (typeof row['key'] !== 'string' || typeof row['value'] !== 'string') continue
    const key =
      row['key'] === 'installation-id'
        ? 'device_id'
        : row['key'] === 'language-chosen'
          ? 'language_chosen'
          : row['key'] === 'hlc'
            ? 'last_hlc'
            : row['key']
    driver.run('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO NOTHING', [key, row['value']])
  }
}

function convertLegacySignature(raw: string): string {
  try {
    const value: unknown = JSON.parse(raw)
    if (
      !Array.isArray(value) ||
      !value.every(
        (entry: unknown) =>
          Array.isArray(entry) &&
          entry.length === 4 &&
          typeof entry[0] === 'string' &&
          (entry[1] === null || typeof entry[1] === 'string') &&
          (entry[2] === null || typeof entry[2] === 'string') &&
          Array.isArray(entry[3]) &&
          entry[3].length === 0,
      )
    )
      return raw
    return JSON.stringify(
      value
        .map((entry: [string, string | null, string | null, []]) => [
          entry[1] ?? entry[0],
          entry[2],
        ])
        .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    )
  } catch {
    return raw
  }
}
