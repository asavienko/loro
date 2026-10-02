import { AUTH_MIGRATION_SQL } from '../auth/auth.schema.js'
import {
  LIBRARY_MIGRATION_SQL,
  LIBRARY_PROGRESS_MIGRATION_SQL,
  LIBRARY_REPORTS_MIGRATION_SQL,
  LIBRARY_SPEECH_FAILURES_MIGRATION_SQL,
  LIBRARY_SPEECH_MIGRATION_SQL,
  LIBRARY_SPEECH_OWNERS_MIGRATION_SQL,
  LIBRARY_SAVE_COUNTS_MIGRATION_SQL,
  LIBRARY_SONG_SETS_MIGRATION_SQL,
  LIBRARY_SONG_VOICES_MIGRATION_SQL,
  LIBRARY_SET_REFS_MIGRATION_SQL,
  LIBRARY_AI_LABELS_MIGRATION_SQL,
  LIBRARY_COVER_JOBS_MIGRATION_SQL,
  LIBRARY_DECK_JOBS_MIGRATION_SQL,
  LIBRARY_ITEM_COVERS_MIGRATION_SQL,
  LIBRARY_COVER_HISTORY_MIGRATION_SQL,
  LIBRARY_LYRIC_DRAFTS_MIGRATION_SQL,
  LIBRARY_SONG_TIMING_MIGRATION_SQL,
  LIBRARY_PUSH_TOKENS_MIGRATION_SQL,
  LIBRARY_SONG_OPTIONS_MIGRATION_SQL,
} from '../library/library.schema.js'
import { MUSIC_MIGRATION_SQL } from '../music/music.schema.js'
import { SYNC_MIGRATION_SQL } from '../sync/sync.schema.js'
import type { SqlConnection } from './database.js'

export interface NamedMigration {
  readonly id: string
  readonly sql: string
}

/** Domain-owned SQL, applied in order under one advisory lock. */
export const NAMED_MIGRATIONS: readonly NamedMigration[] = [
  { id: '001_auth', sql: AUTH_MIGRATION_SQL },
  { id: '002_sync', sql: SYNC_MIGRATION_SQL },
  { id: '003_music', sql: MUSIC_MIGRATION_SQL },
  { id: '004_library', sql: LIBRARY_MIGRATION_SQL },
  { id: '005_progress', sql: LIBRARY_PROGRESS_MIGRATION_SQL },
  { id: '006_reports', sql: LIBRARY_REPORTS_MIGRATION_SQL },
  { id: '007_speech', sql: LIBRARY_SPEECH_MIGRATION_SQL },
  { id: '008_speech_failures', sql: LIBRARY_SPEECH_FAILURES_MIGRATION_SQL },
  { id: '009_speech_owners', sql: LIBRARY_SPEECH_OWNERS_MIGRATION_SQL },
  { id: '010_song_voices', sql: LIBRARY_SONG_VOICES_MIGRATION_SQL },
  { id: '011_song_sets', sql: LIBRARY_SONG_SETS_MIGRATION_SQL },
  { id: '012_save_counts', sql: LIBRARY_SAVE_COUNTS_MIGRATION_SQL },
  { id: '013_set_refs', sql: LIBRARY_SET_REFS_MIGRATION_SQL },
  { id: '014_ai_labels', sql: LIBRARY_AI_LABELS_MIGRATION_SQL },
  { id: '015_cover_jobs', sql: LIBRARY_COVER_JOBS_MIGRATION_SQL },
  { id: '016_deck_jobs', sql: LIBRARY_DECK_JOBS_MIGRATION_SQL },
  { id: '017_item_covers', sql: LIBRARY_ITEM_COVERS_MIGRATION_SQL },
  { id: '018_cover_history', sql: LIBRARY_COVER_HISTORY_MIGRATION_SQL },
  { id: '019_lyric_drafts', sql: LIBRARY_LYRIC_DRAFTS_MIGRATION_SQL },
  { id: '020_song_timing', sql: LIBRARY_SONG_TIMING_MIGRATION_SQL },
  { id: '021_push_tokens', sql: LIBRARY_PUSH_TOKENS_MIGRATION_SQL },
  { id: '022_song_options', sql: LIBRARY_SONG_OPTIONS_MIGRATION_SQL },
]

const LEDGER = `CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at bigint NOT NULL
)`

export async function applyNamedMigrations(
  connection: SqlConnection,
  migrations: readonly NamedMigration[],
  now: number,
): Promise<readonly string[]> {
  await connection.query(LEDGER)
  const applied = new Set(
    (await connection.query<{ id: string }>('SELECT id FROM schema_migrations')).rows.map(
      (row) => row.id,
    ),
  )
  const ran: string[] = []
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue
    await connection.query(migration.sql)
    await connection.query('INSERT INTO schema_migrations(id, applied_at) VALUES($1,$2)', [
      migration.id,
      now,
    ])
    ran.push(migration.id)
  }
  return ran
}
