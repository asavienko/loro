import { randomBytes } from 'node:crypto'
import { Inject, Injectable, Optional } from '@nestjs/common'
import { RATE_LIMITS } from '../common/errors.js'
import { windowMs, RATE_LIMIT_STORE, type RateLimitStore } from '../common/rate-limit.js'
import { PostgresRateLimitStore } from '../common/rate-limit.postgres.js'
import { DATABASE, type SqlConnection, type SqlDatabase } from '../database/database.js'
import type { StoredRow } from './merge.js'
import type {
  Alias,
  Cursor,
  Receipt,
  Replacement,
  SyncRepository,
  SyncTransaction,
} from './sync.repository.js'

@Injectable()
export class PostgresSyncRepository implements SyncRepository {
  private readonly limits: RateLimitStore

  constructor(
    @Inject(DATABASE) private readonly database: SqlDatabase,
    @Optional() @Inject(RATE_LIMIT_STORE) limits?: RateLimitStore,
  ) {
    this.limits = limits ?? new PostgresRateLimitStore(database)
  }

  async consume(userId: string, now: number): Promise<boolean> {
    const decision = await this.limits.consume({
      key: `sync:${userId}`,
      limit: RATE_LIMITS.sync.perUser,
      windowMs: windowMs(RATE_LIMITS.sync.windowMinutes),
      now,
      algorithm: 'expire-reset',
    })
    return decision.allowed
  }
  transaction<T>(userId: string, work: (tx: SyncTransaction) => Promise<T>): Promise<T> {
    return this.database.transaction(async (db) => {
      // Per-account ordering prevents committing a later revision before an earlier one.
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [userId])
      await db.query('INSERT INTO sync_heads(user_id) VALUES($1) ON CONFLICT DO NOTHING', [userId])
      return work(new PostgresSyncTransaction(db, userId))
    })
  }
}

class PostgresSyncTransaction implements SyncTransaction {
  constructor(
    private readonly db: SqlConnection,
    private readonly userId: string,
  ) {}

  async head(): Promise<{ revision: number; hlc: string }> {
    const result = await this.db.query<{ revision: string; hlc: string }>(
      'SELECT revision, hlc FROM sync_heads WHERE user_id=$1',
      [this.userId],
    )
    const row = result.rows[0]
    if (!row) throw new Error('Missing sync head')
    return { revision: Number(row.revision), hlc: row.hlc }
  }
  async setHlc(hlc: string): Promise<void> {
    await this.db.query('UPDATE sync_heads SET hlc=$2 WHERE user_id=$1', [this.userId, hlc])
  }
  async get(entity: string, id: string): Promise<StoredRow | undefined> {
    const result = await this.db.query<{ row_json: StoredRow }>(
      'SELECT row_json FROM sync_rows WHERE user_id=$1 AND entity=$2 AND entity_id=$3',
      [this.userId, entity, id],
    )
    return result.rows[0]?.row_json
  }
  async put(row: StoredRow): Promise<void> {
    await this.db.query(
      'INSERT INTO sync_rows(user_id,entity,entity_id,row_json) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,entity,entity_id) DO UPDATE SET row_json=EXCLUDED.row_json',
      [this.userId, row.entity, row.id, JSON.stringify(row)],
    )
    const result = await this.db.query<{ revision: string }>(
      'UPDATE sync_heads SET revision=revision+1 WHERE user_id=$1 RETURNING revision',
      [this.userId],
    )
    await this.db.query('INSERT INTO sync_changes(user_id,revision,row_json) VALUES($1,$2,$3)', [
      this.userId,
      result.rows[0]?.revision,
      JSON.stringify(row),
    ])
  }
  async receipt(deviceId: string, seq: number): Promise<Receipt | undefined> {
    return (
      await this.db.query<Receipt>(
        'SELECT digest,conflicts,aliases,clock_corrections AS "clockCorrections" FROM sync_receipts WHERE user_id=$1 AND device_id=$2 AND seq=$3',
        [this.userId, deviceId, seq],
      )
    ).rows[0]
  }
  async accept(deviceId: string, seq: number, receipt: Receipt): Promise<void> {
    await this.db.query(
      'INSERT INTO sync_receipts(user_id,device_id,seq,digest,conflicts,aliases,clock_corrections) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        this.userId,
        deviceId,
        seq,
        receipt.digest,
        JSON.stringify(receipt.conflicts),
        JSON.stringify(receipt.aliases),
        JSON.stringify(receipt.clockCorrections),
      ],
    )
  }
  async canonical(
    id: string,
    locale?: string,
    catalogId?: string,
    replaces?: Replacement,
  ): Promise<string> {
    const alias = (
      await this.db.query<{ canonical_id: string }>(
        'SELECT canonical_id FROM sync_aliases WHERE user_id=$1 AND original_id=$2',
        [this.userId, id],
      )
    ).rows[0]
    if (alias) return alias.canonical_id
    if (locale === undefined || catalogId === undefined) return id
    if (replaces) {
      await this.db.query(
        'INSERT INTO sync_phrase_generations(user_id,target_locale,phrase_id,previous_id,previous_deleted_at,entity_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
        [this.userId, locale, catalogId, replaces.id, replaces.deleted_at, id],
      )
      const generation = await this.db.query<{ entity_id: string }>(
        'SELECT entity_id FROM sync_phrase_generations WHERE user_id=$1 AND target_locale=$2 AND phrase_id=$3 AND previous_id=$4 AND previous_deleted_at=$5',
        [this.userId, locale, catalogId, replaces.id, replaces.deleted_at],
      )
      const canonical = generation.rows[0]?.entity_id ?? id
      await this.db.query(
        'INSERT INTO sync_aliases(user_id,original_id,canonical_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [this.userId, id, canonical],
      )
      return canonical
    }
    await this.db.query(
      'INSERT INTO sync_phrase_identity(user_id,target_locale,phrase_id,entity_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [this.userId, locale, catalogId, id],
    )
    const result = await this.db.query<{ entity_id: string }>(
      'SELECT entity_id FROM sync_phrase_identity WHERE user_id=$1 AND target_locale=$2 AND phrase_id=$3',
      [this.userId, locale, catalogId],
    )
    const canonical = result.rows[0]?.entity_id ?? id
    await this.db.query(
      'INSERT INTO sync_aliases(user_id,original_id,canonical_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [this.userId, id, canonical],
    )
    return canonical
  }
  async cursor(token: string): Promise<Cursor | undefined> {
    const row = (
      await this.db.query<{ after_revision: string; watermark: string | null }>(
        'SELECT after_revision,watermark FROM sync_cursors WHERE token=$1 AND user_id=$2',
        [token, this.userId],
      )
    ).rows[0]
    return row
      ? {
          after: Number(row.after_revision),
          watermark: row.watermark === null ? null : Number(row.watermark),
        }
      : undefined
  }
  async aliases(): Promise<Alias[]> {
    return (
      await this.db.query<Alias>(
        'SELECT original_id AS "from",canonical_id AS "to" FROM sync_aliases WHERE user_id=$1 AND original_id<>canonical_id ORDER BY original_id',
        [this.userId],
      )
    ).rows
  }
  async saveCursor(cursor: Cursor): Promise<string> {
    const token = randomBytes(32).toString('base64url')
    await this.db.query(
      'INSERT INTO sync_cursors(token,user_id,after_revision,watermark) VALUES($1,$2,$3,$4)',
      [token, this.userId, cursor.after, cursor.watermark],
    )
    return token
  }
  async changes(
    after: number,
    watermark: number,
    limit: number,
  ): Promise<{ revision: number; row: StoredRow }[]> {
    const result = await this.db.query<{ revision: string; row_json: StoredRow }>(
      'SELECT revision,row_json FROM sync_changes WHERE user_id=$1 AND revision>$2 AND revision<=$3 ORDER BY revision LIMIT $4',
      [this.userId, after, watermark, limit],
    )
    return result.rows.map((row) => ({ revision: Number(row.revision), row: row.row_json }))
  }
  async count(): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      'SELECT count(*) FROM sync_rows WHERE user_id=$1',
      [this.userId],
    )
    return Number(result.rows[0]?.count ?? 0)
  }
}
