import {
  mergeClassOf,
  PHRASE_WIRE_TO_SQL,
  SETTINGS_WIRE_TO_SQL,
  type OutboxOp,
  type Persistence,
  type SqlDriver,
  type SqlRow,
  type SqlValue,
  type MergeClass,
} from '@loro/core'
import { mergeRow } from '../lib/core'
import { decodeField, outboxToWire } from '../lib/sync/codec'
import { SyncError, type SyncLocalStore } from '../lib/sync/types'

interface Hlc {
  physical: number
  logical: number
  node_id: string
}
interface Field {
  v: unknown
  hlc: Hlc
}
interface Row {
  entity: string
  id: string
  fields: Record<string, Field>
  deleted_at: number | null
}
function firstRow(driver: SqlDriver, sql: string, params: readonly SqlValue[] = []): SqlRow | null {
  return driver.all(sql, params)[0] ?? null
}
function readText(row: SqlRow, field: string): string {
  const value = row[field]
  if (typeof value !== 'string') throw new SyncError('INVALID_LOCAL_ROW')
  return value
}
const RUST_CLASSES: Record<
  MergeClass,
  'Lww' | 'Max' | 'LatestReview' | 'AppendOnly' | 'Tombstone'
> = {
  lww: 'Lww',
  max: 'Max',
  'latest-review': 'LatestReview',
  'append-only': 'AppendOnly',
  tombstone: 'Tombstone',
}
const PHRASE_COLUMNS = PHRASE_WIRE_TO_SQL
const SETTINGS_COLUMNS = SETTINGS_WIRE_TO_SQL
const BOOL_FIELDS = new Set([
  'loved',
  'learned',
  'engineExplicit',
  'analyticsOptOut',
  'practised',
  'notifications',
])
const REVIEW_RATINGS: Readonly<Record<string, number>> = { again: 1, hard: 2, good: 3, easy: 4 }
function parseHlc(value: string): Hlc {
  const parts = value.split(':')
  if (parts.length !== 3 || !parts[2]) throw new SyncError('INVALID_HLC')
  return { physical: Number(parts[0]), logical: Number(parts[1]), node_id: parts[2] }
}
function encodeHlc(value: Hlc): string {
  return `${value.physical}:${String(value.logical).padStart(4, '0')}:${value.node_id}`
}
function blank(entity: string, id: string): Row {
  return { entity, id, fields: {}, deleted_at: null }
}
function sqlValue(value: unknown): SqlValue {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  return JSON.stringify(value)
}
function merge(local: Row, remote: Row): Row {
  const classes = Object.fromEntries(
    Object.keys(remote.fields).map((field) => {
      const policy = mergeClassOf(remote.entity, field)
      if (!policy) throw new SyncError('UNKNOWN_FIELD')
      return [field, RUST_CLASSES[policy]]
    }),
  )
  return mergeRow(local, { ...remote, classes }).row
}

/** All local apply, acknowledgement and cursor transitions are SQLite transactions. */
export function createSqlSyncStore(options: {
  driver: SqlDriver
  persistence: Persistence
  hlc: () => string
  receiveHlc: (remote: string) => void
  now: () => number
  userId?: string
}): SyncLocalStore {
  const { driver, persistence } = options
  const userId = options.userId ?? 'local'
  driver.exec(`
    CREATE TABLE IF NOT EXISTS sync_state (id INTEGER PRIMARY KEY CHECK(id=1), cursor TEXT, failures INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0, server_hlc TEXT);
    INSERT INTO sync_state(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
    CREATE TABLE IF NOT EXISTS sync_rows (entity TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(entity,id));
    CREATE TABLE IF NOT EXISTS sync_dead_letters (seq INTEGER PRIMARY KEY, entity TEXT NOT NULL, entity_id TEXT NOT NULL, code TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL);
  `)
  function shadow(entity: string, id: string): Row {
    const row = firstRow(driver, 'SELECT payload FROM sync_rows WHERE entity=? AND id=?', [
      entity,
      id,
    ])
    return row ? (JSON.parse(readText(row, 'payload')) as Row) : blank(entity, id)
  }
  function saveShadow(row: Row): void {
    driver.run(
      'INSERT INTO sync_rows(entity,id,payload) VALUES(?,?,?) ON CONFLICT(entity,id) DO UPDATE SET payload=excluded.payload',
      [row.entity, row.id, JSON.stringify(row)],
    )
  }
  function fromSql(
    entity: string,
    id: string,
    raw: SqlRow,
    columns: Readonly<Record<string, string>>,
    previous: Row,
  ): Row {
    const clocks = JSON.parse(readText(raw, 'field_hlc')) as Record<string, string>
    const fallback = readText(raw, 'updated_hlc')
    const provisional = entity === 'user_phrase' && pendingDeletes()[id] !== undefined
    const fields: Record<string, Field> = { ...previous.fields }
    for (const [field, column] of Object.entries(columns)) {
      if (field === 'deletedAt' && provisional) continue
      if (entity === 'settings' && !clocks[field] && !previous.fields[field]) continue
      const value = raw[column]
      if (value === undefined) continue
      if (
        value === null &&
        (field.startsWith('own') ||
          field === 'targetLocale' ||
          (field.startsWith('srs') && field !== 'srsLastReview'))
      )
        continue
      // A never-scheduled row has no complete latest-review group to send or merge.
      if (field.startsWith('srs') && raw['srs_stability'] === null) continue
      const v = BOOL_FIELDS.has(field)
        ? value === 1 || value === '1'
        : decodeField(entity, field, value)
      fields[field] = {
        v,
        hlc: parseHlc(
          clocks[field] ??
            (previous.fields[field]
              ? encodeHlc(previous.fields[field].hlc)
              : ((field === 'srsAlgorithm' ? clocks['srsLastReview'] : undefined) ?? fallback)),
        ),
      }
    }
    return {
      entity,
      id,
      fields,
      deleted_at:
        !provisional && typeof raw['deleted_at'] === 'number'
          ? raw['deleted_at']
          : previous.deleted_at,
    }
  }
  function localRow(entity: string, id: string): Row {
    let row = shadow(entity, id)
    if (entity === 'user_phrase') {
      const raw = firstRow(driver, 'SELECT * FROM user_phrase WHERE user_id=? AND id=?', [
        userId,
        id,
      ])
      if (raw) row = fromSql(entity, id, raw, PHRASE_COLUMNS, row)
    } else if (entity === 'settings') {
      const raw = firstRow(driver, 'SELECT * FROM settings WHERE user_id=?', [userId])
      if (raw) row = fromSql(entity, id, raw, SETTINGS_COLUMNS, row)
    }
    // Pending day writes have no field_hlc columns; layer their exact durable clocks
    // over the last synchronized version before resolving a remote page.
    const ops = driver.all(
      'SELECT payload,op,created_at FROM outbox WHERE user_id=? AND entity=? AND entity_id=? ORDER BY seq',
      [userId, entity, id],
    )
    for (const op of ops) {
      const writes = JSON.parse(readText(op, 'payload')) as Record<
        string,
        { v: unknown; hlc: string }
      >
      const fields = Object.fromEntries(
        Object.entries(writes).map(([field, write]) => [
          field,
          { v: decodeField(entity, field, write.v), hlc: parseHlc(write.hlc) },
        ]),
      )
      row = merge(row, {
        entity,
        id,
        fields,
        deleted_at: op['op'] === 'delete' ? Number(op['created_at']) : null,
      })
    }
    return row
  }
  function pendingDeletes(): Record<string, { at: number; readyAt: number }> {
    const row = firstRow(driver, "SELECT v FROM kv WHERE k='pending_phrase_deletes'")
    return row
      ? (JSON.parse(readText(row, 'v')) as Record<string, { at: number; readyAt: number }>)
      : {}
  }
  function writeKv(key: string, value: unknown): void {
    driver.run('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', [
      key,
      JSON.stringify(value),
    ])
  }
  function correctStoredClock(op: OutboxOp, field: string, from: string, to: string): void {
    // Legacy six-field requests stay byte-identical after their first attempt. Rust
    // adds their known preview provenance at the review anchor's stamp; its derived
    // clock must follow the same receipt correction even though it was not on the wire.
    if (field === 'srsLastReview' && !op.fields['srsAlgorithm'])
      correctStoredClock(op, 'srsAlgorithm', from, to)
    const prior = shadow(op.entity, op.entityId)
    const stored = prior.fields[field]
    if (stored && encodeHlc(stored.hlc) === from) {
      prior.fields[field] = { ...stored, hlc: parseHlc(to) }
      saveShadow(prior)
    }
    if (op.entity !== 'user_phrase' && op.entity !== 'settings') return
    const key = op.entity === 'user_phrase' ? 'id' : 'user_id'
    const id = op.entity === 'user_phrase' ? op.entityId : userId
    const raw = firstRow(
      driver,
      `SELECT field_hlc,updated_hlc FROM ${op.entity} WHERE ${key}=? AND user_id=?`,
      [id, userId],
    )
    if (!raw) return
    const clocks = JSON.parse(readText(raw, 'field_hlc')) as Record<string, string>
    // A newer local write owns a different stamp and must remain pending unchanged.
    if ((clocks[field] ?? readText(raw, 'updated_hlc')) !== from) return
    clocks[field] = to
    driver.run(`UPDATE ${op.entity} SET field_hlc=? WHERE ${key}=? AND user_id=?`, [
      JSON.stringify(clocks),
      id,
      userId,
    ])
  }
  function writeColumns(
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
  function applyReview(row: Row, values: Readonly<Record<string, unknown>>): void {
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
  function apply(row: Row, serverHlc: string): void {
    saveShadow(row)
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
        const pending = pendingDeletes()
        if (pending[row.id]) {
          Reflect.deleteProperty(pending, row.id)
          writeKv('pending_phrase_deletes', pending)
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
      columns['deleted_at'] = pendingDeletes()[row.id]?.at ?? row.deleted_at
      writeColumns('user_phrase', { id: row.id }, columns)
      const target = typeof values['targetLocale'] === 'string' ? values['targetLocale'] : 'es-ES'
      writeColumns('course_session', { user_id: userId, target_locale: target }, { onboarded: 1 })
    } else if (row.entity === 'review_log') {
      applyReview(row, values)
    } else if (row.entity === 'settings') {
      if (row.deleted_at !== null) return
      const columns: Record<string, SqlValue> = { field_hlc: fieldHlc, updated_hlc: serverHlc }
      for (const [key, field] of Object.entries(row.fields)) {
        const column = SETTINGS_COLUMNS[key]
        if (column) columns[column] = sqlValue(field.v)
      }
      writeColumns('settings', { user_id: userId }, columns)
    } else if (row.entity === 'streak_day') {
      if (row.deleted_at !== null) {
        driver.run('DELETE FROM streak_day WHERE user_id=? AND local_day=?', [userId, row.id])
        return
      }
      writeColumns(
        'streak_day',
        { user_id: userId, local_day: row.id },
        {
          practised: values['practised'] === false ? 0 : 1,
          minutes: typeof values['minutes'] === 'number' ? values['minutes'] : 0,
        },
      )
    } else if (row.entity === 'refrain_day') {
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
        'refrain_day',
        { user_id: userId, target_locale: target, local_day: day },
        { set_ids: JSON.stringify(values['setIds'] ?? []), waves: JSON.stringify(waves) },
      )
    }
    // Reviewed append-only wire entities have no learner UI yet. Their validated rows
    // remain durable in sync_rows so an older screen set never stalls account convergence.
  }
  function quarantine(op: OutboxOp, code: string): void {
    driver.run(
      'INSERT INTO sync_dead_letters(seq,entity,entity_id,code,payload,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(seq) DO NOTHING',
      [op.seq, op.entity, op.entityId, code, JSON.stringify(op), options.now()],
    )
    persistence.outbox.ack([op.seq])
  }
  function alias(from: string, to: string, serverHlc: string): void {
    if (from === to) return
    const incoming = localRow('user_phrase', from)
    incoming.id = to
    const merged = merge(localRow('user_phrase', to), incoming)
    const storedAliases = firstRow(driver, "SELECT v FROM kv WHERE k='sync.aliases'")
    const aliases = storedAliases
      ? (JSON.parse(readText(storedAliases, 'v')) as Record<string, string>)
      : {}
    aliases[from] = to
    writeKv('sync.aliases', aliases)
    const pending = pendingDeletes()
    if (pending[from]) {
      pending[to] = pending[from]
      Reflect.deleteProperty(pending, from)
      writeKv('pending_phrase_deletes', pending)
    }
    driver.run('DELETE FROM user_phrase WHERE user_id=? AND id=?', [userId, from])
    driver.run('DELETE FROM sync_rows WHERE entity=? AND id=?', ['user_phrase', from])
    if (Object.keys(merged.fields).length > 0) apply(merged, serverHlc)
    for (const stored of driver.all('SELECT payload FROM sync_rows')) {
      const row = JSON.parse(readText(stored, 'payload')) as Row
      let changed = false
      const ref = row.fields['phraseId']
      if (row.entity !== 'user_phrase' && ref?.v === from) {
        ref.v = to
        changed = true
      }
      const ids = row.fields['setIds']
      if (ids && Array.isArray(ids.v) && ids.v.includes(from)) {
        ids.v = ids.v.map((id: unknown) => (id === from ? to : id))
        changed = true
      }
      if (changed) saveShadow(row)
    }
    driver.run('UPDATE course_session SET selected_id=? WHERE user_id=? AND selected_id=?', [
      to,
      userId,
      from,
    ])
    driver.run('UPDATE review_event SET phrase_id=? WHERE user_id=? AND phrase_id=?', [
      to,
      userId,
      from,
    ])
    for (const entry of driver.all("SELECT k,v FROM kv WHERE k LIKE 'phrase-order:%'")) {
      const ids: unknown = JSON.parse(readText(entry, 'v'))
      if (Array.isArray(ids) && ids.includes(from))
        writeKv(readText(entry, 'k'), [
          ...new Set(ids.map((id: unknown) => (id === from ? to : id))),
        ])
    }
    function rewriteRefs(value: unknown): unknown {
      if (Array.isArray(value)) return value.map((entry: unknown) => rewriteRefs(entry))
      if (value && typeof value === 'object')
        return Object.fromEntries(
          Object.entries(value).map(([key, entry]: [string, unknown]) => [
            key,
            key === 'phraseId' && entry === from ? to : rewriteRefs(entry),
          ]),
        )
      return value
    }
    for (const course of driver.all(
      'SELECT target_locale,refrain_session FROM course_session WHERE user_id=? AND refrain_session IS NOT NULL',
      [userId],
    )) {
      const resume: unknown = JSON.parse(readText(course, 'refrain_session'))
      driver.run(
        'UPDATE course_session SET refrain_session=? WHERE user_id=? AND target_locale=?',
        [JSON.stringify(rewriteRefs(resume)), userId, readText(course, 'target_locale')],
      )
    }
    for (const row of driver.all(
      'SELECT local_day,target_locale,set_ids,substituted FROM refrain_day WHERE user_id=?',
      [userId],
    )) {
      const replace = (raw: string): string =>
        JSON.stringify((JSON.parse(raw) as string[]).map((id) => (id === from ? to : id)))
      driver.run(
        'UPDATE refrain_day SET set_ids=?,substituted=? WHERE user_id=? AND target_locale=? AND local_day=?',
        [
          replace(readText(row, 'set_ids')),
          replace(readText(row, 'substituted')),
          userId,
          readText(row, 'target_locale'),
          readText(row, 'local_day'),
        ],
      )
    }
    for (const row of driver.all(
      'SELECT seq,entity,entity_id,payload FROM outbox WHERE user_id=? AND attempts=0',
      [userId],
    )) {
      const fields = JSON.parse(readText(row, 'payload')) as Record<
        string,
        { v: unknown; hlc: string }
      >
      const ref = fields['phraseId']
      if (row['entity'] !== 'user_phrase' && ref?.v === from) ref.v = to
      const setIds = fields['setIds']
      if (setIds && typeof setIds.v === 'string')
        setIds.v = JSON.stringify(
          (JSON.parse(setIds.v) as string[]).map((id) => (id === from ? to : id)),
        )
      driver.run('UPDATE outbox SET entity_id=?,payload=? WHERE user_id=? AND seq=?', [
        row['entity'] === 'user_phrase' && row['entity_id'] === from
          ? to
          : readText(row, 'entity_id'),
        JSON.stringify(fields),
        userId,
        Number(row['seq']),
      ])
    }
  }
  return {
    bindAccount(accountId) {
      driver.transaction(() => {
        const row = firstRow(driver, "SELECT v FROM kv WHERE k='sync.account'")
        if (row && row['v'] !== accountId) throw new SyncError('ACCOUNT_MISMATCH')
        driver.run("INSERT INTO kv(k,v) VALUES('sync.account',?) ON CONFLICT(k) DO NOTHING", [
          accountId,
        ])
      })
    },
    state() {
      const row = firstRow(driver, 'SELECT * FROM sync_state WHERE id=1')
      return {
        cursor: typeof row?.['cursor'] === 'string' ? row['cursor'] : null,
        failures: Number(row?.['failures'] ?? 0),
        nextAttemptAt: Number(row?.['next_attempt_at'] ?? 0),
        quarantined: Number(
          firstRow(driver, 'SELECT COUNT(*) AS n FROM sync_dead_letters')?.['n'] ?? 0,
        ),
      }
    },
    pending: (limit) => persistence.outbox.pending(limit),
    hlc: options.hlc,
    beginPush(seqs) {
      if (seqs.length > 0)
        driver.run(
          `UPDATE outbox SET attempts=attempts+1,last_error=NULL WHERE user_id=? AND seq IN (${seqs.map(() => '?').join(',')})`,
          [userId, ...seqs],
        )
    },
    commitPush(ops, response) {
      driver.transaction(() => {
        const sent = new Map(ops.map((op) => [op.seq, op]))
        const accepted = new Set(response.accepted)
        if (
          accepted.size !== response.accepted.length ||
          new Set(response.rejected.map((rejection) => rejection.seq)).size !==
            response.rejected.length ||
          response.accepted.some((seq) => !sent.has(seq)) ||
          response.rejected.some(
            (rejection) =>
              rejection.seq === null || !sent.has(rejection.seq) || accepted.has(rejection.seq),
          )
        )
          throw new SyncError('INVALID_ACK')
        writeKv('sync.server_time', response.server_time)
        const corrections = new Map<string, string>()
        for (const correction of response.clock_corrections ?? []) {
          const op = sent.get(correction.seq)
          if (
            !op ||
            !accepted.has(correction.seq) ||
            op.fields[correction.field]?.hlc !== correction.from
          )
            throw new SyncError('INVALID_CLOCK_CORRECTION')
          corrections.set(`${correction.seq}:${correction.field}`, correction.to)
          correctStoredClock(op, correction.field, correction.from, correction.to)
        }
        for (const op of ops)
          if (accepted.has(op.seq)) {
            const wire = outboxToWire(op)
            const fields =
              wire.op === 'upsert'
                ? Object.fromEntries(
                    Object.entries(wire.fields as Record<string, { v: unknown; hlc: string }>).map(
                      ([key, value]) => [
                        key,
                        {
                          v: value.v,
                          hlc: parseHlc(corrections.get(`${op.seq}:${key}`) ?? value.hlc),
                        },
                      ],
                    ),
                  )
                : {}
            saveShadow(
              merge(shadow(op.entity, op.entityId), {
                entity: op.entity,
                id: op.entityId,
                fields,
                deleted_at: wire.op === 'delete' ? wire.deleted_at : null,
              }),
            )
          }
        // Ack immutable accepted payloads before rewriting only still-pending aliases.
        persistence.outbox.ack(response.accepted)
        for (const rejection of response.rejected) {
          const op = rejection.seq === null ? undefined : sent.get(rejection.seq)
          if (op) quarantine(op, rejection.code)
        }
        for (const mapping of response.aliases ?? [])
          alias(mapping.from, mapping.to, response.server_hlc)
        options.receiveHlc(response.server_hlc)
        driver.run('UPDATE sync_state SET server_hlc=? WHERE id=1', [response.server_hlc])
      })
    },
    applyPage(page) {
      driver.transaction(() => {
        for (const mapping of page.aliases ?? []) alias(mapping.from, mapping.to, page.server_hlc)
        for (const change of page.changes) {
          if (
            change.entity === 'user_phrase' &&
            change.deleted_at !== null &&
            change.catalog_identity
          ) {
            writeColumns(
              'sync_catalog_tombstones',
              { id: change.entity_id },
              {
                phrase_id: change.catalog_identity.phraseId,
                target_locale: change.catalog_identity.targetLocale,
                deleted_at: change.deleted_at,
              },
            )
          }
          const remote: Row = {
            entity: change.entity,
            id: change.entity_id,
            fields: Object.fromEntries(
              Object.entries(change.fields as Record<string, { v: unknown; hlc: string }>).map(
                ([key, field]) => [key, { v: field.v, hlc: parseHlc(field.hlc) }],
              ),
            ),
            deleted_at: change.deleted_at,
          }
          apply(merge(localRow(remote.entity, remote.id), remote), page.server_hlc)
        }
        options.receiveHlc(page.server_hlc)
        driver.run('UPDATE sync_state SET cursor=?,server_hlc=? WHERE id=1', [
          page.next,
          page.server_hlc,
        ])
      })
    },
    quarantine: (op, code) => {
      driver.transaction(() => {
        quarantine(op, code)
      })
    },
    fail(seqs, code, nextAttemptAt) {
      driver.transaction(() => {
        if (seqs.length > 0)
          driver.run(
            `UPDATE outbox SET last_error=? WHERE user_id=? AND seq IN (${seqs.map(() => '?').join(',')})`,
            [code, userId, ...seqs],
          )
        driver.run('UPDATE sync_state SET failures=failures+1,next_attempt_at=? WHERE id=1', [
          nextAttemptAt,
        ])
      })
    },
    resetCursor() {
      driver.run('UPDATE sync_state SET cursor=NULL WHERE id=1')
    },
    succeeded() {
      driver.run('UPDATE sync_state SET failures=0,next_attempt_at=0 WHERE id=1')
    },
  }
}
