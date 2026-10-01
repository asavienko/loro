/**
 * The library (plan 106): Loro's content and what learners make, with who can see it.
 *
 * `owner_id` is null for Loro's own rows. Documents keep the app's JSON shapes in `doc` so the pack
 * is served without re-mapping every field. Times are epoch milliseconds; `day` is a UTC date.
 */
export const LIBRARY_MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS library_meta (
  key text PRIMARY KEY,
  value text NOT NULL
);
CREATE TABLE IF NOT EXISTS library_topics (
  id text PRIMARY KEY,
  position integer NOT NULL,
  doc jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS library_sets (
  id text PRIMARY KEY,
  owner_id text,
  target_lang text NOT NULL,
  native_lang text,
  title text NOT NULL,
  subtitle jsonb,
  description text,
  topic_id text NOT NULL,
  level text NOT NULL,
  cover_icon text NOT NULL,
  cover_id text,
  visibility text NOT NULL,
  share_code text NOT NULL UNIQUE,
  origin text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS library_sets_owner ON library_sets(owner_id);
CREATE INDEX IF NOT EXISTS library_sets_listing ON library_sets(target_lang, visibility);
CREATE TABLE IF NOT EXISTS library_phrases (
  id text PRIMARY KEY,
  set_id text NOT NULL,
  position integer NOT NULL,
  source text NOT NULL,
  doc jsonb NOT NULL,
  note_translations jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS library_phrases_set ON library_phrases(set_id);
CREATE TABLE IF NOT EXISTS library_bank_themes (
  id text PRIMARY KEY,
  position integer NOT NULL,
  doc jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS library_bank (
  id text PRIMARY KEY,
  target_lang text NOT NULL,
  position integer NOT NULL,
  doc jsonb NOT NULL,
  note_translations jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS library_covers (
  id text PRIMARY KEY,
  owner_id text,
  provider text NOT NULL,
  svg text NOT NULL,
  created_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS library_albums (
  id text PRIMARY KEY,
  owner_id text,
  target_lang text NOT NULL,
  title text NOT NULL,
  description text,
  cover_id text,
  visibility text NOT NULL,
  share_code text NOT NULL UNIQUE,
  origin text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS library_albums_owner ON library_albums(owner_id);
CREATE TABLE IF NOT EXISTS library_songs (
  id text PRIMARY KEY,
  album_id text NOT NULL,
  owner_id text,
  set_id text NOT NULL,
  position integer NOT NULL,
  title text NOT NULL,
  style_id text NOT NULL,
  status text NOT NULL,
  lyrics jsonb NOT NULL,
  lyrics_by text NOT NULL,
  audio_id text,
  audio_by text,
  duration_ms integer,
  error text,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS library_songs_album ON library_songs(album_id);
CREATE TABLE IF NOT EXISTS library_audio (
  id text PRIMARY KEY,
  content_type text NOT NULL,
  byte_length integer NOT NULL,
  body bytea NOT NULL
);
CREATE TABLE IF NOT EXISTS library_saves (
  user_id text NOT NULL,
  kind text NOT NULL,
  item_id text NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY (user_id, kind, item_id)
);
CREATE TABLE IF NOT EXISTS library_usage (
  user_id text NOT NULL,
  kind text NOT NULL,
  day text NOT NULL,
  used integer NOT NULL,
  PRIMARY KEY (user_id, kind, day)
);
CREATE TABLE IF NOT EXISTS library_profiles (
  user_id text PRIMARY KEY,
  display_name text NOT NULL,
  updated_at bigint NOT NULL
);
`

/**
 * A learner's progress in their account (plan 106): the app's learner state (compact log, likes,
 * own phrases and sets, profile), merged on the device before it is written. `revision` makes a
 * write from a device that hasn't seen the latest one fail, so no device's progress is lost.
 */
export const LIBRARY_PROGRESS_MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS library_progress (
  user_id text PRIMARY KEY,
  revision integer NOT NULL,
  body jsonb NOT NULL,
  updated_at bigint NOT NULL
);
`

/** Reports of a public item (plan 106): one per learner per item; enough of them take it out of Community. */
export const LIBRARY_REPORTS_MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS library_reports (
  user_id text NOT NULL,
  kind text NOT NULL,
  item_id text NOT NULL,
  reason text NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY (user_id, kind, item_id)
);
CREATE INDEX IF NOT EXISTS library_reports_item ON library_reports(kind, item_id);
`

/** Utterances a stored phrase may be spoken in, and their clip once rendered (library/speech.ts). */
export const LIBRARY_SPEECH_MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS library_speech (
  id text PRIMARY KEY,
  lang text NOT NULL,
  text text NOT NULL,
  voice_id text,
  model text,
  audio_id text,
  duration_ms integer,
  created_at bigint NOT NULL
);
`

/** A clip whose render failed is not asked for again for a while (library/speech.ts). */
export const LIBRARY_SPEECH_FAILURES_MIGRATION_SQL = `ALTER TABLE library_speech ADD COLUMN IF NOT EXISTS failed_at bigint;
`

/** Whose phrase an utterance came from, so a learner's clips count against their own allowance too. */
export const LIBRARY_SPEECH_OWNERS_MIGRATION_SQL = `ALTER TABLE library_speech ADD COLUMN IF NOT EXISTS owner_id text;
`

/** A demo song whose lines the server's voice speaks over its bars (library/speech.ts). */
export const LIBRARY_SONG_VOICES_MIGRATION_SQL = `ALTER TABLE library_songs ADD COLUMN IF NOT EXISTS voiced boolean NOT NULL DEFAULT false;
`

/** Community's popular order counts an item's saves. */
export const LIBRARY_SAVE_COUNTS_MIGRATION_SQL = `CREATE INDEX IF NOT EXISTS library_saves_item ON library_saves(kind, item_id);
`

/** A set's page lists the songs sung from it. */
export const LIBRARY_SONG_SETS_MIGRATION_SQL = `CREATE INDEX IF NOT EXISTS library_songs_set ON library_songs(set_id, status);
`

/**
 * Plan 108: a learner's set lists phrases held elsewhere (Loro's, or the learner's own in another
 * set) by reference, so a phrase keeps one progress; and each learner's "My phrases" set per course.
 */
export const LIBRARY_SET_REFS_MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS library_set_refs (
  set_id text NOT NULL,
  phrase_id text NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (set_id, phrase_id)
);
CREATE INDEX IF NOT EXISTS library_set_refs_phrase ON library_set_refs(phrase_id);
ALTER TABLE library_sets ADD COLUMN IF NOT EXISTS inbox boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS library_sets_inbox ON library_sets(owner_id, target_lang) WHERE inbox;
`

/** Plan 111: the writer is named for what it is, not for one vendor; rows written before say `claude`. */
export const LIBRARY_AI_LABELS_MIGRATION_SQL = `UPDATE library_covers SET provider = 'ai' WHERE provider = 'claude';
UPDATE library_songs SET lyrics_by = 'ai' WHERE lyrics_by = 'claude';
`

/**
 * Plan 111: a cover is drawn in the background. It is `rendering`, without SVG, until the image model
 * (or a fallback) answers; then it is `ready`, or `failed` if the work itself broke.
 */
export const LIBRARY_COVER_JOBS_MIGRATION_SQL = `ALTER TABLE library_covers ALTER COLUMN svg DROP NOT NULL;
ALTER TABLE library_covers ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';
`

/**
 * Plan 111: a deck of suggestions written in the background, read by the learner who asked while
 * they wait, then cleared after a day.
 */
export const LIBRARY_DECK_JOBS_MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS library_deck_jobs (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  status text NOT NULL,
  result jsonb,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS library_deck_jobs_created ON library_deck_jobs(created_at);
`
