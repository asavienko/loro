/** F-03: Postgres music rows stay isolated per user. Set LORO_TEST_DATABASE_URL. */
import type { Pool } from 'pg'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { LyricDocument } from '@loro/core'
import { PostgresDatabase } from '../database/database.js'
import {
  LORO_TEST_DATABASE_URL,
  connectAdmin,
  createSearchPathSchema,
  describePostgres,
  dropIsolatedSchema,
  isolatedSchemaName,
} from '../testing/postgres-schema.js'
import { PostgresMusicRepository } from './repository.postgres.js'
import type { StoredLyricDocument, StoredMusicJob } from './repository.js'

const document = {
  schema_version: 1,
  target_locale: 'es-ES',
  meaning_language: 'en',
  catalog_version: 1,
  phrase_ids: ['cafe1', 'cafe2', 'cafe3'],
  title: { target: 'Café', translation: 'Coffee' },
  sections: [{ name: 'Chorus', lines: ['Un café'] }],
  used_phrases: [],
  gloss_lines: [],
} satisfies LyricDocument

describePostgres('music repository against real PostgreSQL', () => {
  let admin: Pool
  let database: PostgresDatabase
  const schema = isolatedSchemaName('music_repo')

  beforeAll(async () => {
    admin = connectAdmin(LORO_TEST_DATABASE_URL)
    vi.stubEnv('DATABASE_URL', await createSearchPathSchema(admin, schema, LORO_TEST_DATABASE_URL))
    database = new PostgresDatabase()
    expect(await database.ready()).toBe(true)
  })

  afterAll(async () => {
    await database.onModuleDestroy()
    await dropIsolatedSchema(admin, schema)
    await admin.end()
    vi.unstubAllEnvs()
  })

  it('stores lyrics, jobs and objects for one user and hides them from another', async () => {
    const rows = new PostgresMusicRepository(database)
    const lyric: StoredLyricDocument = {
      id: 'lyric-a',
      userId: 'user-a',
      document,
      documentHash: 'hash-a',
      fallback: true,
      createdAt: 1_721_558_400_123,
    }
    const job: StoredMusicJob = {
      jobId: 'job-a',
      userId: 'user-a',
      lyricDocumentId: lyric.id,
      trackId: 'track-a',
      styleId: 'acoustic_folk',
      modelId: 'music_v1',
      planHash: 'plan-a',
      sha256: 'a'.repeat(64),
      byteLength: 4,
      durationMs: 200,
      providerSongId: 'song-a',
      status: 'ready',
      errorCode: null,
      spendMicros: 1,
      createdAt: 1_721_558_400_123,
    }
    await rows.saveLyric(lyric)
    await rows.saveJob(job)
    await rows.putObject({
      sha256: job.sha256 ?? 'a'.repeat(64),
      contentType: 'audio/mpeg',
      bytes: new Uint8Array([1, 2, 3, 4]),
    })
    expect(await rows.getLyric(lyric.id, 'user-a')).toMatchObject({
      id: lyric.id,
      userId: 'user-a',
      documentHash: 'hash-a',
    })
    expect(await rows.getLyric(lyric.id, 'user-b')).toBeNull()
    expect(await rows.getJob(job.jobId, 'user-b')).toBeNull()
    expect(await rows.getJobByTrack('track-a', 'user-b')).toBeNull()
    expect(await rows.listJobs(lyric.id, 'user-b')).toEqual([])
    expect(await rows.listJobs(lyric.id, 'user-a')).toEqual([
      expect.objectContaining({ jobId: 'job-a', trackId: 'track-a', status: 'ready' }),
    ])
    const object = await rows.getObject('a'.repeat(64))
    expect(object?.bytes).toEqual(new Uint8Array([1, 2, 3, 4]))
  })
})
