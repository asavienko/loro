import { AUTH_MIGRATION_SQL } from '../auth/auth.schema.js'

/** Additive, transactionally installed schema. Tombstones, receipts and cursors have no GC yet. */
export const DATABASE_MIGRATION_SQL = `${AUTH_MIGRATION_SQL}
CREATE TABLE IF NOT EXISTS sync_heads (
  user_id text PRIMARY KEY, revision bigint NOT NULL DEFAULT 0,
  hlc text NOT NULL DEFAULT '0:0000:srv'
);
CREATE TABLE IF NOT EXISTS sync_rows (
  user_id text NOT NULL, entity text NOT NULL, entity_id text NOT NULL,
  row_json jsonb NOT NULL, PRIMARY KEY(user_id, entity, entity_id)
);
CREATE TABLE IF NOT EXISTS sync_changes (
  user_id text NOT NULL, revision bigint NOT NULL, row_json jsonb NOT NULL,
  PRIMARY KEY(user_id, revision)
);
CREATE TABLE IF NOT EXISTS sync_receipts (
  user_id text NOT NULL, device_id text NOT NULL, seq bigint NOT NULL,
  digest text NOT NULL, conflicts jsonb NOT NULL, aliases jsonb NOT NULL,
  clock_corrections jsonb NOT NULL DEFAULT '[]',
  PRIMARY KEY(user_id, device_id, seq)
);
ALTER TABLE sync_receipts ADD COLUMN IF NOT EXISTS clock_corrections jsonb NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS sync_cursors (
  token text PRIMARY KEY, user_id text NOT NULL,
  after_revision bigint NOT NULL, watermark bigint
);
CREATE INDEX IF NOT EXISTS sync_cursors_user ON sync_cursors(user_id);
CREATE TABLE IF NOT EXISTS sync_phrase_identity (
  user_id text NOT NULL, target_locale text NOT NULL, phrase_id text NOT NULL,
  entity_id text NOT NULL, PRIMARY KEY(user_id, target_locale, phrase_id)
);
CREATE TABLE IF NOT EXISTS sync_aliases (
  user_id text NOT NULL, original_id text NOT NULL, canonical_id text NOT NULL,
  PRIMARY KEY(user_id, original_id)
);
CREATE TABLE IF NOT EXISTS sync_phrase_generations (
  user_id text NOT NULL, target_locale text NOT NULL, phrase_id text NOT NULL,
  previous_id text NOT NULL, previous_deleted_at bigint NOT NULL, entity_id text NOT NULL,
  PRIMARY KEY(user_id,target_locale,phrase_id,previous_id,previous_deleted_at)
);
-- Bind already-stored IDs to their own generation before future re-adds exist.
INSERT INTO sync_aliases(user_id,original_id,canonical_id)
  SELECT user_id,entity_id,entity_id FROM sync_rows WHERE entity='user_phrase'
  ON CONFLICT DO NOTHING;
`
