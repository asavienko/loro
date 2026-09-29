import { AUTH_MIGRATION_SQL } from '../auth/auth.schema.js'
import { LIBRARY_MIGRATION_SQL } from '../library/library.schema.js'
import { MUSIC_MIGRATION_SQL } from '../music/music.schema.js'
import { SYNC_MIGRATION_SQL } from '../sync/sync.schema.js'

/** Concatenated domain SQL for review. The runner applies `NAMED_MIGRATIONS`, not this string. */
export const DATABASE_MIGRATION_SQL = `${AUTH_MIGRATION_SQL}
${SYNC_MIGRATION_SQL}
${MUSIC_MIGRATION_SQL}
${LIBRARY_MIGRATION_SQL}`
