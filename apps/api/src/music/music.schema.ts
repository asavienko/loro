/** Phrase-song lyric documents, jobs and object bytes. */
export const MUSIC_MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS music_lyric_documents (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  document_json jsonb NOT NULL,
  document_hash text NOT NULL,
  fallback boolean NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS music_lyric_documents_user ON music_lyric_documents(user_id);
CREATE TABLE IF NOT EXISTS music_jobs (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  lyric_document_id text NOT NULL,
  track_id text,
  style_id text NOT NULL,
  model_id text NOT NULL,
  plan_hash text NOT NULL,
  sha256 text,
  byte_length integer,
  duration_ms integer,
  provider_song_id text,
  status text NOT NULL,
  error_code text,
  spend_micros bigint NOT NULL DEFAULT 0,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS music_jobs_user_track ON music_jobs(user_id, track_id);
CREATE TABLE IF NOT EXISTS music_objects (
  sha256 text PRIMARY KEY,
  content_type text NOT NULL,
  byte_length integer NOT NULL,
  body bytea NOT NULL
);
`
