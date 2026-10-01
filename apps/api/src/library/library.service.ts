/**
 * The library (plan 106): Loro's pre-generated content, what learners make, and who may see it.
 *
 * Loro's rows (owner null) are seeded from `@loro/content/v2` the first time the library is used
 * after a content change. A learner's set or album is `private`, `link` (readable by anyone who has
 * its id or share code) or `public` (also listed in Community). Generation is signed-in only and
 * counted against the learner's daily allowance before any provider is asked.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { MUSIC_STYLE_IDS, type MusicStyleId } from '@loro/core'
import {
  V2_CONTENT,
  V2_LANGUAGES,
  type V2Language,
  type V2Localized,
  type V2Topic,
} from '@loro/content/v2'
import {
  AddPhraseSchema,
  CreateAlbumSchema,
  CreateSetSchema,
  EditPhraseSchema,
  GenerateCoverSchema,
  GenerateNotesSchema,
  GeneratePhrasesSchema,
  GenerateSongSchema,
  LibraryCourseSchema,
  LibraryIdSchema,
  MAX_SET_PHRASES,
  PhraseIdSchema,
  ProfileSchema,
  ReportSchema,
  RetrySongSchema,
  SaveSchema,
  ShareCodeSchema,
  UpdateAlbumSchema,
  UpdateSetSchema,
  type GeneratePhrasesRequest,
  type LibraryNotes,
  type SetItem,
  type Visibility,
} from '@loro/core/api/library'
import { z } from 'zod'
import { SERVER_CLOCK, type ServerClock } from '../common/clock.js'
import { config } from '../common/config.js'
import { LoroError } from '../common/errors.js'
import { parseContract } from '../common/parse.js'
import { DATABASE, type SqlConnection, type SqlDatabase } from '../database/database.js'
import { patternCover, renderCover, type CoverSpec } from './covers.js'
import type {
  AlbumWire,
  BankPhraseWire,
  BankThemeWire,
  DrawnCoverWire,
  KeptKind,
  LanguagesWire,
  Owner,
  PackWire,
  PhraseWire,
  SetWire,
  SongLineWire,
  SongWire,
  UsageKind,
  UsageWire,
} from './library.types.js'
import { composeLive, liveMusicConfigured } from './music-live.js'
import { registerSpeech, registerSpeechMany, SpeechService, speechFor } from './speech.js'
import { readTtsRuntimeConfig, type TtsRuntimeConfig } from '../tts/transport.js'
import { demoLineLimit, synthesizeDemo } from './synth.js'
import {
  MAX_SONG_LINES,
  assembleLyrics,
  bankPhrases,
  claudeCover,
  claudeLyrics,
  claudeNotes,
  ruleNotes,
  claudePhrases,
  writer,
  type SongPhrase,
  type SongSection,
  type WrittenPhrase,
} from './writers.js'

/** Bump when the seed's shape changes without the content version changing. */
const SEED_REVISION = 6
/** A song still rendering after this long was lost with its process: it reads as failed. */
const RENDER_TIMEOUT_MS = 10 * 60_000
const DAY_MS = 86_400_000
const COMMUNITY_PAGE = 50
/** How many more of a maker's things a shared item's page offers. */
const MORE_BY_MAKER = 12
/** This many learners reporting a public item take it out of Community; its link still opens it. */
const REPORTS_TO_HIDE = 3

type Language = V2Language
type NoteTranslations = PhraseWire['noteTranslations']

interface SetRow {
  id: string
  owner_id: string | null
  target_lang: Language
  native_lang: Language | null
  title: string
  subtitle: V2Localized | null
  description: string | null
  topic_id: string
  level: 'A1' | 'A2' | 'B1'
  cover_icon: string
  cover_id: string | null
  visibility: Visibility
  share_code: string
  origin: 'loro' | 'user'
  created_at: string | number
  updated_at: string | number
  author?: string | null
  /** Songs sung from it that anyone may hear, or its maker (SET_SELECT). */
  song_count?: string | number
  /** The learner's "My phrases" set for its course (plan 108). */
  inbox?: boolean
}
interface PhraseRow {
  id: string
  set_id: string
  /** The set's course, joined in: the language the phrase is said in. */
  target_lang: Language
  position: number
  source: PhraseWire['source']
  doc: Omit<PhraseWire, 'id' | 'setId' | 'noteTranslations' | 'source'>
  note_translations: NoteTranslations
  /** The set that lists it here: the one holding it, or one referring to it (plan 108). */
  member_of: string
}
interface AlbumRow {
  id: string
  owner_id: string | null
  target_lang: Language
  title: string
  description: string | null
  cover_id: string | null
  visibility: Visibility
  share_code: string
  origin: 'loro' | 'user'
  created_at: string | number
  updated_at: string | number
  author?: string | null
  song_count?: string | number
  duration_ms?: string | number | null
}
interface SongRow {
  id: string
  album_id: string
  owner_id: string | null
  set_id: string
  position: number
  title: string
  style_id: string
  status: SongWire['status']
  lyrics: { name: SongSection['name']; lines: SongLineWire[] }[]
  lyrics_by: SongWire['lyricsBy']
  audio_id: string | null
  audio_by: SongWire['audioBy']
  voiced?: boolean | null
  duration_ms: number | null
  error: string | null
  created_at: string | number
}

/** What a new cover goes on, and the words it is drawn for. */
interface CoverSubject {
  title: string
  description?: string | undefined
}
type CoverTarget =
  | { kind: 'set'; row: SetRow; copy: boolean; subject: CoverSubject }
  | { kind: 'album'; row: AlbumRow; copy: boolean; subject: CoverSubject }
  | { kind: 'song' | 'phrase'; id: string; subject: CoverSubject }

const num = (value: string | number | null | undefined) => Number(value ?? 0)
/** An empty description is no description. */
const blankToNull = (text: string | null | undefined): string | null =>
  text === undefined || text === null || text === '' ? null : text
const coverPath = (id: string | null) => (id ? `/library/covers/${id}.svg` : null)
const newId = (prefix: string) => `${prefix}-${randomBytes(8).toString('hex').slice(0, 12)}`
const newShareCode = () => {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  return Array.from(randomBytes(10), (byte) => alphabet[byte % alphabet.length]).join('')
}
/** The languages, versioned like a pack: the version changes whenever anything in them does. */
const LANGUAGES: LanguagesWire = {
  version: createHash('sha256').update(JSON.stringify(V2_LANGUAGES)).digest('hex').slice(0, 16),
  languages: V2_LANGUAGES,
}

/** A deck of suggestions as the app receives it (`POST /library/generate/phrases`). */
export interface PhraseDeck {
  provider: 'claude' | 'bank'
  phrases: WrittenPhrase[]
  themes: { id: string; title: V2Localized }[]
}
/** Claude is still writing the deck: ask again with the same body for it (`202`). */
export interface StillWriting {
  status: 'writing'
}

/**
 * How long one deck request waits for Claude before answering "still writing". The EC2 gateway
 * gives up on a request at 28 s (ec2-deployment.md), so the answer has to leave well before that.
 */
export const DECK_WAIT_MS = 20_000
/** How long notes for one phrase may take before Loro's rules answer instead, inside that ceiling. */
const NOTES_WAIT_MS = 22_000
/** A deck Claude finished keeps this long for its learner to come back for it. */
const DECK_KEEP_MS = 5 * 60_000
/**
 * Claude writes at most this many suggestions to a deck (More asks for the next ones): the learner
 * decides one card at a time, and a short deck is written in a fraction of a dozen's time.
 */
export const CLAUDE_DECK_SIZE = 6

interface DeckJob {
  done: Promise<PhraseDeck>
  answer?: PhraseDeck
  /** When it started, or finished. */
  at: number
}

@Injectable()
export class LibraryService {
  private readonly logger = new Logger('library')
  private seeded: Promise<void> | undefined
  /**
   * Decks Claude is writing or has written, by learner and request: a request that outlasts its
   * wait is answered "still writing", and the same request asked again joins the deck already
   * being written instead of spending another (one API process; see library.md).
   */
  private readonly decks = new Map<string, DeckJob>()

  constructor(
    @Inject(DATABASE) private readonly db: SqlDatabase,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
    /** Speaks a demo song's lines when the server has a voice for its language. */
    @Optional() @Inject(SpeechService) private readonly speech?: SpeechService,
  ) {}

  // ---------- seed ----------

  /** Loro's content, written once per content version (and again after a failed attempt). */
  private ready(): Promise<void> {
    this.seeded ??= this.seed()
      .then(() => {
        // Once per process, in the background: Loro's songs get the server's voice when it has one.
        if (!this.voicing && process.env['LIBRARY_VOICE_LORO_SONGS'] !== '0') {
          this.voicing = this.voiceLoroSongs().catch((error: unknown) => {
            this.logger.warn(
              `voicing Loro's songs failed: ${error instanceof Error ? error.message : 'unknown'}`,
            )
          })
        }
      })
      .catch((error: unknown) => {
        this.seeded = undefined
        throw error
      })
    return this.seeded
  }

  private voicing: Promise<void> | undefined

  /**
   * Loro's seeded songs are the plain demo; with a voice for their language, their lines are spoken
   * over it once (the same music, from the same seed), counted against the server's clip allowance.
   */
  private async voiceLoroSongs(): Promise<void> {
    if (!this.speech) return
    const songs = await this.db.query<{
      id: string
      set_id: string
      style_id: MusicStyleId
      lyrics: SongRow['lyrics']
      target_lang: Language
    }>(
      `SELECT so.id, so.set_id, so.style_id, so.lyrics, a.target_lang FROM library_songs so JOIN library_albums a ON a.id = so.album_id
       WHERE a.origin = 'loro' AND so.status = 'ready' AND so.voiced = false ORDER BY a.position, so.position`,
    )
    for (const song of songs.rows) {
      const texts = song.lyrics.flatMap((section) => section.lines.map((line) => line.text))
      const voices = await this.speech.songVoices(song.target_lang, texts, '__loro__')
      if (!voices.some((voice) => voice !== null)) continue
      const demo = synthesizeDemo(song.style_id, texts.length, song.set_id, voices)
      await this.db.transaction(async (tx) => {
        const audioId = await this.storeAudio(tx, demo.wav, 'audio/wav')
        await tx.query(
          'UPDATE library_songs SET audio_id = $2, duration_ms = $3, voiced = true WHERE id = $1',
          [song.id, audioId, demo.durationMs],
        )
        await forgetUnusedAudio(tx)
      })
      this.logger.log(`voiced Loro's song ${song.id}`)
    }
  }

  private async seed(): Promise<void> {
    const version = `${V2_CONTENT.version}:${SEED_REVISION}`
    const current = await this.db.query<{ value: string }>(
      "SELECT value FROM library_meta WHERE key = 'seed'",
    )
    if (current.rows[0]?.value === version) return
    await this.db.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtext('loro-library-seed'))")
      const again = await tx.query<{ value: string }>(
        "SELECT value FROM library_meta WHERE key = 'seed'",
      )
      if (again.rows[0]?.value === version) return
      const now = this.clock.now()
      await this.seedPhrases(tx, now)
      await this.seedAlbums(tx, now)
      // Learners' phrases stored before their utterances were recorded can be spoken too.
      const stored = await tx.query<{
        doc: PhraseRow['doc']
        target_lang: Language
        owner_id: string
      }>(
        `SELECT p.doc, s.target_lang, s.owner_id FROM library_phrases p JOIN library_sets s ON s.id = p.set_id WHERE s.origin = 'user'`,
      )
      for (const row of stored.rows)
        await registerSpeech(
          tx,
          { [row.target_lang]: row.doc.target, ...row.doc.translations },
          now,
          row.owner_id,
        )
      await tx.query(
        "INSERT INTO library_meta(key, value) VALUES ('seed', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [version],
      )
    })
    this.logger.log(`seeded Loro content ${version}`)
  }

  private async seedPhrases(tx: SqlConnection, now: number): Promise<void> {
    await tx.query('DELETE FROM library_topics')
    for (const [position, topic] of V2_CONTENT.topics.entries()) {
      await tx.query('INSERT INTO library_topics(id, position, doc) VALUES ($1,$2,$3)', [
        topic.id,
        position,
        JSON.stringify(topic),
      ])
    }
    const loroSets = V2_CONTENT.sets.map((s) => s.id)
    await tx.query(
      "DELETE FROM library_phrases WHERE set_id IN (SELECT id FROM library_sets WHERE origin = 'loro')",
    )
    await tx.query(
      "DELETE FROM library_sets WHERE origin = 'loro' AND NOT (id = ANY($1::text[]))",
      [loroSets],
    )
    for (const [position, set] of V2_CONTENT.sets.entries()) {
      await tx.query(
        `INSERT INTO library_sets(id, owner_id, target_lang, native_lang, title, subtitle, description, topic_id, level,
           cover_icon, cover_id, visibility, share_code, origin, position, created_at, updated_at)
         VALUES ($1, NULL, $2, NULL, $3, $4, NULL, $5, $6, $7, NULL, 'public', $8, 'loro', $9, $10, $10)
         ON CONFLICT (id) DO UPDATE SET target_lang = EXCLUDED.target_lang, title = EXCLUDED.title,
           subtitle = EXCLUDED.subtitle, topic_id = EXCLUDED.topic_id, level = EXCLUDED.level,
           cover_icon = EXCLUDED.cover_icon, position = EXCLUDED.position, updated_at = EXCLUDED.updated_at`,
        [
          set.id,
          set.targetLang,
          set.title,
          JSON.stringify(set.subtitle),
          set.topicId,
          set.level,
          set.coverIcon,
          shareCodeFor(set.id),
          position,
          now,
        ],
      )
      for (const [index, phraseId] of set.phraseIds.entries()) {
        const phrase = V2_CONTENT.phrases.find((p) => p.id === phraseId)
        if (!phrase) throw new Error(`Seed: ${set.id} names unknown phrase ${phraseId}`)
        const { id, ...doc } = phrase
        await tx.query(
          'INSERT INTO library_phrases(id, set_id, position, source, doc, note_translations) VALUES ($1,$2,$3,$4,$5,$6)',
          [
            id,
            set.id,
            index,
            'loro',
            JSON.stringify(doc),
            JSON.stringify(noteTranslationsOf(id, V2_CONTENT.noteTranslations)),
          ],
        )
        await registerSpeech(tx, { [set.targetLang]: phrase.target, ...phrase.translations }, now)
      }
    }
    await tx.query('DELETE FROM library_bank_themes')
    for (const [position, theme] of V2_CONTENT.bank.themes.entries()) {
      await tx.query('INSERT INTO library_bank_themes(id, position, doc) VALUES ($1,$2,$3)', [
        theme.id,
        position,
        JSON.stringify(theme),
      ])
    }
    await tx.query('DELETE FROM library_bank')
    for (const [position, phrase] of V2_CONTENT.bank.phrases.entries()) {
      await tx.query(
        'INSERT INTO library_bank(id, target_lang, position, doc, note_translations) VALUES ($1,$2,$3,$4,$5)',
        [
          phrase.id,
          phrase.targetLang,
          position,
          JSON.stringify(phrase),
          JSON.stringify(noteTranslationsOf(phrase.id, V2_CONTENT.bankNoteTranslations)),
        ],
      )
    }
    // Suggested and added from the bank, a bank phrase is played like any other (plan 108).
    await registerSpeechMany(
      tx,
      V2_CONTENT.bank.phrases.map((p) => ({ [p.targetLang]: p.target, ...p.translations })),
      now,
    )
  }

  /** One album per course, one song per Loro set, its lyrics the set's phrases, with the demo sound. */
  private async seedAlbums(tx: SqlConnection, now: number): Promise<void> {
    // Titles in the course's language; the app describes Loro's albums in the learner's own.
    const albums: { lang: Language; title: string }[] = [
      { lang: 'es-ES', title: 'Canciones de Loro' },
      { lang: 'bg-BG', title: 'Песни на Лоро' },
    ]
    await tx.query(
      "DELETE FROM library_songs WHERE album_id IN (SELECT id FROM library_albums WHERE origin = 'loro')",
    )
    for (const [position, album] of albums.entries()) {
      const id = `album-loro-${album.lang.slice(0, 2)}`
      // Covers are served as immutable: a redrawn one (a new seed revision) needs a new address.
      const coverId = `cover-loro-${album.lang.slice(0, 2)}-r${SEED_REVISION}`
      await tx.query(
        `INSERT INTO library_covers(id, owner_id, provider, svg, created_at) VALUES ($1, NULL, 'pattern', $2, $3)
         ON CONFLICT (id) DO UPDATE SET svg = EXCLUDED.svg`,
        [coverId, renderCover(patternCover(album.title)), now],
      )
      await tx.query(
        `INSERT INTO library_albums(id, owner_id, target_lang, title, description, cover_id, visibility, share_code, origin, position, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, $5, 'public', $6, 'loro', $7, $8, $8)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, cover_id = EXCLUDED.cover_id,
           updated_at = EXCLUDED.updated_at`,
        [id, album.lang, album.title, null, coverId, shareCodeFor(id), position, now],
      )
      const sets = V2_CONTENT.sets.filter((s) => s.targetLang === album.lang)
      for (const [index, set] of sets.entries()) {
        const phrases = set.phraseIds.flatMap((pid) =>
          V2_CONTENT.phrases.filter((p) => p.id === pid),
        )
        const songPhrases = phrases.map((p) => ({
          id: p.id,
          target: p.target,
          native: p.translations['en-GB'] ?? '',
        }))
        const style = MUSIC_STYLE_IDS[index % MUSIC_STYLE_IDS.length] ?? 'acoustic_folk'
        const sections = firstLines(assembleLyrics(songPhrases), demoLineLimit(style))
        const lineCount = sections.reduce((n, s) => n + s.lines.length, 0)
        const demo = synthesizeDemo(style, lineCount, set.id)
        const audioId = await this.storeAudio(tx, demo.wav, 'audio/wav')
        await tx.query(
          `INSERT INTO library_songs(id, album_id, owner_id, set_id, position, title, style_id, status, lyrics, lyrics_by, audio_id,
             audio_by, duration_ms, error, created_at)
           VALUES ($1,$2,NULL,$3,$4,$5,$6,'ready',$7,'phrases',$8,'demo',$9,NULL,$10)`,
          [
            `song-loro-${set.id.slice(4)}`,
            id,
            set.id,
            index,
            set.title,
            style,
            JSON.stringify(timed(sections, demo.lines)),
            audioId,
            demo.durationMs,
            now,
          ],
        )
      }
    }
    // Loro's covers from earlier revisions, which nothing wears any more.
    await tx.query(
      `DELETE FROM library_covers c WHERE c.id LIKE 'cover-loro-%'
         AND NOT EXISTS (SELECT 1 FROM library_albums a WHERE a.cover_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM library_sets s WHERE s.cover_id = c.id)`,
    )
  }

  private async storeAudio(
    tx: SqlConnection,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<string> {
    const id = createHash('sha256').update(bytes).digest('hex')
    await tx.query(
      'INSERT INTO library_audio(id, content_type, byte_length, body) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',
      [id, contentType, bytes.byteLength, Buffer.from(bytes)],
    )
    return id
  }

  // ---------- reading ----------

  /**
   * The reader's own items that enough reports took out of Community. Only the owner is told, so
   * they know why it no longer shows there; reporters and other readers never see the count.
   */
  private async hiddenOf(userId: string | null): Promise<Set<string>> {
    if (!userId) return new Set()
    const rows = await this.db.query<{ item_id: string }>(
      `SELECT r.item_id FROM library_reports r
       LEFT JOIN library_sets s ON r.kind = 'set' AND s.id = r.item_id
       LEFT JOIN library_albums a ON r.kind = 'album' AND a.id = r.item_id
       WHERE COALESCE(s.owner_id, a.owner_id) = $1
       GROUP BY r.item_id HAVING count(*) >= ${REPORTS_TO_HIDE}`,
      [userId],
    )
    return new Set(rows.rows.map((r) => r.item_id))
  }

  /**
   * The languages the app offers (plan 108): which a course teaches, which the app speaks. From the
   * content, not the database, so it answers before the library is seeded.
   */
  languages(): LanguagesWire {
    return LANGUAGES
  }

  /** A course's pack: Loro's sets, the reader's own and saved ones, the bank, and the albums. */
  async pack(userId: string | null, target: unknown): Promise<PackWire> {
    await this.ready()
    const targetLang = parseContract(LibraryCourseSchema, target)
    const tts = readTtsRuntimeConfig()
    const topics = (
      await this.db.query<{ doc: V2Topic }>('SELECT doc FROM library_topics ORDER BY position')
    ).rows.map((r) => r.doc)
    const setRows = (
      await this.db.query<SetRow>(
        `${SET_SELECT} WHERE s.target_lang = $1 AND (s.origin = 'loro' OR s.owner_id = $2
           OR s.id IN (SELECT item_id FROM library_saves WHERE user_id = $2 AND kind = 'set'))
         ORDER BY s.origin DESC, s.position, s.created_at`,
        [targetLang, userId ?? ''],
      )
    ).rows.filter((row) => canRead(row, userId))
    const saved = await this.savedIds(userId, 'set')
    const phrases = await this.phrasesOf(setRows.map((s) => s.id))
    const hidden = await this.hiddenOf(userId)
    const sets = setRows.map((row) => markHidden(toSetWire(row, userId, saved, phrases), hidden))
    const themes = (
      await this.db.query<{ doc: BankThemeWire }>(
        'SELECT doc FROM library_bank_themes ORDER BY position',
      )
    ).rows.map((r) => r.doc)
    const bank = (
      await this.db.query<{
        doc: Omit<BankPhraseWire, 'noteTranslations'>
        note_translations: NoteTranslations
      }>(
        'SELECT doc, note_translations FROM library_bank WHERE target_lang = $1 ORDER BY position',
        [targetLang],
      )
    ).rows.map((r) => {
      const audio = speechFor(tts, { [r.doc.targetLang]: r.doc.target, ...r.doc.translations })
      return {
        ...r.doc,
        ...(Object.keys(audio).length > 0 ? { audio } : {}),
        noteTranslations: r.note_translations,
      }
    })
    const albumRows = (
      await this.db.query<AlbumRow>(
        `${ALBUM_SELECT} WHERE a.target_lang = $1 AND (a.origin = 'loro' OR a.owner_id = $2
           OR a.id IN (SELECT item_id FROM library_saves WHERE user_id = $2 AND kind = 'album'))
         ORDER BY a.origin DESC, a.position, a.created_at DESC`,
        [targetLang, userId ?? ''],
      )
    ).rows.filter((row) => canRead(row, userId))
    const savedAlbums = await this.savedIds(userId, 'album')
    const albums = albumRows.map((row) => markHidden(toAlbumWire(row, userId, savedAlbums), hidden))
    const body = {
      targetLang,
      topics,
      sets,
      phrases: uniquePhrases(phrases).map((p) => toPhraseWire(p, tts)),
      bank: { themes, phrases: bank },
      albums,
      covers: await this.itemCoversOf(userId, targetLang),
    }
    return {
      version: createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16),
      ...body,
    }
  }

  /**
   * The reader's own covers of a course's phrases and songs, wherever those are. Kept by id, so they
   * outlast a reseed of Loro's content; one whose phrase or song is gone is not served.
   */
  private async itemCoversOf(
    userId: string | null,
    targetLang: Language,
  ): Promise<PackWire['covers']> {
    const covers: PackWire['covers'] = { phrases: {}, songs: {} }
    if (!userId) return covers
    const rows = await this.db.query<{
      kind: 'phrase' | 'song'
      item_id: string
      cover_id: string
    }>(
      `SELECT c.kind, c.item_id, c.cover_id FROM library_item_covers c WHERE c.user_id = $1 AND (
         (c.kind = 'phrase' AND EXISTS (SELECT 1 FROM library_phrases p JOIN library_sets s ON s.id = p.set_id
           WHERE p.id = c.item_id AND s.target_lang = $2))
         OR (c.kind = 'song' AND EXISTS (SELECT 1 FROM library_songs so JOIN library_albums a ON a.id = so.album_id
           WHERE so.id = c.item_id AND a.target_lang = $2)))
       ORDER BY c.kind, c.item_id`,
      [userId, targetLang],
    )
    for (const row of rows.rows)
      covers[row.kind === 'phrase' ? 'phrases' : 'songs'][row.item_id] =
        `/library/covers/${row.cover_id}.svg`
    return covers
  }

  /** Public sets or albums of a course, newest first, optionally matching a search. */
  async community(
    userId: string | null,
    query: { target?: unknown; kind?: unknown; q?: unknown; sort?: unknown },
  ) {
    await this.ready()
    const targetLang = parseContract(LibraryCourseSchema, query.target)
    const kind = parseContract(z.enum(['sets', 'albums']), query.kind ?? 'sets')
    // Newest first, or the most saved first (ties newest first). A maker's own save doesn't count.
    const sort = parseContract(z.enum(['new', 'popular']), query.sort ?? 'new')
    const savesOf = (alias: string, itemKind: 'set' | 'album') =>
      `(SELECT count(*) FROM library_saves sv WHERE sv.kind = '${itemKind}' AND sv.item_id = ${alias}.id
         AND sv.user_id IS DISTINCT FROM ${alias}.owner_id)`
    const q = typeof query.q === 'string' ? query.q.trim().slice(0, 60) : ''
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    if (kind === 'sets') {
      const rows = (
        await this.db.query<SetRow>(
          `${SET_SELECT} WHERE s.target_lang = $1 AND s.origin = 'user' AND s.visibility = 'public'
             AND (SELECT count(*) FROM library_reports r WHERE r.kind = 'set' AND r.item_id = s.id) < ${REPORTS_TO_HIDE}
             AND ($2 = '' OR s.title ILIKE $3 OR coalesce(s.description, '') ILIKE $3)
           ORDER BY ${sort === 'popular' ? `${savesOf('s', 'set')} DESC, ` : ''}s.updated_at DESC LIMIT ${COMMUNITY_PAGE}`,
          [targetLang, q, like],
        )
      ).rows
      const saved = await this.savedIds(userId, 'set')
      const phrases = await this.phrasesOf(rows.map((r) => r.id))
      const savedBy = await this.savedBy(
        'set',
        rows.map((r) => r.id),
      )
      return {
        sets: rows.map((row) => ({
          ...toSetWire(row, userId, saved, phrases),
          savedBy: savedBy.get(row.id) ?? 0,
        })),
        phrases: uniquePhrases(phrases).map((p) => toPhraseWire(p, readTtsRuntimeConfig())),
      }
    }
    const rows = (
      await this.db.query<AlbumRow>(
        `${ALBUM_SELECT} WHERE a.target_lang = $1 AND a.origin = 'user' AND a.visibility = 'public'
           AND (SELECT count(*) FROM library_reports r WHERE r.kind = 'album' AND r.item_id = a.id) < ${REPORTS_TO_HIDE}
           AND ($2 = '' OR a.title ILIKE $3 OR coalesce(a.description, '') ILIKE $3)
           AND EXISTS (SELECT 1 FROM library_songs so WHERE so.album_id = a.id AND so.status = 'ready')
         ORDER BY ${sort === 'popular' ? `${savesOf('a', 'album')} DESC, ` : ''}a.updated_at DESC LIMIT ${COMMUNITY_PAGE}`,
        [targetLang, q, like],
      )
    ).rows
    const saved = await this.savedIds(userId, 'album')
    const savedBy = await this.savedBy(
      'album',
      rows.map((r) => r.id),
    )
    return {
      albums: rows.map((row) => ({
        ...toAlbumWire(row, userId, saved),
        savedBy: savedBy.get(row.id) ?? 0,
      })),
    }
  }

  async set(userId: string | null, id: unknown): Promise<{ set: SetWire; phrases: PhraseWire[] }> {
    await this.ready()
    const row = await this.readableSet(userId, parseContract(LibraryIdSchema, id))
    const phrases = await this.phrasesOf([row.id])
    return {
      set: toSetWire(row, userId, await this.savedIds(userId, 'set'), phrases),
      phrases: uniquePhrases(phrases).map((p) => toPhraseWire(p, readTtsRuntimeConfig())),
    }
  }

  async album(
    userId: string | null,
    id: unknown,
  ): Promise<{ album: AlbumWire; songs: SongWire[] }> {
    await this.ready()
    const row = await this.readableAlbum(userId, parseContract(LibraryIdSchema, id))
    return {
      album: toAlbumWire(row, userId, await this.savedIds(userId, 'album')),
      songs: await this.songsOf(row.id),
    }
  }

  /** What a share code opens: a set with its phrases, or an album with its songs. */
  async shared(userId: string | null, code: unknown) {
    await this.ready()
    const shareCode = parseContract(ShareCodeSchema, code)
    const set = (
      await this.db.query<{ id: string }>('SELECT id FROM library_sets WHERE share_code = $1', [
        shareCode,
      ])
    ).rows[0]
    if (set) return { kind: 'set' as const, ...(await this.set(userId, set.id)) }
    const album = (
      await this.db.query<{ id: string }>('SELECT id FROM library_albums WHERE share_code = $1', [
        shareCode,
      ])
    ).rows[0]
    if (album) return { kind: 'album' as const, ...(await this.album(userId, album.id)) }
    throw new LoroError('NOT_FOUND')
  }

  /**
   * Songs sung from a set, in albums the reader can see: Loro's first, then the newest. What the
   * reader may hear is decided before the page is cut, and an album reports took out of Community
   * stays out of here too, except for its owner.
   */
  async songsOfSet(
    userId: string | null,
    id: unknown,
  ): Promise<{ songs: SongWire[]; albums: AlbumWire[] }> {
    await this.ready()
    const set = await this.readableSet(userId, parseContract(LibraryIdSchema, id))
    const rows = (
      await this.db.query<SongRow>(
        `SELECT so.* FROM library_songs so JOIN library_albums a ON a.id = so.album_id
         WHERE so.set_id = $1 AND so.status = 'ready'
           AND (a.origin = 'loro' OR a.owner_id = $2 OR (a.visibility <> 'private'
             AND (SELECT count(*) FROM library_reports r WHERE r.kind = 'album' AND r.item_id = a.id) < ${REPORTS_TO_HIDE}))
         ORDER BY (a.origin = 'loro') DESC, so.created_at DESC LIMIT 20`,
        [set.id, userId ?? ''],
      )
    ).rows
    const saved = await this.savedIds(userId, 'album')
    const albumIds = [...new Set(rows.map((row) => row.album_id))]
    const albums = albumIds.length
      ? (
          await this.db.query<AlbumRow>(`${ALBUM_SELECT} WHERE a.id = ANY($1::text[])`, [albumIds])
        ).rows.map((row) => toAlbumWire(row, userId, saved))
      : []
    return { songs: rows.map((row) => this.toSongWire(row)), albums }
  }

  /**
   * The other public sets of a shared set's maker, in its course: what Community would list of
   * theirs. Nothing for Loro's sets.
   */
  async moreSetsByMaker(
    userId: string | null,
    id: unknown,
  ): Promise<{ sets: SetWire[]; phrases: PhraseWire[] }> {
    await this.ready()
    const set = await this.readableSet(userId, parseContract(LibraryIdSchema, id))
    if (set.origin !== 'user' || !set.owner_id) return { sets: [], phrases: [] }
    const rows = (
      await this.db.query<SetRow>(
        `${SET_SELECT} WHERE s.owner_id = $1 AND s.target_lang = $2 AND s.id <> $3
           AND s.origin = 'user' AND s.visibility = 'public'
           AND (SELECT count(*) FROM library_reports r WHERE r.kind = 'set' AND r.item_id = s.id) < ${REPORTS_TO_HIDE}
         ORDER BY s.updated_at DESC LIMIT ${MORE_BY_MAKER}`,
        [set.owner_id, set.target_lang, set.id],
      )
    ).rows
    const saved = await this.savedIds(userId, 'set')
    const phrases = await this.phrasesOf(rows.map((r) => r.id))
    return {
      sets: rows.map((row) => toSetWire(row, userId, saved, phrases)),
      phrases: uniquePhrases(phrases).map((p) => toPhraseWire(p, readTtsRuntimeConfig())),
    }
  }

  /** The other public albums (with a song to hear) of a shared album's maker, in its course. */
  async moreAlbumsByMaker(userId: string | null, id: unknown): Promise<{ albums: AlbumWire[] }> {
    await this.ready()
    const album = await this.readableAlbum(userId, parseContract(LibraryIdSchema, id))
    if (album.origin !== 'user' || !album.owner_id) return { albums: [] }
    const rows = (
      await this.db.query<AlbumRow>(
        `${ALBUM_SELECT} WHERE a.owner_id = $1 AND a.target_lang = $2 AND a.id <> $3
           AND a.origin = 'user' AND a.visibility = 'public'
           AND (SELECT count(*) FROM library_reports r WHERE r.kind = 'album' AND r.item_id = a.id) < ${REPORTS_TO_HIDE}
           AND EXISTS (SELECT 1 FROM library_songs so WHERE so.album_id = a.id AND so.status = 'ready')
         ORDER BY a.updated_at DESC LIMIT ${MORE_BY_MAKER}`,
        [album.owner_id, album.target_lang, album.id],
      )
    ).rows
    const saved = await this.savedIds(userId, 'album')
    return { albums: rows.map((row) => toAlbumWire(row, userId, saved)) }
  }

  async song(userId: string | null, id: unknown): Promise<SongWire> {
    const row = (
      await this.db.query<SongRow>('SELECT * FROM library_songs WHERE id = $1', [
        parseContract(LibraryIdSchema, id),
      ])
    ).rows[0]
    if (!row) throw new LoroError('NOT_FOUND')
    await this.readableAlbum(userId, row.album_id)
    return this.toSongWire(row)
  }

  /**
   * A song's sound, for a reader who may see its album or anyone holding the signed URL the song
   * came with (an audio element cannot send a bearer).
   */
  async songAudio(
    userId: string | null,
    id: unknown,
    signature: { exp?: unknown; sig?: unknown } = {},
  ): Promise<{ bytes: Buffer; contentType: string }> {
    const song = (
      await this.db.query<SongRow>('SELECT * FROM library_songs WHERE id = $1', [
        parseContract(LibraryIdSchema, id),
      ])
    ).rows[0]
    if (!song?.audio_id) throw new LoroError('NOT_FOUND')
    if (!validAudioSignature(song.id, signature, this.clock.now()))
      await this.readableAlbum(userId, song.album_id)
    const audio = (
      await this.db.query<{ body: Buffer; content_type: string }>(
        'SELECT body, content_type FROM library_audio WHERE id = $1',
        [song.audio_id],
      )
    ).rows[0]
    if (!audio) throw new LoroError('NOT_FOUND')
    return { bytes: audio.body, contentType: audio.content_type }
  }

  async cover(id: unknown): Promise<string> {
    const coverId = parseContract(
      LibraryIdSchema,
      typeof id === 'string' ? id.replace(/\.svg$/, '') : id,
    )
    const row = (
      await this.db.query<{ svg: string }>('SELECT svg FROM library_covers WHERE id = $1', [
        coverId,
      ])
    ).rows[0]
    if (!row) throw new LoroError('NOT_FOUND')
    return row.svg
  }

  // ---------- writing: sets ----------

  async createSet(userId: string, body: unknown): Promise<{ set: SetWire; phrases: PhraseWire[] }> {
    await this.ready()
    const input = parseContract(CreateSetSchema, body)
    // A set uploaded from a device again (a sign-in cut short) is the one already uploaded.
    if (input.id) {
      const held = (
        await this.db.query<{ owner_id: string | null }>(
          'SELECT owner_id FROM library_sets WHERE id = $1',
          [input.id],
        )
      ).rows[0]
      if (held?.owner_id === userId) return this.set(userId, input.id)
    }
    await this.assertKept(userId, 'sets')
    if (input.coverId) await this.assertOwnCover(userId, input.coverId)
    const id = input.id && !(await this.setExists(input.id)) ? input.id : newId('set-u')
    const topics = (await this.db.query<{ id: string }>('SELECT id FROM library_topics')).rows.map(
      (r) => r.id,
    )
    const topicId =
      input.topicId && topics.includes(input.topicId)
        ? input.topicId
        : ((topics.includes('everyday') ? 'everyday' : topics[0]) ?? 'everyday')
    const firstIcon = input.phrases.flatMap((item) => ('ref' in item ? [] : (item.image ?? [])))[0]
    await this.db.transaction(async (tx) => {
      await this.insertSet(tx, {
        id,
        userId,
        targetLang: input.targetLang,
        nativeLang: input.nativeLang,
        title: input.title,
        description: blankToNull(input.description),
        topicId,
        level: input.level,
        coverIcon: input.coverIcon ?? firstIcon ?? 'queue_music',
        coverId: input.coverId ?? null,
        visibility: input.visibility,
        inbox: false,
      })
      await this.insertItems(tx, id, input.targetLang, input.nativeLang, input.phrases, 0, userId)
    })
    return this.set(userId, id)
  }

  private async setExists(id: string): Promise<boolean> {
    return (await this.db.query('SELECT 1 FROM library_sets WHERE id = $1', [id])).rows.length > 0
  }

  private async insertSet(
    tx: SqlConnection,
    set: {
      id: string
      userId: string
      targetLang: Language
      nativeLang: Language
      title: string
      description: string | null
      topicId: string
      level: 'A1' | 'A2' | 'B1'
      coverIcon: string
      coverId: string | null
      visibility: Visibility
      inbox: boolean
    },
  ): Promise<void> {
    const now = this.clock.now()
    await tx.query(
      `INSERT INTO library_sets(id, owner_id, target_lang, native_lang, title, subtitle, description, topic_id, level, cover_icon,
         cover_id, visibility, share_code, origin, position, created_at, updated_at, inbox)
       VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,$8,$9,$10,$11,$12,'user',0,$13,$13,$14)`,
      [
        set.id,
        set.userId,
        set.targetLang,
        set.nativeLang,
        set.title,
        set.description,
        set.topicId,
        set.level,
        set.coverIcon,
        set.coverId,
        set.visibility,
        newShareCode(),
        now,
        set.inbox,
      ],
    )
  }

  async updateSet(
    userId: string,
    id: unknown,
    body: unknown,
  ): Promise<{ set: SetWire; phrases: PhraseWire[] }> {
    await this.ready()
    const row = await this.ownSet(userId, parseContract(LibraryIdSchema, id))
    const input = parseContract(UpdateSetSchema, body)
    if (input.coverId) await this.assertOwnCover(userId, input.coverId)
    await this.db.transaction(async (tx) => {
      if (input.removePhraseIds?.length) await this.removeItems(tx, row.id, input.removePhraseIds)
      if (input.addPhrases?.length) await this.appendItems(tx, row, input.addPhrases, userId)
      if (input.order?.length) {
        for (const [position, phraseId] of input.order.entries()) {
          await tx.query('UPDATE library_phrases SET position = $3 WHERE set_id = $1 AND id = $2', [
            row.id,
            phraseId,
            position,
          ])
          await tx.query(
            'UPDATE library_set_refs SET position = $3 WHERE set_id = $1 AND phrase_id = $2',
            [row.id, phraseId, position],
          )
        }
      }
      await tx.query(
        `UPDATE library_sets SET title = coalesce($2, title), description = CASE WHEN $3 THEN $4 ELSE description END,
           level = coalesce($5, level), visibility = coalesce($6, visibility),
           cover_id = CASE WHEN $7 THEN $8 ELSE cover_id END, updated_at = $9 WHERE id = $1`,
        [
          row.id,
          input.title ?? null,
          input.description !== undefined,
          blankToNull(input.description),
          input.level ?? null,
          input.visibility ?? null,
          input.coverId !== undefined,
          input.coverId ?? null,
          this.clock.now(),
        ],
      )
    })
    return this.set(userId, row.id)
  }

  /** Items added at the end of a learner's set, which then holds at most 40. */
  private async appendItems(
    tx: SqlConnection,
    row: SetRow,
    items: SetItem[],
    userId: string,
  ): Promise<void> {
    // One change to a set at a time: two phrases added at once would take the same position and id.
    await tx.query('SELECT 1 FROM library_sets WHERE id = $1 FOR UPDATE', [row.id])
    const last = await tx.query<{ max: number | null }>(
      `SELECT GREATEST((SELECT max(position) FROM library_phrases WHERE set_id = $1),
         (SELECT max(position) FROM library_set_refs WHERE set_id = $1)) AS max`,
      [row.id],
    )
    await this.insertItems(
      tx,
      row.id,
      row.target_lang,
      row.native_lang ?? 'en-GB',
      items,
      (last.rows[0]?.max ?? -1) + 1,
      userId,
    )
    const count = await tx.query<{ n: string }>(
      `SELECT (SELECT count(*) FROM library_phrases WHERE set_id = $1)
         + (SELECT count(*) FROM library_set_refs WHERE set_id = $1) AS n`,
      [row.id],
    )
    if (num(count.rows[0]?.n) > MAX_SET_PHRASES)
      throw new LoroError('VALIDATION_FAILED', `A set holds at most ${MAX_SET_PHRASES} phrases`)
  }

  /**
   * Takes phrases out of a set. A phrase the set holds that another of the learner's sets lists moves
   * there, so it keeps its progress; otherwise it is gone.
   */
  private async removeItems(tx: SqlConnection, setId: string, phraseIds: string[]): Promise<void> {
    await tx.query(
      'DELETE FROM library_set_refs WHERE set_id = $1 AND phrase_id = ANY($2::text[])',
      [setId, phraseIds],
    )
    const held = await tx.query<{ id: string }>(
      'SELECT id FROM library_phrases WHERE set_id = $1 AND id = ANY($2::text[])',
      [setId, phraseIds],
    )
    for (const { id } of held.rows) {
      const elsewhere = (
        await tx.query<{ set_id: string; position: number }>(
          'SELECT set_id, position FROM library_set_refs WHERE phrase_id = $1 ORDER BY set_id LIMIT 1',
          [id],
        )
      ).rows[0]
      if (elsewhere) {
        await tx.query('UPDATE library_phrases SET set_id = $2, position = $3 WHERE id = $1', [
          id,
          elsewhere.set_id,
          elsewhere.position,
        ])
        await tx.query('DELETE FROM library_set_refs WHERE set_id = $1 AND phrase_id = $2', [
          elsewhere.set_id,
          id,
        ])
      } else {
        await tx.query('DELETE FROM library_phrases WHERE id = $1', [id])
      }
    }
  }

  async deleteSet(userId: string, id: unknown): Promise<void> {
    const row = await this.ownSet(userId, parseContract(LibraryIdSchema, id))
    await this.db.transaction(async (tx) => {
      const held = await tx.query<{ id: string }>(
        'SELECT id FROM library_phrases WHERE set_id = $1',
        [row.id],
      )
      await this.removeItems(
        tx,
        row.id,
        held.rows.map((r) => r.id),
      )
      await tx.query('DELETE FROM library_set_refs WHERE set_id = $1', [row.id])
      await tx.query("DELETE FROM library_saves WHERE kind = 'set' AND item_id = $1", [row.id])
      await tx.query('DELETE FROM library_sets WHERE id = $1', [row.id])
    })
  }

  /**
   * A phrase the learner adds on its own (plan 108): into one of their sets, or into their "My
   * phrases" set for the course, made now if they have none.
   */
  async addPhrase(userId: string, body: unknown): Promise<{ set: SetWire; phrases: PhraseWire[] }> {
    await this.ready()
    const input = parseContract(AddPhraseSchema, body)
    const setId = input.setId ?? (await this.inboxOf(userId, input))
    const row = await this.ownSet(userId, setId)
    if (row.target_lang !== input.targetLang)
      throw new LoroError('VALIDATION_FAILED', 'That set is in another course')
    await this.db.transaction(async (tx) => {
      await this.appendItems(tx, row, [input.phrase], userId)
      await tx.query('UPDATE library_sets SET updated_at = $2 WHERE id = $1', [
        row.id,
        this.clock.now(),
      ])
    })
    return this.set(userId, row.id)
  }

  /** The learner's "My phrases" set for a course, made the first time. */
  private async inboxOf(
    userId: string,
    input: { targetLang: Language; nativeLang: Language; inboxTitle: string },
  ): Promise<string> {
    const find = async () =>
      (
        await this.db.query<{ id: string }>(
          'SELECT id FROM library_sets WHERE owner_id = $1 AND target_lang = $2 AND inbox',
          [userId, input.targetLang],
        )
      ).rows[0]?.id
    const found = await find()
    if (found) return found
    // It is one of the learner's kept sets: at the cap, a phrase goes into a set they have.
    await this.assertKept(userId, 'sets')
    await this.db.transaction(async (tx) => {
      // Two phrases added at once make one set: the second waits, then finds the first's.
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`inbox:${userId}`])
      const again = await tx.query(
        'SELECT 1 FROM library_sets WHERE owner_id = $1 AND target_lang = $2 AND inbox',
        [userId, input.targetLang],
      )
      if (again.rows.length > 0) return
      await this.insertSet(tx, {
        id: newId('set-u'),
        userId,
        targetLang: input.targetLang,
        nativeLang: input.nativeLang,
        title: input.inboxTitle,
        description: null,
        topicId: 'everyday',
        level: 'A2',
        coverIcon: 'edit_note',
        coverId: null,
        visibility: 'private',
        inbox: true,
      })
    })
    const made = await find()
    if (!made) throw new LoroError('INTERNAL', 'The phrases set was not made')
    return made
  }

  /** New words for a phrase the learner holds; its notes and picture are written again unless sent. */
  async editPhrase(
    userId: string,
    setId: unknown,
    phraseId: unknown,
    body: unknown,
  ): Promise<{ set: SetWire; phrases: PhraseWire[] }> {
    await this.ready()
    const row = await this.ownSet(userId, parseContract(LibraryIdSchema, setId))
    const id = parseContract(PhraseIdSchema, phraseId)
    const input = parseContract(EditPhraseSchema, body)
    const phrase = (
      await this.db.query<Pick<PhraseRow, 'doc' | 'source'>>(
        'SELECT doc, source FROM library_phrases WHERE id = $1 AND set_id = $2',
        [id, row.id],
      )
    ).rows[0]
    if (!phrase) throw new LoroError('NOT_FOUND')
    const nativeLang = row.native_lang ?? 'en-GB'
    const given =
      input.notes && input.image
        ? { notes: input.notes, image: input.image, notesBy: input.notesBy }
        : {
            ...ruleNotes({
              target: input.target,
              native: input.native,
              targetLang: row.target_lang,
              nativeLang,
            }),
            notesBy: 'rules' as const,
          }
    // Stored as JSON, an undefined notesBy leaves none behind: the old one no longer applies.
    const doc = {
      ...phrase.doc,
      target: input.target,
      translations: { ...phrase.doc.translations, [nativeLang]: input.native },
      image: given.image,
      notes: given.notes,
      notesBy: given.notesBy,
    }
    // New words are the learner's own, whatever the phrase first came from.
    const source = input.target === phrase.doc.target ? phrase.source : 'written'
    const now = this.clock.now()
    await this.db.transaction(async (tx) => {
      await tx.query(
        'UPDATE library_phrases SET doc = $2, source = $3, note_translations = $4 WHERE id = $1',
        [id, JSON.stringify(doc), source, JSON.stringify(writtenIn(nativeLang, given.notes))],
      )
      await registerSpeech(
        tx,
        { [row.target_lang]: input.target, [nativeLang]: input.native },
        now,
        userId,
      )
      await tx.query('UPDATE library_sets SET updated_at = $2 WHERE id = $1', [row.id, now])
    })
    return this.set(userId, row.id)
  }

  /** Deletes a phrase the learner holds, and every listing of it in their sets (plan 108). */
  async deletePhrase(userId: string, phraseId: unknown): Promise<void> {
    await this.ready()
    const id = parseContract(PhraseIdSchema, phraseId)
    await this.db.transaction(async (tx) => {
      const holder = await this.holderOf(tx, id)
      if (holder?.owner_id !== userId) throw new LoroError('NOT_FOUND')
      await tx.query('DELETE FROM library_set_refs WHERE phrase_id = $1', [id])
      await tx.query('DELETE FROM library_phrases WHERE id = $1', [id])
      await tx.query('UPDATE library_sets SET updated_at = $2 WHERE id = $1', [
        holder.set_id,
        this.clock.now(),
      ])
    })
  }

  /** Where a phrase is held, and whose it is. */
  private async holderOf(
    tx: SqlConnection,
    phraseId: string,
  ): Promise<
    | { set_id: string; owner_id: string | null; target_lang: Language; origin: 'loro' | 'user' }
    | undefined
  > {
    return (
      await tx.query<{
        set_id: string
        owner_id: string | null
        target_lang: Language
        origin: 'loro' | 'user'
      }>(
        `SELECT p.set_id, s.owner_id, s.target_lang, s.origin FROM library_phrases p
           JOIN library_sets s ON s.id = p.set_id WHERE p.id = $1`,
        [phraseId],
      )
    ).rows[0]
  }

  /**
   * Puts items into a learner's set from position `from` on (plan 108). A reference lists one of
   * Loro's phrases or one of the learner's own in the course. A new phrase is held by the set; one
   * uploaded from a device keeps the device's id where it is free, and one already uploaded is
   * listed rather than held twice.
   */
  private async insertItems(
    tx: SqlConnection,
    setId: string,
    targetLang: Language,
    nativeLang: Language,
    items: SetItem[],
    from: number,
    ownerId: string,
  ): Promise<void> {
    const stem = setId.replace(/^set-u-/, 'u').replace(/^mine-s-/, 'u')
    const existing = await tx.query<{ id: string }>(
      'SELECT id FROM library_phrases WHERE set_id = $1',
      [setId],
    )
    const taken = new Set(existing.rows.map((r) => r.id))
    let serial = 1
    for (const [index, item] of items.entries()) {
      const position = from + index
      const known = 'ref' in item ? item.ref : item.id
      const holder = known ? await this.holderOf(tx, known) : undefined
      const listable =
        holder?.target_lang === targetLang &&
        (holder.origin === 'loro' || holder.owner_id === ownerId)
      if ('ref' in item || (known && listable)) {
        if (!known || !listable) throw new LoroError('VALIDATION_FAILED', 'Unknown phrase')
        if (holder.set_id !== setId)
          await tx.query(
            `INSERT INTO library_set_refs(set_id, phrase_id, position) VALUES ($1,$2,$3)
             ON CONFLICT (set_id, phrase_id) DO NOTHING`,
            [setId, known, position],
          )
        continue
      }
      const phrase = item
      let id = phrase.id && !holder ? phrase.id : ''
      if (!id) {
        while (taken.has(`${stem}-${String(serial).padStart(2, '0')}`)) serial += 1
        id = `${stem}-${String(serial).padStart(2, '0')}`
      }
      taken.add(id)
      const bank =
        phrase.source === 'bank' && phrase.bankId
          ? V2_CONTENT.bank.phrases.find((b) => b.id === phrase.bankId)
          : undefined
      // A bank phrase keeps the bank's notes (English, with every translation); anything else keeps
      // what came with it, written in the learner's language, or has them written by the rules.
      const given =
        phrase.notes && phrase.image
          ? { notes: phrase.notes, image: phrase.image, notesBy: phrase.notesBy }
          : {
              ...ruleNotes({
                target: phrase.target,
                native: phrase.native,
                targetLang,
                nativeLang,
              }),
              notesBy: 'rules' as const,
            }
      const notes: LibraryNotes = bank ? bank.notes : given.notes
      const noteTranslations = bank
        ? noteTranslationsOf(bank.id, V2_CONTENT.bankNoteTranslations)
        : writtenIn(nativeLang, given.notes)
      const doc = {
        target: phrase.target,
        translations: { [nativeLang]: phrase.native },
        register: 'neutral',
        region: '',
        tags: [],
        image: bank ? bank.image : given.image,
        words: {},
        notes,
        ...(!bank && given.notesBy ? { notesBy: given.notesBy } : {}),
      }
      await tx.query(
        'INSERT INTO library_phrases(id, set_id, position, source, doc, note_translations) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, setId, position, phrase.source, JSON.stringify(doc), JSON.stringify(noteTranslations)],
      )
      await registerSpeech(
        tx,
        { [targetLang]: phrase.target, [nativeLang]: phrase.native },
        this.clock.now(),
        ownerId,
      )
    }
  }

  // ---------- writing: albums, saves, profile ----------

  async createAlbum(
    userId: string,
    body: unknown,
  ): Promise<{ album: AlbumWire; songs: SongWire[] }> {
    await this.ready()
    const input = parseContract(CreateAlbumSchema, body)
    if (input.coverId) await this.assertOwnCover(userId, input.coverId)
    const id = await this.insertAlbum(userId, input)
    return this.album(userId, id)
  }

  private async insertAlbum(
    userId: string,
    input: {
      title: string
      description?: string | undefined
      targetLang: Language
      coverId?: string | undefined
      visibility: Visibility
    },
  ): Promise<string> {
    await this.assertKept(userId, 'albums')
    const id = newId('album-u')
    const now = this.clock.now()
    await this.db.query(
      `INSERT INTO library_albums(id, owner_id, target_lang, title, description, cover_id, visibility, share_code, origin, position, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'user',0,$9,$9)`,
      [
        id,
        userId,
        input.targetLang,
        input.title,
        blankToNull(input.description),
        input.coverId ?? null,
        input.visibility,
        newShareCode(),
        now,
      ],
    )
    return id
  }

  async updateAlbum(
    userId: string,
    id: unknown,
    body: unknown,
  ): Promise<{ album: AlbumWire; songs: SongWire[] }> {
    const row = await this.ownAlbum(userId, parseContract(LibraryIdSchema, id))
    const input = parseContract(UpdateAlbumSchema, body)
    if (input.coverId) await this.assertOwnCover(userId, input.coverId)
    await this.db.transaction(async (tx) => {
      if (input.removeSongIds?.length) {
        await tx.query('DELETE FROM library_songs WHERE album_id = $1 AND id = ANY($2::text[])', [
          row.id,
          input.removeSongIds,
        ])
        await forgetUnusedAudio(tx)
      }
      await tx.query(
        `UPDATE library_albums SET title = coalesce($2, title), description = CASE WHEN $3 THEN $4 ELSE description END,
           visibility = coalesce($5, visibility), cover_id = CASE WHEN $6 THEN $7 ELSE cover_id END, updated_at = $8 WHERE id = $1`,
        [
          row.id,
          input.title ?? null,
          input.description !== undefined,
          blankToNull(input.description),
          input.visibility ?? null,
          input.coverId !== undefined,
          input.coverId ?? null,
          this.clock.now(),
        ],
      )
    })
    return this.album(userId, row.id)
  }

  async deleteAlbum(userId: string, id: unknown): Promise<void> {
    const row = await this.ownAlbum(userId, parseContract(LibraryIdSchema, id))
    await this.db.transaction(async (tx) => {
      await tx.query('DELETE FROM library_songs WHERE album_id = $1', [row.id])
      await tx.query("DELETE FROM library_saves WHERE kind = 'album' AND item_id = $1", [row.id])
      await tx.query('DELETE FROM library_albums WHERE id = $1', [row.id])
      await forgetUnusedAudio(tx)
    })
  }

  async save(userId: string, body: unknown): Promise<{ saved: true }> {
    await this.ready()
    const input = parseContract(SaveSchema, body)
    if (input.kind === 'set') await this.readableSet(userId, input.id)
    else await this.readableAlbum(userId, input.id)
    await this.db.query(
      'INSERT INTO library_saves(user_id, kind, item_id, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [userId, input.kind, input.id, this.clock.now()],
    )
    return { saved: true }
  }

  async unsave(userId: string, kind: unknown, id: unknown): Promise<void> {
    const input = parseContract(SaveSchema, { kind, id })
    await this.db.query(
      'DELETE FROM library_saves WHERE user_id = $1 AND kind = $2 AND item_id = $3',
      [userId, input.kind, input.id],
    )
  }

  /** One report per learner per item, of something they can see and don't own. */
  async report(userId: string, body: unknown): Promise<{ reported: true }> {
    await this.ready()
    const input = parseContract(ReportSchema, body)
    const row =
      input.kind === 'set'
        ? await this.readableSet(userId, input.id)
        : await this.readableAlbum(userId, input.id)
    if (row.origin === 'loro' || row.owner_id === userId)
      throw new LoroError('VALIDATION_FAILED', 'Nothing to report')
    await this.db.query(
      `INSERT INTO library_reports(user_id, kind, item_id, reason, created_at) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, kind, item_id) DO UPDATE SET reason = EXCLUDED.reason`,
      [userId, input.kind, input.id, input.reason, this.clock.now()],
    )
    return { reported: true }
  }

  /**
   * Everything a learner keeps in the library: their sets, albums, songs, covers, saves, reports,
   * profile and account progress. Clips of their phrases that nothing plays any more go too; others'
   * saves of their shared items are removed with them.
   */
  async deleteEverything(userId: string): Promise<{ deleted: true }> {
    await this.db.transaction(async (tx) => {
      await deleteLibraryOf(tx, userId)
    })
    return { deleted: true }
  }

  /**
   * Deletes the account: everything in the library, the synced rows, the song jobs, and the sign-in
   * itself (identities, devices, sessions and refresh tokens go with the user). Signing up again
   * starts a new account.
   */
  async deleteAccount(userId: string): Promise<{ deleted: true }> {
    await this.db.transaction(async (tx) => {
      await deleteLibraryOf(tx, userId)
      await tx.query('DELETE FROM library_usage WHERE user_id = $1', [userId])
      for (const table of SYNC_TABLES)
        await tx.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId])
      // Only the tracks this learner's jobs made that no one else's job points at: a global sweep
      // could take an object another learner's job is about to point at.
      await tx.query(
        `DELETE FROM music_objects o WHERE o.sha256 IN (SELECT sha256 FROM music_jobs WHERE user_id = $1)
           AND NOT EXISTS (SELECT 1 FROM music_jobs j WHERE j.sha256 = o.sha256 AND j.user_id <> $1)`,
        [userId],
      )
      await tx.query('DELETE FROM music_jobs WHERE user_id = $1', [userId])
      await tx.query('DELETE FROM music_lyric_documents WHERE user_id = $1', [userId])
      await tx.query('DELETE FROM auth_users WHERE id = $1', [userId])
    })
    return { deleted: true }
  }

  async profile(userId: string): Promise<{ displayName: string | null }> {
    const row = (
      await this.db.query<{ display_name: string }>(
        'SELECT display_name FROM library_profiles WHERE user_id = $1',
        [userId],
      )
    ).rows[0]
    return { displayName: row?.display_name ?? null }
  }

  async setProfile(userId: string, body: unknown): Promise<{ displayName: string | null }> {
    const input = parseContract(ProfileSchema, body)
    await this.db.query(
      `INSERT INTO library_profiles(user_id, display_name, updated_at) VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = EXCLUDED.updated_at`,
      [userId, input.displayName, this.clock.now()],
    )
    return { displayName: input.displayName }
  }

  // ---------- usage ----------

  async usage(userId: string): Promise<UsageWire> {
    const now = this.clock.now()
    const day = utcDay(now)
    const used = (
      await this.db.query<{ kind: UsageKind; used: number }>(
        'SELECT kind, used FROM library_usage WHERE user_id = $1 AND day = $2',
        [userId, day],
      )
    ).rows
    const daily = Object.fromEntries(
      (['phrases', 'cover', 'song'] as const).map((kind) => [
        kind,
        {
          used: used.find((u) => u.kind === kind)?.used ?? 0,
          limit: config.libraryDailyLimit(kind),
        },
      ]),
    ) as UsageWire['daily']
    const kept = Object.fromEntries(
      await Promise.all(
        (['sets', 'albums', 'songs'] as const).map(async (kind) => [
          kind,
          { used: await this.keptCount(userId, kind), limit: config.libraryStorageLimit(kind) },
        ]),
      ),
    ) as UsageWire['kept']
    return {
      day,
      resetsAt: Date.parse(`${day}T00:00:00Z`) + DAY_MS,
      daily,
      kept,
      writers: writersInUse(),
    }
  }

  /** Counts one use of today's allowance, or refuses with when it resets. */
  private async spend(userId: string, kind: UsageKind): Promise<void> {
    const limit = config.libraryDailyLimit(kind)
    const now = this.clock.now()
    const day = utcDay(now)
    const resetsAt = Date.parse(`${day}T00:00:00Z`) + DAY_MS
    if (limit <= 0)
      throw new LoroError('LIMIT_REACHED', `${kind} generation is off`, {
        kind,
        limit,
        resets_at: resetsAt,
      })
    const spent = await this.db.query<{ used: number }>(
      `INSERT INTO library_usage(user_id, kind, day, used) VALUES ($1,$2,$3,1)
       ON CONFLICT (user_id, kind, day) DO UPDATE SET used = library_usage.used + 1 WHERE library_usage.used < $4
       RETURNING used`,
      [userId, kind, day, limit],
    )
    if (spent.rows.length === 0)
      throw new LoroError('LIMIT_REACHED', `Daily ${kind} allowance used`, {
        kind,
        limit,
        resets_at: resetsAt,
      })
  }

  /** Gives back one use of a day's allowance (today's unless said), when what it paid for failed. */
  private async refund(
    userId: string,
    kind: UsageKind,
    day = utcDay(this.clock.now()),
  ): Promise<void> {
    await this.db.query(
      'UPDATE library_usage SET used = used - 1 WHERE user_id = $1 AND kind = $2 AND day = $3 AND used > 0',
      [userId, kind, day],
    )
  }

  private async keptCount(userId: string, kind: KeptKind): Promise<number> {
    const table = { sets: 'library_sets', albums: 'library_albums', songs: 'library_songs' }[kind]
    return num(
      (
        await this.db.query<{ n: string }>(
          `SELECT count(*) AS n FROM ${table} WHERE owner_id = $1`,
          [userId],
        )
      ).rows[0]?.n,
    )
  }

  private async assertKept(userId: string, kind: KeptKind): Promise<void> {
    const limit = config.libraryStorageLimit(kind)
    if ((await this.keptCount(userId, kind)) >= limit)
      throw new LoroError('LIMIT_REACHED', `At most ${limit} ${kind}`, {
        kind,
        limit,
        resets_at: null,
      })
  }

  // ---------- generation ----------

  /**
   * A deck of suggestions: Claude's where it writes (from the day's allowance, `429` when it is
   * spent), otherwise the phrase bank's, free, as the app's own copy of the bank would answer.
   * Given `waitMs`, a deck Claude hasn't finished by then is answered `{status: 'writing'}`, and
   * asking again with the same request picks it up.
   */
  async generatePhrases(userId: string, body: unknown): Promise<PhraseDeck>
  async generatePhrases(
    userId: string,
    body: unknown,
    waitMs: number,
  ): Promise<PhraseDeck | StillWriting>
  async generatePhrases(
    userId: string,
    body: unknown,
    waitMs?: number,
  ): Promise<PhraseDeck | StillWriting> {
    const request = parseContract(GeneratePhrasesSchema, body)
    const ai = writer()
    if (!ai) return this.bankDeck(userId, request)
    const now = this.clock.now()
    for (const [key, job] of this.decks)
      if (job.answer && now - job.at > DECK_KEEP_MS) this.decks.delete(key)
    const key = `${userId}:${createHash('sha256').update(JSON.stringify(request)).digest('hex')}`
    let job = this.decks.get(key)
    if (!job) {
      const day = utcDay(now)
      await this.spend(userId, 'phrases')
      const started: DeckJob = { done: this.writeDeck(userId, request, ai, day), at: now }
      started.done.then(
        (answer) => {
          started.answer = answer
          started.at = this.clock.now()
        },
        () => {
          if (this.decks.get(key) === started) this.decks.delete(key)
        },
      )
      this.decks.set(key, started)
      job = started
    }
    const answer = job.answer ?? (await settledWithin(job.done, waitMs))
    if (!answer) return { status: 'writing' }
    if (this.decks.get(key) === job) this.decks.delete(key)
    return answer
  }

  /** Claude's deck, or the bank's when Claude fails: then the allowance is given back. */
  private async writeDeck(
    userId: string,
    request: GeneratePhrasesRequest,
    ai: NonNullable<ReturnType<typeof writer>>,
    day: string,
  ): Promise<PhraseDeck> {
    try {
      const written = await claudePhrases(ai, {
        ...request,
        count: Math.min(request.count, CLAUDE_DECK_SIZE),
      })
      return {
        provider: 'claude',
        phrases: await this.voiced(userId, request, written),
        themes: [],
      }
    } catch (error) {
      this.logger.warn(
        `phrase writer failed: ${error instanceof Error ? error.message : 'unknown'}; answering from the bank`,
      )
      // The bank answers instead, free: a writer's failure doesn't cost the learner a deck.
      await this.refund(userId, 'phrases', day)
      return this.bankDeck(userId, request)
    }
  }

  private async bankDeck(userId: string, request: GeneratePhrasesRequest): Promise<PhraseDeck> {
    const phrases = await this.voiced(userId, request, bankPhrases(request))
    const themes =
      phrases.length > 0 ? [] : V2_CONTENT.bank.themes.map((t) => ({ id: t.id, title: t.title }))
    return { provider: 'bank', phrases, themes }
  }

  /**
   * Suggestions with their clips (plan 108): the app plays a suggestion before it is kept, so what
   * the writer answered is registered as speakable, its first render counted against the learner.
   */
  private async voiced(
    userId: string,
    request: { targetLang: Language; nativeLang: Language },
    phrases: WrittenPhrase[],
  ): Promise<WrittenPhrase[]> {
    const tts = readTtsRuntimeConfig()
    const texts = (p: WrittenPhrase) => ({
      [request.targetLang]: p.target,
      [request.nativeLang]: p.native,
    })
    const now = this.clock.now()
    await this.db.transaction((tx) => registerSpeechMany(tx, phrases.map(texts), now, userId))
    return phrases.map((phrase) => {
      const audio = speechFor(tts, texts(phrase))
      return Object.keys(audio).length > 0 ? { ...phrase, audio } : phrase
    })
  }

  /**
   * Notes for a phrase the learner wrote: Claude's where it writes (from the allowance), otherwise
   * Loro's written rules, free, labelled as such (plan 108).
   */
  async generateNotes(
    userId: string,
    body: unknown,
  ): Promise<{ provider: 'claude' | 'rules'; image: string[]; notes: LibraryNotes }> {
    const request = parseContract(GenerateNotesSchema, body)
    const ai = writer()
    if (ai) {
      await this.spend(userId, 'phrases')
      try {
        // Answered while the request waits, so inside the gateway's ceiling: past it, the rules do.
        const signal = AbortSignal.timeout(NOTES_WAIT_MS)
        return { provider: 'claude', ...(await claudeNotes(ai, request, signal)) }
      } catch (error) {
        this.logger.warn(
          `notes writer failed: ${error instanceof Error ? error.message : 'unknown'}; answering by the rules`,
        )
        await this.refund(userId, 'phrases')
      }
    }
    return { provider: 'rules', ...ruleNotes(request) }
  }

  /**
   * A drawn cover (LIB-04) from the day's allowance. With `attachTo` it goes on an item, drawn for the
   * item's own words: the learner's set or album wears it in place; one of Loro's (read-only, LIB-01)
   * is copied into the learner's library wearing it; a phrase or song they can read gets it as their
   * own cover, shown only to them.
   */
  async generateCover(userId: string, body: unknown): Promise<DrawnCoverWire> {
    await this.ready()
    const request = parseContract(GenerateCoverSchema, body)
    const target = request.attachTo
      ? await this.coverTarget(userId, request.kind, request.attachTo)
      : null
    const subject = target?.subject ?? {
      title: request.title ?? '',
      description: request.description,
    }
    await this.spend(userId, 'cover')
    let spec: CoverSpec | null = null
    let provider: 'claude' | 'pattern' = 'pattern'
    const ai = writer()
    if (ai) {
      try {
        spec = await claudeCover(ai, { kind: request.kind, ...subject })
        provider = 'claude'
      } catch (error) {
        this.logger.warn(
          `cover writer failed: ${error instanceof Error ? error.message : 'unknown'}; drawing a pattern`,
        )
      }
    }
    // A new pattern each time the learner asks again: the seed includes the moment.
    spec ??= patternCover(`${subject.title}:${this.clock.now()}`)
    const id = newId('cover')
    const svg = renderCover(spec)
    let copy: DrawnCoverWire['copy']
    try {
      copy = await this.db.transaction(async (tx) => {
        await tx.query(
          'INSERT INTO library_covers(id, owner_id, provider, svg, created_at) VALUES ($1,$2,$3,$4,$5)',
          [id, userId, provider, svg, this.clock.now()],
        )
        return target ? this.wear(tx, userId, target, id, request.nativeLang) : undefined
      })
    } catch (error) {
      // Nothing wears it: the day's cover is given back.
      await this.refund(userId, 'cover').catch(() => undefined)
      throw error
    }
    return { id, url: `/library/covers/${id}.svg`, provider, ...(copy ? { copy } : {}) }
  }

  /**
   * What a cover goes on, checked before the allowance is spent: someone else's set or album is not
   * found (only its owner changes it), and a copy of Loro's must fit in the learner's account.
   */
  private async coverTarget(
    userId: string,
    kind: 'set' | 'album' | 'song' | 'phrase',
    id: string,
  ): Promise<CoverTarget> {
    switch (kind) {
      case 'set': {
        const row = await this.readableSet(userId, id)
        if (row.origin !== 'loro' && row.owner_id !== userId) throw new LoroError('NOT_FOUND')
        const copy = row.origin === 'loro'
        if (copy) await this.assertKept(userId, 'sets')
        const description = row.description ?? row.subtitle?.en
        return { kind, row, copy, subject: { title: row.title, description } }
      }
      case 'album': {
        const row = await this.readableAlbum(userId, id)
        if (row.origin !== 'loro' && row.owner_id !== userId) throw new LoroError('NOT_FOUND')
        const copy = row.origin === 'loro'
        if (copy) {
          await this.assertKept(userId, 'albums')
          // The copy keeps the album's songs, so they must fit too.
          const limit = config.libraryStorageLimit('songs')
          if ((await this.keptCount(userId, 'songs')) + num(row.song_count) > limit)
            throw new LoroError('LIMIT_REACHED', `At most ${limit} songs`, {
              kind: 'songs',
              limit,
              resets_at: null,
            })
        }
        const description = row.description ?? undefined
        return { kind, row, copy, subject: { title: row.title, description } }
      }
      case 'song': {
        const song = (
          await this.db.query<SongRow>('SELECT * FROM library_songs WHERE id = $1', [id])
        ).rows[0]
        if (!song) throw new LoroError('NOT_FOUND')
        const album = await this.readableAlbum(userId, song.album_id)
        return { kind, id: song.id, subject: { title: song.title, description: album.title } }
      }
      case 'phrase': {
        const phrase = (
          await this.db.query<Pick<PhraseRow, 'doc' | 'set_id'>>(
            'SELECT doc, set_id FROM library_phrases WHERE id = $1',
            [id],
          )
        ).rows[0]
        if (!phrase) throw new LoroError('NOT_FOUND')
        await this.readableSet(userId, phrase.set_id)
        const meaning =
          phrase.doc.translations['en-GB'] ?? Object.values(phrase.doc.translations)[0]
        return { kind, id, subject: { title: phrase.doc.target, description: meaning } }
      }
    }
  }

  /** Puts a new cover on its item; returns the copy made when the item is one of Loro's. */
  private async wear(
    tx: SqlConnection,
    userId: string,
    target: CoverTarget,
    coverId: string,
    nativeLang: Language | undefined,
  ): Promise<DrawnCoverWire['copy']> {
    const now = this.clock.now()
    if (target.kind === 'set' || target.kind === 'album') {
      if (target.copy)
        return target.kind === 'set'
          ? { kind: 'set', id: await this.copySet(tx, userId, target.row, coverId, nativeLang) }
          : { kind: 'album', id: await this.copyAlbum(tx, userId, target.row, coverId) }
      const table = target.kind === 'set' ? 'library_sets' : 'library_albums'
      await tx.query(`UPDATE ${table} SET cover_id = $2, updated_at = $3 WHERE id = $1`, [
        target.row.id,
        coverId,
        now,
      ])
      return undefined
    }
    await tx.query(
      `INSERT INTO library_item_covers(user_id, kind, item_id, cover_id, updated_at) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, kind, item_id) DO UPDATE SET cover_id = EXCLUDED.cover_id, updated_at = EXCLUDED.updated_at`,
      [userId, target.kind, target.id, coverId, now],
    )
    return undefined
  }

  /**
   * The learner's own copy of one of Loro's sets: its title, topic and level, its subtitle in the
   * learner's language as the description, and its phrases listed rather than copied, so each keeps
   * one progress (plan 108).
   */
  private async copySet(
    tx: SqlConnection,
    userId: string,
    row: SetRow,
    coverId: string,
    native: Language | undefined,
  ): Promise<string> {
    const nativeLang = native && native !== row.target_lang ? native : 'en-GB'
    const locale = V2_LANGUAGES.find((l) => l.code === nativeLang)?.uiLocale ?? 'en'
    const id = newId('set-u')
    await this.insertSet(tx, {
      id,
      userId,
      targetLang: row.target_lang,
      nativeLang,
      title: row.title,
      description: blankToNull(row.subtitle?.[locale] ?? row.description),
      topicId: row.topic_id,
      level: row.level,
      coverIcon: row.cover_icon,
      coverId,
      visibility: 'private',
      inbox: false,
    })
    const held = await tx.query<{ id: string }>(
      'SELECT id FROM library_phrases WHERE set_id = $1 ORDER BY position',
      [row.id],
    )
    const items = held.rows.map((p) => ({ ref: p.id }))
    await this.insertItems(tx, id, row.target_lang, nativeLang, items, 0, userId)
    return id
  }

  /**
   * The learner's own copy of one of Loro's albums, with its ready songs (the same sound, sung from
   * the same sets) and any covers the learner gave those songs.
   */
  private async copyAlbum(
    tx: SqlConnection,
    userId: string,
    row: AlbumRow,
    coverId: string,
  ): Promise<string> {
    const id = newId('album-u')
    const now = this.clock.now()
    await tx.query(
      `INSERT INTO library_albums(id, owner_id, target_lang, title, description, cover_id, visibility, share_code, origin, position, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'private',$7,'user',0,$8,$8)`,
      [id, userId, row.target_lang, row.title, row.description, coverId, newShareCode(), now],
    )
    const songs = await tx.query<SongRow>(
      "SELECT * FROM library_songs WHERE album_id = $1 AND status = 'ready' ORDER BY position, created_at",
      [row.id],
    )
    for (const [position, song] of songs.rows.entries()) {
      const songId = newId('song')
      await tx.query(
        `INSERT INTO library_songs(id, album_id, owner_id, set_id, position, title, style_id, status, lyrics, lyrics_by, audio_id,
           audio_by, duration_ms, error, created_at, voiced)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'ready',$8,$9,$10,$11,$12,NULL,$13,$14)`,
        [
          songId,
          id,
          userId,
          song.set_id,
          position,
          song.title,
          song.style_id,
          JSON.stringify(song.lyrics),
          song.lyrics_by,
          song.audio_id,
          song.audio_by,
          song.duration_ms,
          now,
          song.voiced === true,
        ],
      )
      await tx.query(
        `INSERT INTO library_item_covers(user_id, kind, item_id, cover_id, updated_at)
         SELECT user_id, kind, $3, cover_id, $4 FROM library_item_covers WHERE user_id = $1 AND kind = 'song' AND item_id = $2`,
        [userId, song.id, songId, now],
      )
    }
    return id
  }

  /**
   * Starts a song from a set the learner can read. The song is saved at once as `rendering`; its
   * lyrics and sound are written in the background, and the app polls `GET /library/songs/:id`.
   */
  async generateSong(userId: string, body: unknown): Promise<{ song: SongWire; album: AlbumWire }> {
    await this.ready()
    const request = parseContract(GenerateSongSchema, body)
    const set = await this.readableSet(userId, request.setId)
    const phrases = (await this.phrasesOf([set.id])).slice(0, MAX_SONG_LINES - 4)
    if (phrases.length === 0) throw new LoroError('VALIDATION_FAILED', 'The set has no phrases')
    await this.assertKept(userId, 'songs')
    let albumId = request.albumId
    if (albumId) {
      const album = await this.ownAlbum(userId, albumId)
      if (album.target_lang !== set.target_lang)
        throw new LoroError('VALIDATION_FAILED', 'The album is in another language')
    }
    // A new album must fit before the allowance is spent on a song that couldn't be kept.
    if (!albumId) await this.assertKept(userId, 'albums')
    await this.spend(userId, 'song')
    albumId ??= await this.insertAlbum(userId, {
      title: set.title,
      targetLang: set.target_lang,
      visibility: 'private',
      coverId: set.cover_id ?? undefined,
    })
    const position = num(
      (
        await this.db.query<{ n: string }>(
          'SELECT count(*) AS n FROM library_songs WHERE album_id = $1',
          [albumId],
        )
      ).rows[0]?.n,
    )
    const id = newId('song')
    const title = request.title ?? set.title
    const now = this.clock.now()
    await this.db.query(
      `INSERT INTO library_songs(id, album_id, owner_id, set_id, position, title, style_id, status, lyrics, lyrics_by, audio_id, audio_by,
         duration_ms, error, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'rendering','[]','phrases',NULL,NULL,NULL,NULL,$8)`,
      [id, albumId, userId, set.id, position, title, request.styleId, now],
    )
    await this.db.query('UPDATE library_albums SET updated_at = $2 WHERE id = $1', [albumId, now])
    const songPhrases: SongPhrase[] = phrases.map((p) => ({
      id: p.id,
      target: p.doc.target,
      native: p.doc.translations[request.nativeLang] ?? Object.values(p.doc.translations)[0] ?? '',
    }))
    void this.render(id, {
      ownerId: userId,
      chargedDay: utcDay(now),
      title,
      styleId: request.styleId,
      targetLang: set.target_lang,
      nativeLang: request.nativeLang,
      phrases: songPhrases,
    })
    return { song: await this.song(userId, id), album: (await this.album(userId, albumId)).album }
  }

  /**
   * Makes a failed song again from its set's phrases, for another of the day's songs (given back if
   * it fails again).
   */
  async retrySong(userId: string, id: unknown, body: unknown): Promise<SongWire> {
    await this.ready()
    const { nativeLang } = parseContract(RetrySongSchema, body)
    const row = await this.ownSong(userId, parseContract(LibraryIdSchema, id))
    const set = await this.readableSet(userId, row.set_id)
    const phrases = (await this.phrasesOf([set.id])).slice(0, MAX_SONG_LINES - 4)
    if (phrases.length === 0) throw new LoroError('VALIDATION_FAILED', 'The set has no phrases')
    const now = this.clock.now()
    // Claimed in one statement, so two taps make it once. A song lost to a restart kept its
    // allowance (nothing gave it back), so making it again costs nothing more.
    const claimed = (
      await this.db.query<{ id: string }>(
        `UPDATE library_songs SET status = 'rendering', error = NULL, created_at = $2
         WHERE id = $1 AND (status = 'failed' OR (status = 'rendering' AND created_at < $3))
         RETURNING id`,
        [row.id, now, now - RENDER_TIMEOUT_MS],
      )
    ).rows[0]
    if (!claimed) throw new LoroError('VALIDATION_FAILED', 'Only a failed song can be made again')
    const lost = row.status === 'rendering'
    if (!lost) {
      try {
        await this.spend(userId, 'song')
      } catch (error) {
        await this.db.query(
          "UPDATE library_songs SET status = 'failed', error = $2 WHERE id = $1",
          [row.id, row.error ?? 'failed'],
        )
        throw error
      }
    }
    void this.render(row.id, {
      ownerId: userId,
      chargedDay: utcDay(now),
      title: row.title,
      styleId: parseContract(z.enum(MUSIC_STYLE_IDS), row.style_id),
      targetLang: set.target_lang,
      nativeLang,
      phrases: phrases.map((p) => ({
        id: p.id,
        target: p.doc.target,
        native: p.doc.translations[nativeLang] ?? Object.values(p.doc.translations)[0] ?? '',
      })),
    })
    return this.song(userId, row.id)
  }

  /** Takes a song out of the learner's album; its sound goes once nothing else plays it. */
  async deleteSong(userId: string, id: unknown): Promise<void> {
    const row = await this.ownSong(userId, parseContract(LibraryIdSchema, id))
    if (this.toSongWire(row).status === 'rendering')
      throw new LoroError('VALIDATION_FAILED', 'The song is still being made')
    await this.db.transaction(async (tx) => {
      await tx.query('DELETE FROM library_songs WHERE id = $1', [row.id])
      await tx.query('UPDATE library_albums SET updated_at = $2 WHERE id = $1', [
        row.album_id,
        this.clock.now(),
      ])
      await forgetUnusedAudio(tx)
    })
  }

  private async ownSong(userId: string, id: string): Promise<SongRow> {
    const row = (await this.db.query<SongRow>('SELECT * FROM library_songs WHERE id = $1', [id]))
      .rows[0]
    if (!row) throw new LoroError('NOT_FOUND')
    await this.ownAlbum(userId, row.album_id)
    return row
  }

  /** Writes the lyrics and the sound; never throws, the song records what went wrong. */
  private async render(
    id: string,
    input: {
      ownerId: string
      /** The day whose song this spent, given back there if it fails. */
      chargedDay: string
      title: string
      styleId: MusicStyleId
      targetLang: Language
      nativeLang: Language
      phrases: SongPhrase[]
    },
  ): Promise<void> {
    try {
      let sections: SongSection[] | null = null
      let lyricsBy: SongWire['lyricsBy'] = 'phrases'
      const ai = writer()
      if (ai) {
        try {
          sections = await claudeLyrics(ai, { ...input, style: input.styleId })
          lyricsBy = 'claude'
        } catch (error) {
          this.logger.warn(
            `lyrics writer failed: ${error instanceof Error ? error.message : 'unknown'}; singing the phrases`,
          )
        }
      }
      sections ??= assembleLyrics(input.phrases)
      let audio: {
        bytes: Uint8Array
        contentType: string
        durationMs: number | null
        lines: { startMs: number; endMs: number }[] | null
        by: 'elevenlabs' | 'demo'
        voiced: boolean
      }
      if (liveMusicConfigured()) {
        const lineCount = sections.reduce((n, s) => n + s.lines.length, 0)
        const live = await composeLive({
          sections,
          styleId: input.styleId,
          targetLang: input.targetLang,
          lengthMs: Math.min(120_000, Math.max(30_000, lineCount * 5_000)),
        })
        audio = { ...live, durationMs: null, lines: null, by: 'elevenlabs', voiced: true }
      } else {
        // The demo sings the lines its size allows (synth.ts); the lyrics end where its sound does.
        sections = firstLines(sections, demoLineLimit(input.styleId))
        // Without a music provider, the server's voice speaks each line over the demo's bars.
        const lineTexts = sections.flatMap((section) => section.lines.map((line) => line.text))
        const voices = this.speech
          ? await this.speech.songVoices(input.targetLang, lineTexts, input.ownerId)
          : []
        const demo = synthesizeDemo(input.styleId, lineTexts.length, `${id}:${input.title}`, voices)
        audio = {
          bytes: demo.wav,
          contentType: 'audio/wav',
          durationMs: demo.durationMs,
          lines: demo.lines,
          by: 'demo',
          voiced: voices.some((voice) => voice !== null),
        }
      }
      // The sound and the song that plays it are saved together, so a clean-up in between can't
      // take a sound no song points at yet.
      await this.db.transaction(async (tx) => {
        // Removed (or its account deleted) while it was being made: nothing to keep.
        const still = await tx.query('SELECT 1 FROM library_songs WHERE id = $1 FOR UPDATE', [id])
        if (still.rows.length === 0) return
        const audioId = await this.storeAudio(tx, audio.bytes, audio.contentType)
        await tx.query(
          `UPDATE library_songs SET status = 'ready', lyrics = $2, lyrics_by = $3, audio_id = $4, audio_by = $5, duration_ms = $6, voiced = $7 WHERE id = $1`,
          [
            id,
            JSON.stringify(timed(sections, audio.lines)),
            lyricsBy,
            audioId,
            audio.by,
            audio.durationMs,
            audio.voiced,
          ],
        )
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown'
      this.logger.warn(`song ${id} failed: ${reason}`)
      // Only the provider's own failure kinds reach the app, never an internal message.
      const code = ['rate_limited', 'provider', 'invalid_audio', 'unavailable'].includes(reason)
        ? reason
        : 'failed'
      await this.db
        .query("UPDATE library_songs SET status = 'failed', error = $2 WHERE id = $1", [id, code])
        .catch(() => undefined)
      // A song that couldn't be made doesn't count against the day's songs.
      await this.refund(input.ownerId, 'song', input.chargedDay).catch(() => undefined)
    }
  }

  // ---------- helpers ----------

  /** How many learners (other than its maker) keep each of these items in their library. */
  private async savedBy(kind: 'set' | 'album', ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map()
    const table = kind === 'set' ? 'library_sets' : 'library_albums'
    const rows = await this.db.query<{ item_id: string; n: string }>(
      `SELECT sv.item_id, count(*) AS n FROM library_saves sv JOIN ${table} t ON t.id = sv.item_id
       WHERE sv.kind = $1 AND sv.item_id = ANY($2::text[]) AND sv.user_id IS DISTINCT FROM t.owner_id
       GROUP BY sv.item_id`,
      [kind, ids],
    )
    return new Map(rows.rows.map((r) => [r.item_id, num(r.n)]))
  }

  private async savedIds(userId: string | null, kind: 'set' | 'album'): Promise<Set<string>> {
    if (!userId) return new Set()
    const rows = await this.db.query<{ item_id: string }>(
      'SELECT item_id FROM library_saves WHERE user_id = $1 AND kind = $2',
      [userId, kind],
    )
    return new Set(rows.rows.map((r) => r.item_id))
  }

  private async phrasesOf(setIds: string[]): Promise<PhraseRow[]> {
    if (setIds.length === 0) return []
    return (
      await this.db.query<PhraseRow>(
        `SELECT p.*, s.target_lang, p.set_id AS member_of, p.position AS member_position
           FROM library_phrases p JOIN library_sets s ON s.id = p.set_id
           WHERE p.set_id = ANY($1::text[])
         UNION ALL
         SELECT p.*, s.target_lang, r.set_id AS member_of, r.position AS member_position
           FROM library_set_refs r JOIN library_phrases p ON p.id = r.phrase_id
           JOIN library_sets s ON s.id = p.set_id
           WHERE r.set_id = ANY($1::text[])
         ORDER BY member_of, member_position`,
        [setIds],
      )
    ).rows
  }

  private async songsOf(albumId: string): Promise<SongWire[]> {
    const rows = await this.db.query<SongRow>(
      'SELECT * FROM library_songs WHERE album_id = $1 ORDER BY position, created_at',
      [albumId],
    )
    return rows.rows.map((row) => this.toSongWire(row))
  }

  private toSongWire(row: SongRow): SongWire {
    const lost =
      row.status === 'rendering' && this.clock.now() - num(row.created_at) > RENDER_TIMEOUT_MS
    return {
      id: row.id,
      albumId: row.album_id,
      setId: row.set_id,
      title: row.title,
      styleId: row.style_id,
      status: lost ? 'failed' : row.status,
      sections: row.lyrics,
      lyricsBy: row.lyrics_by,
      audioUrl: row.audio_id ? signedAudioPath(row.id, this.clock.now()) : null,
      audioBy: row.audio_by,
      voiced: row.voiced === true,
      durationMs: row.duration_ms,
      error: lost ? 'lost' : row.error,
      createdAt: num(row.created_at),
    }
  }

  private async readableSet(userId: string | null, id: string): Promise<SetRow> {
    const row = (await this.db.query<SetRow>(`${SET_SELECT} WHERE s.id = $1`, [id])).rows[0]
    if (!row || !canRead(row, userId)) throw new LoroError('NOT_FOUND')
    return row
  }

  private async readableAlbum(userId: string | null, id: string): Promise<AlbumRow> {
    const row = (await this.db.query<AlbumRow>(`${ALBUM_SELECT} WHERE a.id = $1`, [id])).rows[0]
    if (!row || !canRead(row, userId)) throw new LoroError('NOT_FOUND')
    return row
  }

  /** The learner's own set; someone else's is not found rather than forbidden. */
  private async ownSet(userId: string, id: string): Promise<SetRow> {
    const row = (await this.db.query<SetRow>(`${SET_SELECT} WHERE s.id = $1`, [id])).rows[0]
    if (row?.owner_id !== userId) throw new LoroError('NOT_FOUND')
    return row
  }

  private async ownAlbum(userId: string, id: string): Promise<AlbumRow> {
    const row = (await this.db.query<AlbumRow>(`${ALBUM_SELECT} WHERE a.id = $1`, [id])).rows[0]
    if (row?.owner_id !== userId) throw new LoroError('NOT_FOUND')
    return row
  }

  private async assertOwnCover(userId: string, coverId: string): Promise<void> {
    const row = (
      await this.db.query<{ owner_id: string | null }>(
        'SELECT owner_id FROM library_covers WHERE id = $1',
        [coverId],
      )
    ).rows[0]
    if (row?.owner_id !== userId) throw new LoroError('VALIDATION_FAILED', 'Unknown cover')
  }
}

/**
 * A set with its maker's name and how many songs are sung from it that anyone may hear, or its maker
 * (plan 107: a cover says whether a set holds songs too).
 */
const SET_SELECT = `SELECT s.*, p.display_name AS author,
  (SELECT count(*) FROM library_songs so JOIN library_albums a ON a.id = so.album_id
    WHERE so.set_id = s.id AND so.status = 'ready'
      AND (a.origin = 'loro' OR a.visibility = 'public' OR a.owner_id = s.owner_id)) AS song_count
  FROM library_sets s LEFT JOIN library_profiles p ON p.user_id = s.owner_id`
const ALBUM_SELECT = `SELECT a.*, p.display_name AS author,
  (SELECT count(*) FROM library_songs so WHERE so.album_id = a.id AND so.status = 'ready') AS song_count,
  (SELECT CASE WHEN count(so.duration_ms) = count(*) THEN coalesce(sum(so.duration_ms), 0) END FROM library_songs so WHERE so.album_id = a.id AND so.status = 'ready') AS duration_ms
  FROM library_albums a LEFT JOIN library_profiles p ON p.user_id = a.owner_id`

/** Tables of synced rows, each keyed by `user_id` (sync/sync.schema.ts). */
const SYNC_TABLES = [
  'sync_rows',
  'sync_changes',
  'sync_receipts',
  'sync_cursors',
  'sync_phrase_identity',
  'sync_aliases',
  'sync_phrase_generations',
  'sync_heads',
] as const

/**
 * Everything a learner keeps in the library. The day's allowance use stays: deleting your things
 * doesn't give the day's generations back.
 */
async function deleteLibraryOf(tx: SqlConnection, userId: string): Promise<void> {
  await tx.query(
    `DELETE FROM library_set_refs WHERE set_id IN (SELECT id FROM library_sets WHERE owner_id = $1)
       OR phrase_id IN (SELECT p.id FROM library_phrases p JOIN library_sets s ON s.id = p.set_id WHERE s.owner_id = $1)`,
    [userId],
  )
  await tx.query(
    'DELETE FROM library_phrases WHERE set_id IN (SELECT id FROM library_sets WHERE owner_id = $1)',
    [userId],
  )
  await tx.query(
    "DELETE FROM library_saves WHERE kind = 'set' AND item_id IN (SELECT id FROM library_sets WHERE owner_id = $1)",
    [userId],
  )
  await tx.query(
    "DELETE FROM library_saves WHERE kind = 'album' AND item_id IN (SELECT id FROM library_albums WHERE owner_id = $1)",
    [userId],
  )
  await tx.query(
    `DELETE FROM library_reports WHERE (kind = 'set' AND item_id IN (SELECT id FROM library_sets WHERE owner_id = $1))
       OR (kind = 'album' AND item_id IN (SELECT id FROM library_albums WHERE owner_id = $1))`,
    [userId],
  )
  await tx.query('DELETE FROM library_sets WHERE owner_id = $1', [userId])
  await tx.query(
    'DELETE FROM library_songs WHERE owner_id = $1 OR album_id IN (SELECT id FROM library_albums WHERE owner_id = $1)',
    [userId],
  )
  await tx.query('DELETE FROM library_albums WHERE owner_id = $1', [userId])
  await tx.query('DELETE FROM library_item_covers WHERE user_id = $1', [userId])
  // A song made from someone's set takes the set's cover: a cover another learner's set or album
  // still wears stays, no longer theirs.
  await tx.query(
    `DELETE FROM library_covers c WHERE c.owner_id = $1
       AND NOT EXISTS (SELECT 1 FROM library_sets s WHERE s.cover_id = c.id)
       AND NOT EXISTS (SELECT 1 FROM library_albums a WHERE a.cover_id = c.id)`,
    [userId],
  )
  await tx.query('UPDATE library_covers SET owner_id = NULL WHERE owner_id = $1', [userId])
  await tx.query('DELETE FROM library_saves WHERE user_id = $1', [userId])
  await tx.query('DELETE FROM library_reports WHERE user_id = $1', [userId])
  await tx.query('DELETE FROM library_profiles WHERE user_id = $1', [userId])
  await tx.query('DELETE FROM library_progress WHERE user_id = $1', [userId])
  // A clip is keyed by its language and text, so another learner's phrase (or Loro's) may speak
  // the same words: it stays, no longer counted against this learner.
  await tx.query('UPDATE library_speech SET owner_id = NULL WHERE owner_id = $1', [userId])
  await forgetUnusedAudio(tx)
}

/** Sounds nothing plays any more: no song and no phrase clip (content-addressed, so shared ones stay). */
async function forgetUnusedAudio(tx: SqlConnection): Promise<void> {
  await tx.query(
    `DELETE FROM library_audio a WHERE NOT EXISTS (SELECT 1 FROM library_songs s WHERE s.audio_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM library_speech sp WHERE sp.audio_id = a.id)`,
  )
}

function canRead(
  row: { origin: string; owner_id: string | null; visibility: Visibility },
  userId: string | null,
): boolean {
  return (
    row.origin === 'loro' ||
    row.visibility !== 'private' ||
    (userId !== null && row.owner_id === userId)
  )
}

function ownerOf(row: { origin: string; owner_id: string | null }, userId: string | null): Owner {
  if (row.origin === 'loro') return 'loro'
  return userId !== null && row.owner_id === userId ? 'me' : 'other'
}

function toSetWire(
  row: SetRow,
  userId: string | null,
  saved: Set<string>,
  phrases: PhraseRow[],
): SetWire {
  const owner = ownerOf(row, userId)
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    topicId: row.topic_id,
    level: row.level,
    coverIcon: row.cover_icon,
    coverUrl: coverPath(row.cover_id),
    targetLang: row.target_lang,
    phraseIds: phrases.filter((p) => p.member_of === row.id).map((p) => p.id),
    songCount: num(row.song_count),
    owner,
    author: row.origin === 'loro' ? null : (row.author ?? null),
    visibility: row.visibility,
    shareCode: owner === 'me' || row.visibility !== 'private' ? row.share_code : null,
    saved: saved.has(row.id),
    ...(row.inbox && owner === 'me' ? { inbox: true } : {}),
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
  }
}

/** Each phrase once: a set that lists another's phrase brings it again. */
function uniquePhrases(rows: PhraseRow[]): PhraseRow[] {
  const seen = new Set<string>()
  return rows.filter((row) => !seen.has(row.id) && Boolean(seen.add(row.id)))
}

/** Flags the owner's public item that reports took out of Community. */
function markHidden<T extends SetWire | AlbumWire>(wire: T, hidden: Set<string>): T {
  return wire.owner === 'me' && wire.visibility === 'public' && hidden.has(wire.id)
    ? { ...wire, hidden: true }
    : wire
}

function toAlbumWire(row: AlbumRow, userId: string | null, saved: Set<string>): AlbumWire {
  const owner = ownerOf(row, userId)
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverUrl: coverPath(row.cover_id),
    targetLang: row.target_lang,
    owner,
    author: row.origin === 'loro' ? null : (row.author ?? null),
    visibility: row.visibility,
    shareCode: owner === 'me' || row.visibility !== 'private' ? row.share_code : null,
    saved: saved.has(row.id),
    songCount: num(row.song_count),
    // Unknown when a sung song's length isn't measured: never a total that leaves it out.
    durationMs:
      row.duration_ms === null || row.duration_ms === undefined ? null : num(row.duration_ms),
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
  }
}

/** A phrase as the app reads it, with a clip in each language this server's voices speak. */
function toPhraseWire(row: PhraseRow, speech: TtsRuntimeConfig): PhraseWire {
  const audio = speechFor(speech, { [row.target_lang]: row.doc.target, ...row.doc.translations })
  return {
    id: row.id,
    setId: row.set_id,
    ...row.doc,
    ...(Object.keys(audio).length > 0 ? { audio } : {}),
    noteTranslations: row.note_translations,
    source: row.source,
  }
}

/** A content id's note translations, by note kind. */
function noteTranslationsOf(
  id: string,
  all: Record<string, Partial<Record<Language, { title: string; text: string }>>>,
): NoteTranslations {
  return Object.fromEntries(
    (['mnemonic', 'grammar', 'pronunciation'] as const).flatMap((kind) =>
      all[`${id}.${kind}`] ? [[kind, all[`${id}.${kind}`]]] : [],
    ),
  )
}

/** Notes written in the learner's language also stand as that language's version. */
function writtenIn(nativeLang: Language, notes: LibraryNotes): NoteTranslations {
  if (nativeLang === 'en-GB') return {}
  return Object.fromEntries(
    (['mnemonic', 'grammar', 'pronunciation'] as const).map((kind) => [
      kind,
      { [nativeLang]: { title: notes[kind].title, text: notes[kind].text } },
    ]),
  )
}

/** Lyrics with each line's timing, where the sound's timing is known. */
/** The song's first `limit` lines, in their sections; a section left with none is dropped. */
function firstLines(sections: SongSection[], limit: number): SongSection[] {
  let room = limit
  return sections.flatMap((section) => {
    const lines = section.lines.slice(0, Math.max(0, room))
    room -= lines.length
    return lines.length > 0 ? [{ ...section, lines }] : []
  })
}

function timed(
  sections: SongSection[],
  lines: { startMs: number; endMs: number }[] | null,
): SongRow['lyrics'] {
  let index = 0
  return sections.map((section) => ({
    name: section.name,
    lines: section.lines.map((line) => {
      const timing = lines?.[index++]
      return { ...line, startMs: timing?.startMs ?? null, endMs: timing?.endMs ?? null }
    }),
  }))
}

/** A stable share code for Loro's own rows, so their links survive a reseed. */
function shareCodeFor(id: string): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  return Array.from(
    createHash('sha256').update(`loro-share:${id}`).digest().subarray(0, 10),
    (byte) => alphabet[byte % alphabet.length],
  ).join('')
}

/** Signed song URLs last this long; the app fetches its album again for a fresh one. */
const AUDIO_URL_TTL_MS = 12 * 3_600_000
/** Per process unless configured, so a restart only makes the app fetch its albums again. */
const audioSecret = config.libraryUrlSecret() ?? randomBytes(32).toString('hex')

function audioSignature(songId: string, exp: number): string {
  return createHmac('sha256', audioSecret)
    .update(`${songId}:${exp}`)
    .digest('base64url')
    .slice(0, 32)
}

/** The audio path with an expiry rounded to the hour, so the same song keeps one URL for a while. */
function signedAudioPath(songId: string, now: number): string {
  const exp = Math.ceil((now + AUDIO_URL_TTL_MS) / 3_600_000) * 3_600_000
  return `/library/songs/${songId}/audio?exp=${exp}&sig=${audioSignature(songId, exp)}`
}

function validAudioSignature(
  songId: string,
  signature: { exp?: unknown; sig?: unknown },
  now: number,
): boolean {
  const exp = Number(signature.exp)
  if (typeof signature.sig !== 'string' || !Number.isSafeInteger(exp) || exp < now) return false
  const expected = Buffer.from(audioSignature(songId, exp))
  const given = Buffer.from(signature.sig)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

/** What `work` settles to within `ms` (forever when unset), or null if it is still going. */
async function settledWithin<T>(work: Promise<T>, ms: number | undefined): Promise<T | null> {
  if (ms === undefined) return work
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      resolve(null)
    }, ms)
    timer.unref()
  })
  try {
    return await Promise.race([work, late])
  } finally {
    clearTimeout(timer)
  }
}

export function writersInUse(): UsageWire['writers'] {
  const ai = Boolean(config.aiApiKey()?.trim())
  return {
    phrases: ai ? 'claude' : 'bank',
    cover: ai ? 'claude' : 'pattern',
    lyrics: ai ? 'claude' : 'phrases',
    music: liveMusicConfigured() ? 'elevenlabs' : 'demo',
  }
}

export type { WrittenPhrase }
