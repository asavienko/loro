/**
 * Plan 106: the library against real PostgreSQL — the seed, visibility, allowances and songs.
 * Set LORO_TEST_DATABASE_URL.
 */
import type { Pool } from 'pg'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { LoroError } from '../common/errors.js'
import { PostgresDatabase } from '../database/database.js'
import {
  LORO_TEST_DATABASE_URL,
  connectAdmin,
  createSearchPathSchema,
  describePostgres,
  dropIsolatedSchema,
  isolatedSchemaName,
} from '../testing/postgres-schema.js'
import { LibraryService } from './library.service.js'
import { ProgressService } from './progress.js'
import { SpeechService, speechFor, utteranceId } from './speech.js'
import { resetWriter } from './writers.js'

const code = async (work: Promise<unknown>) => {
  try {
    await work
    return 'ok'
  } catch (error) {
    return error instanceof LoroError ? error.code : String(error)
  }
}

describePostgres('the library against real PostgreSQL', () => {
  let admin: Pool
  let database: PostgresDatabase
  let library: LibraryService
  let now = Date.parse('2026-09-30T10:00:00Z')
  const schema = isolatedSchemaName('library')

  beforeAll(async () => {
    admin = connectAdmin(LORO_TEST_DATABASE_URL)
    vi.stubEnv('DATABASE_URL', await createSearchPathSchema(admin, schema, LORO_TEST_DATABASE_URL))
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    vi.stubEnv('MUSIC_PROVIDER', 'stub')
    vi.stubEnv('LIMIT_PHRASES_DAILY', '2')
    vi.stubEnv('LIMIT_SETS_KEPT', '3')
    resetWriter()
    database = new PostgresDatabase()
    expect(await database.ready()).toBe(true)
    library = new LibraryService(database, { now: () => now })
  })

  afterAll(async () => {
    await database.onModuleDestroy()
    await dropIsolatedSchema(admin, schema)
    await admin.end()
    vi.unstubAllEnvs()
    resetWriter()
  })

  const deck = async (userId: string) => {
    const written = await library.generatePhrases(userId, {
      mode: 'topic',
      input: 'hotel',
      targetLang: 'es-ES',
      nativeLang: 'bg-BG',
      count: 4,
    })
    return written.phrases.map(({ target, native, image, notes, source, bankId }) => ({
      target,
      native,
      image,
      notes,
      source,
      bankId,
    }))
  }

  it('serves Loro’s sets, bank and album to anyone', async () => {
    const pack = await library.pack(null, 'es-ES')
    expect(pack.sets.map((s) => s.id)).toContain('set-cafe')
    expect(pack.sets.every((s) => s.owner === 'loro')).toBe(true)
    expect(
      pack.phrases.find((p) => p.id === 'cafe-01')?.noteTranslations.grammar?.['bg-BG'],
    ).toBeDefined()
    expect(pack.bank.phrases.every((p) => p.targetLang === 'es-ES')).toBe(true)
    const [album] = pack.albums
    expect(album?.owner).toBe('loro')
    const { songs } = await library.album(null, album?.id)
    expect(songs.length).toBe(pack.sets.length)
    expect(
      songs.every((s) => s.status === 'ready' && s.audioBy === 'demo' && s.lyricsBy === 'phrases'),
    ).toBe(true)
    expect(songs[0]?.sections.flatMap((s) => s.lines).every((l) => l.startMs !== null)).toBe(true)
    // Seeding again is a no-op, and the pack says nothing changed.
    expect(
      (await new LibraryService(database, { now: () => now }).pack(null, 'es-ES')).version,
    ).toBe(pack.version)
  })

  it('keeps a private set to its owner, and shares a link or public one', async () => {
    const phrases = await deck('ana')
    const { set } = await library.createSet('ana', {
      title: 'Hotel',
      targetLang: 'es-ES',
      nativeLang: 'bg-BG',
      phrases,
    })
    expect(set.visibility).toBe('private')
    expect(set.owner).toBe('me')
    expect(await code(library.set(null, set.id))).toBe('NOT_FOUND')
    expect(await code(library.set('bo', set.id))).toBe('NOT_FOUND')
    expect(await code(library.shared(null, set.shareCode))).toBe('NOT_FOUND')
    expect((await library.pack('bo', 'es-ES')).sets.map((s) => s.id)).not.toContain(set.id)

    await library.updateSet('ana', set.id, { visibility: 'link' })
    const shared = await library.shared(null, set.shareCode)
    expect(shared.kind).toBe('set')
    expect(
      (await library.community(null, { target: 'es-ES', kind: 'sets' })).sets?.map((s) => s.id),
    ).not.toContain(set.id)

    await library.setProfile('ana', { displayName: 'Ana' })
    await library.updateSet('ana', set.id, { visibility: 'public' })
    const listed = (
      await library.community('bo', { target: 'es-ES', kind: 'sets', q: 'hot' })
    ).sets?.find((s) => s.id === set.id)
    expect(listed).toMatchObject({ owner: 'other', author: 'Ana', saved: false })

    // Bo saves it: it joins Bo's pack until Ana makes it private again.
    await library.save('bo', { kind: 'set', id: set.id })
    expect((await library.pack('bo', 'es-ES')).sets.find((s) => s.id === set.id)?.saved).toBe(true)
    await library.updateSet('ana', set.id, { visibility: 'private' })
    expect((await library.pack('bo', 'es-ES')).sets.map((s) => s.id)).not.toContain(set.id)

    // Only the owner changes or deletes it.
    expect(await code(library.updateSet('bo', set.id, { title: 'Mine now' }))).toBe('NOT_FOUND')
    expect(await code(library.deleteSet('bo', set.id))).toBe('NOT_FOUND')
    await library.deleteSet('ana', set.id)
    expect(await code(library.set('ana', set.id))).toBe('NOT_FOUND')
  })

  it('keeps a bank phrase’s notes and a written one’s in the learner’s language', async () => {
    const phrases = await deck('cy')
    const written = {
      target: 'Hola, soy Cy',
      native: 'Здравей, аз съм Сай',
      image: ['waving_hand'],
      source: 'written' as const,
      notes: phrases[0]?.notes,
    }
    const { phrases: stored } = await library.createSet('cy', {
      title: 'Mixed',
      targetLang: 'es-ES',
      nativeLang: 'bg-BG',
      phrases: [phrases[0], written],
    })
    expect(stored[0]?.source).toBe('bank')
    expect(stored[0]?.notes.grammar.text).not.toBe(
      stored[0]?.noteTranslations.grammar?.['bg-BG']?.text,
    )
    expect(stored[1]?.translations).toEqual({ 'bg-BG': 'Здравей, аз съм Сай' })
    expect(stored[1]?.noteTranslations.grammar?.['bg-BG']).toEqual({
      title: stored[1]?.notes.grammar.title,
      text: stored[1]?.notes.grammar.text,
    })
  })

  it('counts each day’s allowance and says when it resets', async () => {
    const usage = await library.usage('dee')
    expect(usage.daily.phrases).toEqual({ used: 0, limit: 2 })
    expect(usage.writers).toEqual({
      phrases: 'bank',
      cover: 'pattern',
      lyrics: 'phrases',
      music: 'demo',
    })
    await deck('dee')
    await deck('dee')
    const refused = await library
      .generatePhrases('dee', {
        mode: 'topic',
        input: 'hotel',
        targetLang: 'es-ES',
        nativeLang: 'en-GB',
      })
      .catch((e: unknown) => e)
    expect(refused).toBeInstanceOf(LoroError)
    expect((refused as LoroError).code).toBe('LIMIT_REACHED')
    expect((refused as LoroError).extra['resets_at']).toBe(Date.parse('2026-10-01T00:00:00Z'))
    now += 86_400_000
    expect((await library.usage('dee')).daily.phrases.used).toBe(0)
    await deck('dee')
  })

  it('caps how many sets one account keeps', async () => {
    const phrases = (await deck('eve')).slice(0, 1)
    for (let i = 0; i < 3; i++)
      await library.createSet('eve', {
        title: `S${i}`,
        targetLang: 'es-ES',
        nativeLang: 'bg-BG',
        phrases,
      })
    expect(
      await code(
        library.createSet('eve', {
          title: 'Too many',
          targetLang: 'es-ES',
          nativeLang: 'bg-BG',
          phrases,
        }),
      ),
    ).toBe('LIMIT_REACHED')
  })

  it('draws a cover onto the learner’s own set only', async () => {
    const { set } = await library.createSet('fay', {
      title: 'Covers',
      targetLang: 'es-ES',
      nativeLang: 'bg-BG',
      phrases: (await deck('fay')).slice(0, 1),
    })
    expect(
      await code(library.generateCover('gil', { kind: 'set', title: 'x', attachTo: set.id })),
    ).toBe('NOT_FOUND')
    const cover = await library.generateCover('fay', {
      kind: 'set',
      title: 'Covers',
      attachTo: set.id,
    })
    expect(cover.provider).toBe('pattern')
    expect((await library.set('fay', set.id)).set.coverUrl).toBe(cover.url)
    expect(await library.cover(`${cover.id}.svg`)).toMatch(/^<svg /)
    expect(
      await code(
        library.createSet('gil', {
          title: 'Stolen',
          targetLang: 'es-ES',
          nativeLang: 'bg-BG',
          coverId: cover.id,
          phrases: (await deck('gil')).slice(0, 1),
        }),
      ),
    ).toBe('VALIDATION_FAILED')
  })

  it('sings a set into a new album and plays it only for who may see it', async () => {
    const { song, album } = await library.generateSong('hal', {
      setId: 'set-cafe',
      styleId: 'gentle_ballad',
      nativeLang: 'en-GB',
    })
    expect(song.status).toBe('rendering')
    expect(album).toMatchObject({ owner: 'me', visibility: 'private', title: 'Café & Mañanas' })
    await vi.waitFor(
      async () => {
        expect((await library.song('hal', song.id)).status).toBe('ready')
      },
      { timeout: 5000 },
    )
    const ready = await library.song('hal', song.id)
    expect(
      ready.sections.flatMap((s) => s.lines).every((l) => l.phraseId?.startsWith('cafe-')),
    ).toBe(true)

    // The signed URL plays without a bearer; the bare route does not, while the album is private.
    const url = new URL(`http://x${ready.audioUrl ?? ''}`)
    const signed = await library.songAudio(null, song.id, {
      exp: url.searchParams.get('exp'),
      sig: url.searchParams.get('sig'),
    })
    expect(signed.contentType).toBe('audio/wav')
    expect(await code(library.songAudio(null, song.id))).toBe('NOT_FOUND')
    expect(
      await code(
        library.songAudio(null, song.id, { exp: url.searchParams.get('exp'), sig: 'x'.repeat(32) }),
      ),
    ).toBe('NOT_FOUND')
    expect(await code(library.song('ivy', song.id))).toBe('NOT_FOUND')

    // A second song joins the same album.
    const second = await library.generateSong('hal', {
      setId: 'set-tapas',
      styleId: 'modern_pop',
      nativeLang: 'en-GB',
      albumId: album.id,
    })
    expect(second.album.id).toBe(album.id)
    expect(
      await code(
        library.generateSong('ivy', {
          setId: 'set-tapas',
          styleId: 'modern_pop',
          nativeLang: 'en-GB',
          albumId: album.id,
        }),
      ),
    ).toBe('NOT_FOUND')
  })

  it('keeps a learner’s progress and refuses a write that missed another device’s', async () => {
    const progress = new ProgressService(database, { now: () => now })
    expect(await progress.read('joy')).toEqual({ progress: null, revision: 0, updatedAt: null })
    expect(await progress.write('joy', { progress: { log: [1] }, baseRevision: 0 })).toEqual({
      revision: 1,
    })
    // A second device that also started from nothing must merge what the first wrote.
    expect(await code(progress.write('joy', { progress: { log: [2] }, baseRevision: 0 }))).toBe(
      'CURSOR_EXPIRED',
    )
    expect(await progress.write('joy', { progress: { log: [1, 2] }, baseRevision: 1 })).toEqual({
      revision: 2,
    })
    expect(await code(progress.write('joy', { progress: { log: [9] }, baseRevision: 1 }))).toBe(
      'CURSOR_EXPIRED',
    )
    expect((await progress.read('joy')).progress).toEqual({ log: [1, 2] })
    expect((await progress.read('kim')).progress).toBeNull()
    expect(
      await code(
        progress.write('joy', { progress: { log: 'x'.repeat(4_000_000) }, baseRevision: 2 }),
      ),
    ).toBe('VALIDATION_FAILED')
  })

  it('takes a public set out of Community once three learners report it', async () => {
    const phrases = (await deck('lou')).slice(0, 1)
    const { set } = await library.createSet('lou', {
      title: 'Reported',
      targetLang: 'es-ES',
      nativeLang: 'bg-BG',
      visibility: 'public',
      phrases,
    })
    const listed = async () =>
      (await library.community(null, { target: 'es-ES', kind: 'sets' })).sets?.some(
        (s) => s.id === set.id,
      )
    expect(await code(library.report('lou', { kind: 'set', id: set.id, reason: 'spam' }))).toBe(
      'VALIDATION_FAILED',
    )
    expect(await code(library.report('max', { kind: 'set', id: 'set-cafe', reason: 'spam' }))).toBe(
      'VALIDATION_FAILED',
    )
    for (const who of ['max', 'max', 'ned'])
      await library.report(who, { kind: 'set', id: set.id, reason: 'offensive' })
    expect(await listed()).toBe(true)
    await library.report('oli', { kind: 'set', id: set.id, reason: 'offensive' })
    expect(await listed()).toBe(false)
    expect((await library.set(null, set.id)).set.id).toBe(set.id)
  })

  it('speaks only the library’s own text, renders each clip once, and bounds renders a day', async () => {
    vi.stubEnv('LIMIT_SPEECH_RENDERS_DAILY', '2')
    let renders = 0
    const transport = {
      synthesize: ({ text }: { text: string }) => {
        renders += 1
        return Promise.resolve({
          bytes: new TextEncoder().encode(`mp3:${text}`),
          contentType: 'audio/mpeg',
          provenance: {
            provider: 'elevenlabs' as const,
            model: 'm',
            voiceId: 'v-es',
            outputFormat: 'mp3',
            locale: 'es-ES',
          },
          characterCount: text.length,
        })
      },
    }
    const runtime = {
      provider: 'elevenlabs' as const,
      apiKey: 'k',
      model: 'm',
      outputFormat: 'mp3',
      voices: { 'es-ES': 'v-es' },
      stubRender: false,
    }
    const speech = new SpeechService(database, { now: () => now }, transport, runtime)
    await library.pack(null, 'es-ES')
    const phrase = (await library.set(null, 'set-cafe')).phrases[0]
    const urls = speechFor(runtime, { 'es-ES': phrase?.target ?? '', 'en-GB': 'no English voice' })
    expect(Object.keys(urls)).toEqual(['es-ES'])
    const file = `${utteranceId('es-ES', phrase?.target ?? '')}.mp3`
    expect(new TextDecoder().decode((await speech.clip(file)).bytes)).toBe(
      `mp3:${phrase?.target ?? ''}`,
    )
    await speech.clip(file)
    expect(renders).toBe(1)
    // Text the library doesn't hold is never spoken.
    expect(await code(speech.clip(`${utteranceId('es-ES', 'Anything at all')}.mp3`))).toBe(
      'NOT_FOUND',
    )
    expect(await code(speech.clip('../etc/passwd'))).toBe('NOT_FOUND')
    // The day's renders are bounded.
    const others = (await library.set(null, 'set-tapas')).phrases.map(
      (p) => `${utteranceId('es-ES', p.target)}.mp3`,
    )
    await speech.clip(others[0] ?? '')
    expect(await code(speech.clip(others[1] ?? ''))).toBe('PROVIDER_UNAVAILABLE')
    vi.stubEnv('LIMIT_SPEECH_RENDERS_DAILY', '500')
  })
})
