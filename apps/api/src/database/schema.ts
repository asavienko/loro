import { AUTH_MIGRATION_SQL } from '../auth/auth.schema.js'
import { MUSIC_MIGRATION_SQL } from '../music/music.schema.js'
import { SYNC_MIGRATION_SQL } from '../sync/sync.schema.js'

/** Additive, transactionally installed schema. Tombstones, receipts and cursors have no GC yet. */
export const DATABASE_MIGRATION_SQL = `${AUTH_MIGRATION_SQL}
${SYNC_MIGRATION_SQL}
${MUSIC_MIGRATION_SQL}`
