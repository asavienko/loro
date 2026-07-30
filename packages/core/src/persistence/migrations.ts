/**
 * Schema and migrations.
 *
 * Forward-only, numbered, and applied in one transaction each. The DDL is the one in
 * docs/architecture/data-model.md — that document is the spec, and a divergence here is a
 * bug in this file, not a decision.
 *
 * **A downgraded app must refuse to run.** If the file on disk is newer than the binary
 * knows about, `migrate()` throws instead of proceeding: an older build that carries on
 * regardless writes rows missing columns the newer build added, and the learner's data is
 * corrupted by the app that was trying to help.
 *
 * ── Scope ──
 * v1 creates the tables the app actually reads and writes today: the learner's phrases,
 * settings, the frozen Refrain day, the streak history, the outbox, and a kv table. The
 * catalog tables in data-model.md are content, shipped and updated independently
 * (ADR-0009), and the app still loads the catalog from `@loro/content`.
 *
 * ── Encryption ──
 * The file is NOT encrypted. It relies on OS full-disk encryption; SQLCipher is deferred
 * (Q-09 in docs/decisions/open-questions.md). Recorded audio never reaches this database
 * at all — non-negotiable #1.
 */

import type { SqlDriver } from './driver.js'
import { firstRow, readInt, readText } from './driver.js'

export interface Migration {
  readonly version: number
  readonly name: string
  readonly up: string
}

/**
 * Every migration, in order. Append only — never edit a shipped one, because a device
 * that already applied it will never see the change.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial',
    up: `
      CREATE TABLE user_phrase (
        id                TEXT PRIMARY KEY,
        user_id           TEXT NOT NULL,
        phrase_id         TEXT,
        own_es            TEXT,
        own_en            TEXT,
        own_theme         TEXT,
        own_emoji         TEXT,
        source            TEXT NOT NULL,

        difficulty        TEXT NOT NULL DEFAULT 'med',
        tags              TEXT NOT NULL DEFAULT '[]',
        loved             INTEGER NOT NULL DEFAULT 0,
        learned           INTEGER NOT NULL DEFAULT 0,
        note              TEXT,

        plays             INTEGER NOT NULL DEFAULT 0,
        reps              INTEGER NOT NULL DEFAULT 0,
        added_at          INTEGER NOT NULL,
        last_practiced_at INTEGER,
        graduated_at      INTEGER,

        srs_stability     REAL,
        srs_difficulty    REAL,
        srs_due           INTEGER,
        srs_last_review   INTEGER,
        srs_lapses        INTEGER NOT NULL DEFAULT 0,
        srs_state         TEXT NOT NULL DEFAULT 'new',

        reps_today        INTEGER NOT NULL DEFAULT 0,
        reps_today_day    TEXT,
        automaticity      INTEGER NOT NULL DEFAULT 0,
        lock_in_days      INTEGER NOT NULL DEFAULT 0,

        rung              INTEGER NOT NULL DEFAULT 0,
        stumbles          INTEGER NOT NULL DEFAULT 0,

        cue_level         INTEGER NOT NULL DEFAULT 0,
        ax_perception     INTEGER NOT NULL DEFAULT 0,
        ax_recall         INTEGER NOT NULL DEFAULT 0,
        ax_production     INTEGER NOT NULL DEFAULT 0,

        updated_hlc       TEXT NOT NULL,
        field_hlc         TEXT NOT NULL DEFAULT '{}',
        deleted_at        INTEGER,

        CHECK (phrase_id IS NOT NULL OR own_es IS NOT NULL)
      );

      -- The blueprint's "adding twice is a no-op" guard, enforced by the database rather
      -- than by remembering to check (Loro.dc.html:3602).
      CREATE UNIQUE INDEX idx_up_user_phrase ON user_phrase(user_id, phrase_id)
        WHERE phrase_id IS NOT NULL AND deleted_at IS NULL;

      -- Indexes from day one: M4 tests at 2 000 phrases, and adding them later means a
      -- migration that rewrites every learner's table.
      CREATE INDEX idx_up_due      ON user_phrase(user_id, srs_due)
        WHERE deleted_at IS NULL AND learned = 0;
      CREATE INDEX idx_up_active   ON user_phrase(user_id, learned)   WHERE deleted_at IS NULL;
      CREATE INDEX idx_up_rung     ON user_phrase(user_id, rung)      WHERE deleted_at IS NULL;
      CREATE INDEX idx_up_practice ON user_phrase(user_id, last_practiced_at)
        WHERE deleted_at IS NULL;
      -- The Refrain reads today's counter for every phrase in the set.
      CREATE INDEX idx_up_today    ON user_phrase(user_id, reps_today_day)
        WHERE deleted_at IS NULL;

      CREATE TABLE settings (
        user_id             TEXT PRIMARY KEY,
        goal                TEXT,
        level               TEXT,
        daily_minutes       INTEGER,
        active_engine       TEXT,
        engine_explicit     INTEGER NOT NULL DEFAULT 0,
        wave_times          TEXT NOT NULL DEFAULT '["08:00","13:00","19:00"]',
        reminder_time       TEXT,
        notifications       TEXT NOT NULL DEFAULT '{}',
        accent              TEXT NOT NULL DEFAULT 'Coral',
        theme               TEXT NOT NULL DEFAULT 'light',
        analytics_opt_out   INTEGER NOT NULL DEFAULT 0,
        cloud_asr_consent   INTEGER NOT NULL DEFAULT 0,
        voice_clone_consent INTEGER NOT NULL DEFAULT 0,
        onboarded           INTEGER NOT NULL DEFAULT 0,
        updated_hlc         TEXT NOT NULL,
        field_hlc           TEXT NOT NULL DEFAULT '{}'
      );

      -- Frozen set membership is what makes "you always see today" survive a restart.
      CREATE TABLE refrain_day (
        user_id     TEXT NOT NULL,
        local_day   TEXT NOT NULL,
        set_ids     TEXT NOT NULL,
        waves       TEXT NOT NULL DEFAULT '[]',
        substituted TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (user_id, local_day)
      );

      -- The streak is DERIVED from these rows, never stored as a counter. local_day here
      -- is the streak day key — midnight plus the grace window.
      CREATE TABLE streak_day (
        user_id   TEXT NOT NULL,
        local_day TEXT NOT NULL,
        practised INTEGER NOT NULL DEFAULT 1,
        minutes   INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, local_day)
      );

      CREATE TABLE outbox (
        seq        INTEGER PRIMARY KEY AUTOINCREMENT,
        entity     TEXT NOT NULL,
        entity_id  TEXT NOT NULL,
        op         TEXT NOT NULL,
        payload    TEXT NOT NULL,
        hlc        TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        attempts   INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );
      CREATE INDEX idx_outbox_entity ON outbox(entity, entity_id);

      CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    `,
  },
]

/** The newest schema this build understands. */
export const SCHEMA_VERSION: number = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0)

const VERSION_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  );
`

/** The highest applied migration, or 0 on a fresh database. */
export function currentVersion(driver: SqlDriver): number {
  driver.exec(VERSION_TABLE)
  const row = firstRow(driver, 'SELECT MAX(version) AS v FROM schema_version')
  // MAX() over an empty table is one row holding NULL, not zero rows — both mean "fresh".
  if (row === null || row['v'] === null) return 0
  return readInt(row, 'v')
}

export interface MigrationResult {
  readonly from: number
  readonly to: number
  readonly applied: readonly number[]
}

/**
 * Apply every migration the database has not seen yet.
 *
 * @param at epoch ms, passed in rather than read — this package has no clock.
 * @throws if the database is NEWER than this build (see the header).
 */
export function migrate(driver: SqlDriver, at: number): MigrationResult {
  const from = currentVersion(driver)

  if (from > SCHEMA_VERSION) {
    throw new Error(
      `database is at schema v${from} but this build only knows v${SCHEMA_VERSION}. ` +
        `Refusing to run: an older build would write rows missing columns a newer one added.`,
    )
  }

  const applied: number[] = []
  for (const migration of [...MIGRATIONS].sort((a, b) => a.version - b.version)) {
    if (migration.version <= from) continue
    // Each migration is atomic: a half-applied schema is not a state anything can
    // recover from on a learner's device.
    driver.transaction(() => {
      driver.exec(migration.up)
      driver.run('INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)', [
        migration.version,
        migration.name,
        at,
      ])
    })
    applied.push(migration.version)
  }

  return { from, to: currentVersion(driver), applied }
}

/**
 * Drop every table this schema owns.
 *
 * `reset()` must leave no learner rows on disk — GDPR erasure is a duty, and a
 * half-cleared local database is the usual way it gets missed
 * (docs/architecture/security-privacy.md).
 *
 * The list is READ FROM THE DATABASE rather than written here, because a hand-maintained
 * copy of the schema is one migration away from being wrong in the direction that leaves
 * a learner's rows behind. `MIGRATIONS` is append-only and nobody adding a table to v2
 * would think to also edit an erasure routine three hundred lines away.
 *
 * `sqlite_%` names are SQLite's own bookkeeping (`sqlite_sequence`, the internal
 * indexes); they are not droppable and hold nothing of the learner's. Dropping a table
 * takes its indexes and its `sqlite_sequence` row with it.
 */
export function dropAll(driver: SqlDriver): void {
  driver.transaction(() => {
    const tables = driver
      .all(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
      .map((row) => readText(row, 'name'))
    for (const table of tables) {
      // The name comes from sqlite_master, so it is already a real identifier.
      driver.exec(`DROP TABLE IF EXISTS "${table}";`)
    }
  })
}
