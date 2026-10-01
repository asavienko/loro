/**
 * Plan 106: the library against real PostgreSQL — the seed, visibility, allowances and songs.
 * Set LORO_TEST_DATABASE_URL.
 */
import type { Pool } from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { LoroError } from '../common/errors.js'
import { ChatCompletions, FIREWORKS_CHAT_URL } from '../integrations/openai-compatible/chat.js'
import { PostgresDatabase } from '../database/database.js'
import {
  LORO_TEST_DATABASE_URL,
  connectAdmin,
  createSearchPathSchema,
  describePostgres,
  dropIsolatedSchema,
  isolatedSchemaName,
} from '../testing/postgres-schema.js'
import { AI_DECK_SIZE, LibraryService } from './library.service.js'
import { ProgressService } from './progress.js'
import { SpeechService, speechFor, utteranceId } from './speech.js'
import { MAX_DEMO_WAV_BYTES, demoLineLimit } from './synth.js'
import { resetArtist, resetWriter } from './writers.js'
import type { ImageModel } from '../integrations/openrouter/images.js'
import { ProviderFailure } from '../integrations/provider-failure.js'

const code = async (work: Promise<unknown>) => {
  try {
    await work
    return 'ok'
  } catch (error) {
    return error instanceof LoroError ? error.code : String(error)
  }
}

/** A text model whose every answer is `value`, or that always fails. */
function modelClient(send: typeof fetch): ChatCompletions {
  return new ChatCompletions(
    {
      name: 'test',
      url: FIREWORKS_CHAT_URL,
      apiKey: 'test',
      model: 'test',
      timeoutMs: 1000,
      maxTokens: 100,
      maxRequestBytes: 100_000,
      maxResponseBytes: 100_000,
      maxConcurrentRequests: 1,
    },
    send,
  )
}
const modelAnswering = (value: unknown) =>
  modelClient(() =>
    Promise.resolve(
      Response.json({
        choices: [
          { finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(value) } },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
    ),
  )
const modelFailing = () => modelClient(() => Promise.resolve(new Response('{}', { status: 500 })))
const writtenPhrase = {
  target: '¿Tienen habitaciones libres?',
  native: 'Do you have rooms free?',
  image: ['key'],
  notes: {
    mnemonic: { title: 'A hook', text: 'Something true.' },
    grammar: { title: 'A rule', text: 'Something accurate.' },
    pronunciation: { title: 'A sound', text: 'Watch the r.', ipa: 'ˈo.la', respelling: 'OH-lah' },
  },
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
    vi.stubEnv('FIREWORKS_API_KEY', '')
    vi.stubEnv('OPENROUTER_API_KEY', '')
    vi.stubEnv('MUSIC_PROVIDER', 'stub')
    vi.stubEnv('LIMIT_PHRASES_DAILY', '2')
    vi.stubEnv('LIMIT_SETS_KEPT', '3')
    vi.stubEnv('LIBRARY_VOICE_LORO_SONGS', '0')
    resetWriter()
    resetArtist()
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
    resetArtist()
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

  // The first pack seeds Loro's content and synthesizes its albums' demos: about 4 s alone, more
  // beside the other test files, past vitest's default 5 s.
  it('serves Loro’s sets, bank and album to anyone', { timeout: 30_000 }, async () => {
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

  it('serves a pack for every course the languages name, and none for the others', async () => {
    const { languages } = library.languages()
    for (const language of languages) {
      if (language.canTarget)
        expect((await library.pack(null, language.code)).sets.length).toBeGreaterThan(0)
      else expect(await code(library.pack(null, language.code))).toBe('VALIDATION_FAILED')
    }
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
    // The phrase bank answers free, as the app's own copy of it would: no allowance is spent.
    for (let i = 0; i < 3; i++) expect((await deck('dee')).length).toBeGreaterThan(0)
    expect((await library.usage('dee')).daily.phrases.used).toBe(0)

    // The model's decks count, and the third of a day is refused until the day resets.
    resetWriter(modelAnswering({ phrases: [writtenPhrase] }))
    try {
      for (let i = 0; i < 2; i++) {
        const written = await library.generatePhrases('dee', {
          mode: 'topic',
          input: 'hotel',
          targetLang: 'es-ES',
          nativeLang: 'en-GB',
        })
        expect(written.provider).toBe('ai')
      }
      expect((await library.usage('dee')).daily.phrases.used).toBe(2)
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
      expect((await library.usage('dee')).daily.phrases.used).toBe(1)
    } finally {
      resetWriter()
    }
  })

  it('gives the allowance back when the model fails and the bank answers instead', async () => {
    resetWriter(modelFailing())
    try {
      const answered = await library.generatePhrases('dot', {
        mode: 'topic',
        input: 'hotel',
        targetLang: 'es-ES',
        nativeLang: 'en-GB',
      })
      expect(answered.provider).toBe('bank')
      expect(answered.phrases.length).toBeGreaterThan(0)
      expect((await library.usage('dot')).daily.phrases.used).toBe(0)
    } finally {
      resetWriter()
    }
  })

  it('has the model write a short deck: More asks for the rest', async () => {
    resetWriter(
      modelAnswering({
        phrases: Array.from({ length: 9 }, (_, i) => ({
          ...writtenPhrase,
          target: `Frase número ${i + 1}`,
        })),
      }),
    )
    try {
      const deck = await library.generatePhrases('wren', {
        mode: 'topic',
        input: 'hotel',
        targetLang: 'es-ES',
        nativeLang: 'en-GB',
      })
      expect(deck.provider).toBe('ai')
      expect(deck.phrases).toHaveLength(AI_DECK_SIZE)
    } finally {
      resetWriter()
    }
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
    // With no model the pattern is drawn at once.
    expect(cover).toMatchObject({ provider: 'pattern', status: 'ready' })
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

  it('copies one of Loro’s sets to wear a new cover, its phrases listed, not copied', async () => {
    const loro = (await library.set(null, 'set-cafe')).set
    const cover = await library.generateCover('lia', {
      kind: 'set',
      attachTo: 'set-cafe',
      nativeLang: 'bg-BG',
    })
    expect(cover.copy?.kind).toBe('set')
    const { set: copy, phrases } = await library.set('lia', cover.copy?.id)
    expect(copy).toMatchObject({
      owner: 'me',
      visibility: 'private',
      title: loro.title,
      topicId: loro.topicId,
      coverUrl: cover.url,
      phraseIds: loro.phraseIds,
    })
    expect(copy.description).toBe(loro.subtitle?.bg)
    // The same phrases, Loro's: one progress wherever they are listed.
    expect(phrases.every((p) => p.setId === 'set-cafe')).toBe(true)
    // Loro's set is as it was, for everyone; the copy is in the learner's pack.
    expect((await library.set('lia', 'set-cafe')).set.coverUrl).toBeNull()
    expect((await library.pack('lia', 'es-ES')).sets.map((s) => s.id)).toContain(copy.id)
    // The copy is the learner's: a cover drawn for it again goes on it in place.
    const again = await library.generateCover('lia', { kind: 'set', attachTo: copy.id })
    expect(again.copy).toBeUndefined()
    expect((await library.set('lia', copy.id)).set.coverUrl).toBe(again.url)
  })

  it('makes no copy that the account can’t keep, and spends nothing on it', async () => {
    const phrases = (await deck('max')).slice(0, 1)
    for (let i = 0; i < 3; i++)
      await library.createSet('max', {
        title: `S${i}`,
        targetLang: 'es-ES',
        nativeLang: 'bg-BG',
        phrases,
      })
    expect(await code(library.generateCover('max', { kind: 'set', attachTo: 'set-cafe' }))).toBe(
      'LIMIT_REACHED',
    )
    expect((await library.usage('max')).daily.cover.used).toBe(0)
  })

  it('copies one of Loro’s albums with its songs to wear a new cover', async () => {
    const loro = (await library.album(null, 'album-loro-es')).album
    const cover = await library.generateCover('ned', { kind: 'album', attachTo: loro.id })
    expect(cover.copy?.kind).toBe('album')
    const { album, songs } = await library.album('ned', cover.copy?.id)
    expect(album).toMatchObject({
      owner: 'me',
      visibility: 'private',
      title: loro.title,
      coverUrl: cover.url,
      songCount: loro.songCount,
    })
    expect(songs.every((s) => s.status === 'ready' && s.audioUrl !== null)).toBe(true)
    expect((await library.album(null, loro.id)).album.coverUrl).toBe(loro.coverUrl)
    // Someone else's album, even a public one, is only its owner's to change.
    await library.updateAlbum('ned', album.id, { visibility: 'public' })
    expect(await code(library.generateCover('oda', { kind: 'album', attachTo: album.id }))).toBe(
      'NOT_FOUND',
    )
    // Gone again, so its songs don't count in the later tests' sets.
    await library.deleteAlbum('ned', album.id)
  })

  it('keeps a learner’s own covers of phrases and songs to them, across their devices', async () => {
    const song = (await library.album(null, 'album-loro-es')).songs[0]
    const phrase = await library.generateCover('pia', { kind: 'phrase', attachTo: 'cafe-01' })
    const sung = await library.generateCover('pia', { kind: 'song', attachTo: song?.id })
    expect([phrase.copy, sung.copy]).toEqual([undefined, undefined])
    expect((await library.pack('pia', 'es-ES')).covers).toEqual({
      phrases: { 'cafe-01': phrase.url },
      songs: { [song?.id ?? '']: sung.url },
    })
    // Nobody else sees them, and the other course doesn't list them.
    expect((await library.pack('quin', 'es-ES')).covers).toEqual({ phrases: {}, songs: {} })
    expect((await library.pack(null, 'es-ES')).covers).toEqual({ phrases: {}, songs: {} })
    expect((await library.pack('pia', 'bg-BG')).covers).toEqual({ phrases: {}, songs: {} })
    // A new one replaces the old; a copy of the album keeps the song's.
    const redrawn = await library.generateCover('pia', { kind: 'phrase', attachTo: 'cafe-01' })
    expect((await library.pack('pia', 'es-ES')).covers.phrases['cafe-01']).toBe(redrawn.url)
    const albumCopy = await library.generateCover('pia', {
      kind: 'album',
      attachTo: 'album-loro-es',
    })
    const copied = (await library.album('pia', albumCopy.copy?.id)).songs[0]
    expect((await library.pack('pia', 'es-ES')).covers.songs[copied?.id ?? '']).toBe(sung.url)
    expect(await code(library.generateCover('pia', { kind: 'phrase', attachTo: 'nope-01' }))).toBe(
      'NOT_FOUND',
    )
    // Deleting everything takes them too.
    await library.deleteEverything('pia')
    expect((await library.pack('pia', 'es-ES')).covers).toEqual({ phrases: {}, songs: {} })
  })

  it('has the model draw a phrase’s cover for what it says', async () => {
    let asked = ''
    resetWriter(
      modelClient((_url, init) => {
        asked = typeof init?.body === 'string' ? init.body : ''
        return Promise.resolve(
          Response.json({
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    background: ['#FBE8D3', '#F4CDB0'],
                    angle: 90,
                    shapes: [
                      { kind: 'circle', cx: 256, cy: 256, r: 100, fill: '#C4562F', opacity: 1 },
                    ],
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
        )
      }),
    )
    try {
      const cover = await library.generateCover('rex', { kind: 'phrase', attachTo: 'cafe-01' })
      expect(cover).toMatchObject({ status: 'rendering', provider: 'ai' })
      await vi.waitFor(async () => {
        expect(await library.coverState(`${cover.id}.json`)).toMatchObject({
          status: 'ready',
          provider: 'ai',
        })
      })
      expect((await library.pack('rex', 'es-ES')).covers.phrases['cafe-01']).toBe(
        `/library/covers/${cover.id}.svg`,
      )
      // Drawn for the phrase's own words, never for text the app sent.
      const target = (await library.set(null, 'set-cafe')).phrases.find((p) => p.id === 'cafe-01')
      expect(asked).toContain(JSON.stringify(target?.target).slice(1, -1))
      expect(asked).toContain('one spoken phrase')
    } finally {
      resetWriter()
    }
  })

  describe('a deck written in the background (plan 111)', () => {
    const ask = { mode: 'topic', input: 'hotel', targetLang: 'es-ES', nativeLang: 'en-GB' }
    afterEach(() => {
      resetWriter()
    })
    const settled = async (userId: string, id: string) => {
      let state = await library.deck(userId, id)
      await vi.waitFor(async () => {
        state = await library.deck(userId, id)
        expect(state.status).not.toBe('writing')
      })
      return state
    }

    it("spends the allowance at once, then answers with the model's deck to the learner who asked", async () => {
      resetWriter(modelAnswering({ phrases: [writtenPhrase] }))
      const started = await library.startDeck('lea', ask)
      expect(started).toMatchObject({ status: 'writing' })
      expect((await library.usage('lea')).daily.phrases.used).toBe(1)
      const id = started.id!
      expect(await code(library.deck('max', id))).toBe('NOT_FOUND')
      const ready = await settled('lea', id)
      expect(ready).toMatchObject({ id, status: 'ready', provider: 'ai', themes: [] })
      expect(ready.status === 'ready' && ready.phrases.map((p) => p.target)).toEqual([
        writtenPhrase.target,
      ])
    })

    it('answers from the bank, giving the allowance back, when the model fails', async () => {
      resetWriter(modelFailing())
      const started = await library.startDeck('ned', ask)
      const ready = await settled('ned', started.id!)
      expect(ready).toMatchObject({ status: 'ready', provider: 'bank' })
      expect((await library.usage('ned')).daily.phrases.used).toBe(0)
    })

    it('refuses at once when the allowance is spent', async () => {
      resetWriter(modelAnswering({ phrases: [writtenPhrase] }))
      await library.startDeck('oli', ask)
      await library.startDeck('oli', ask)
      expect(await code(library.startDeck('oli', ask))).toBe('LIMIT_REACHED')
    })

    it('answers from the bank at once, with no job, without a model', async () => {
      resetWriter(null)
      const answered = await library.startDeck('pia', ask)
      expect(answered).toMatchObject({ id: null, status: 'ready', provider: 'bank' })
      expect((await library.usage('pia')).daily.phrases.used).toBe(0)
    })

    it('reads work lost with its process as failed', async () => {
      resetWriter({ generate: () => new Promise(() => undefined) })
      const started = await library.startDeck('quy', ask)
      const start = now
      now += 11 * 60_000
      try {
        expect(await library.deck('quy', started.id!)).toEqual({ id: started.id, status: 'failed' })
      } finally {
        now = start
      }
    })
  })

  describe('a cover drawn in the background (plan 111)', () => {
    const PNG = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(16, 3),
    ])
    let draw: (prompt: string) => Promise<Buffer>
    const prompts: string[] = []
    const images: ImageModel = {
      generate: async ({ prompt }) => {
        prompts.push(prompt)
        return { bytes: await draw(prompt), contentType: 'image/png' }
      },
    }
    const coverSet = async (userId: string) =>
      (
        await library.createSet(userId, {
          title: 'Faros',
          description: 'by the sea',
          targetLang: 'es-ES',
          nativeLang: 'en-GB',
          phrases: (await deck(userId)).slice(0, 1),
        })
      ).set
    afterEach(() => {
      resetArtist()
      resetWriter()
    })

    it('keeps the old cover until the illustration is ready, then puts it in its place', async () => {
      let finish!: (bytes: Buffer) => void
      draw = () => new Promise((resolve) => (finish = resolve))
      resetArtist(images)
      const set = await coverSet('ivy')
      // With `attachTo` the set's own words are drawn, never text the app sent.
      const cover = await library.generateCover('ivy', { kind: 'set', attachTo: set.id })
      expect(cover).toEqual({ id: cover.id, status: 'rendering', url: null, provider: 'ai' })
      expect(await library.coverState(`${cover.id}.json`)).toMatchObject({ status: 'rendering' })
      expect(await code(library.cover(`${cover.id}.svg`))).toBe('NOT_FOUND')
      expect((await library.set('ivy', set.id)).set.coverUrl).toBeNull()
      expect((await library.usage('ivy')).daily.cover.used).toBe(1)
      expect(prompts.at(-1)).toContain('"Faros", about: by the sea')
      expect(prompts.at(-1)).toContain('no text')
      finish(PNG)
      await vi.waitFor(async () => {
        expect(await library.coverState(`${cover.id}.json`)).toEqual({
          id: cover.id,
          status: 'ready',
          url: `/library/covers/${cover.id}.svg`,
          provider: 'ai',
        })
      })
      expect((await library.set('ivy', set.id)).set.coverUrl).toBe(
        `/library/covers/${cover.id}.svg`,
      )
      const svg = await library.cover(`${cover.id}.svg`)
      expect(svg).toContain(`href="data:image/png;base64,${PNG.toString('base64')}"`)
      // No script and no address but the SVG namespace: nothing loads from anywhere.
      expect(svg.replace('xmlns="http://www.w3.org/2000/svg"', '')).not.toMatch(
        /<script|xlink|https?:/,
      )
    })

    it('copies one of Loro’s sets at once, and the copy takes the illustration when it is ready', async () => {
      let finish!: (bytes: Buffer) => void
      draw = () => new Promise((resolve) => (finish = resolve))
      resetArtist(images)
      const cover = await library.generateCover('una', { kind: 'set', attachTo: 'set-cafe' })
      expect(cover).toMatchObject({ status: 'rendering', copy: { kind: 'set' } })
      const copyId = cover.copy?.id ?? ''
      expect((await library.set('una', copyId)).set.coverUrl).toBeNull()
      finish(PNG)
      await vi.waitFor(async () => {
        expect((await library.set('una', copyId)).set.coverUrl).toBe(
          `/library/covers/${cover.id}.svg`,
        )
      })
      // Loro's set is as it was, for everyone.
      expect((await library.set('una', 'set-cafe')).set.coverUrl).toBeNull()
    })

    it('designs shapes when the illustration fails, and draws the pattern when that fails too', async () => {
      draw = () => Promise.reject(new ProviderFailure('unavailable'))
      resetArtist(images)
      resetWriter(modelAnswering({ background: ['#fff', 'nope'], angle: 0, shapes: [] }))
      const set = await coverSet('jon')
      const cover = await library.generateCover('jon', {
        kind: 'set',
        title: 'Faros',
        attachTo: set.id,
      })
      await vi.waitFor(async () => {
        expect(await library.coverState(`${cover.id}.json`)).toMatchObject({
          status: 'ready',
          provider: 'pattern',
        })
      })
      expect((await library.set('jon', set.id)).set.coverUrl).toBe(
        `/library/covers/${cover.id}.svg`,
      )
      expect(await library.cover(`${cover.id}.svg`)).not.toContain('data:image')
    })

    it('reads work lost with its process as failed', async () => {
      draw = () => new Promise(() => undefined)
      resetArtist(images)
      const cover = await library.generateCover('kim', { kind: 'album', title: 'Lost' })
      const start = now
      now += 11 * 60_000
      try {
        expect(await library.coverState(`${cover.id}.json`)).toMatchObject({
          status: 'failed',
          url: null,
        })
      } finally {
        now = start
      }
    })
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

  it('sings a long set as a demo the gateway can carry, its lyrics ending with its sound', async () => {
    const { set } = await library.createSet('kim', {
      title: 'Muchas frases',
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
      phrases: Array.from({ length: 14 }, (_, i) => ({
        target: `Frase número ${i + 1}`,
        native: `Phrase number ${i + 1}`,
        source: 'written' as const,
      })),
    })
    const { song } = await library.generateSong('kim', {
      setId: set.id,
      styleId: 'gentle_ballad',
      nativeLang: 'en-GB',
    })
    await vi.waitFor(
      async () => {
        expect((await library.song('kim', song.id)).status).toBe('ready')
      },
      { timeout: 10_000 },
    )
    const ready = await library.song('kim', song.id)
    const lines = ready.sections.flatMap((s) => s.lines)
    // Fifteen lines of lyrics; a ballad's demo sings twelve of them in 4 MiB.
    expect(lines).toHaveLength(demoLineLimit('gentle_ballad'))
    expect(lines.every((l) => l.startMs !== null && l.endMs !== null)).toBe(true)
    expect(ready.sections.every((s) => s.lines.length > 0)).toBe(true)
    const url = new URL(`http://x${ready.audioUrl ?? ''}`)
    const audio = await library.songAudio('kim', song.id, {
      exp: url.searchParams.get('exp'),
      sig: url.searchParams.get('sig'),
    })
    expect(audio.bytes.byteLength).toBeLessThanOrEqual(MAX_DEMO_WAV_BYTES)
    expect(lines.at(-1)?.endMs).toBeLessThan(ready.durationMs ?? 0)
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

  it('lists Community by the most saved, with how many keep each', async () => {
    const make = async (who: string, title: string) =>
      (
        await library.createSet(who, {
          title,
          targetLang: 'es-ES',
          nativeLang: 'bg-BG',
          visibility: 'public',
          phrases: (await deck(who)).slice(0, 1),
        })
      ).set
    const older = await make('pop1', 'Older, loved')
    now += 1000
    const newer = await make('pop2', 'Newer, unsaved')
    for (const who of ['fan1', 'fan2']) await library.save(who, { kind: 'set', id: older.id })
    // The maker saving their own doesn't count.
    await library.save('pop2', { kind: 'set', id: newer.id })
    const ids = async (sort?: string) =>
      (await library.community(null, { target: 'es-ES', kind: 'sets', sort })).sets
        ?.filter((s) => s.id === older.id || s.id === newer.id)
        .map((s) => [s.id, s.savedBy])
    expect(await ids()).toEqual([
      [newer.id, 0],
      [older.id, 2],
    ])
    expect(await ids('popular')).toEqual([
      [older.id, 2],
      [newer.id, 0],
    ])
    expect(await code(library.community(null, { target: 'es-ES', sort: 'loud' }))).toBe(
      'VALIDATION_FAILED',
    )
  })

  it('offers more of a maker’s public things from one of theirs', async () => {
    const phrases = (await deck('mia')).slice(0, 1)
    const make = async (title: string, visibility: 'public' | 'private') =>
      (
        await library.createSet('mia', {
          title,
          targetLang: 'es-ES',
          nativeLang: 'bg-BG',
          visibility,
          phrases,
        })
      ).set
    const first = await make('First', 'public')
    const second = await make('Second', 'public')
    await make('Hidden away', 'private')
    const more = await library.moreSetsByMaker(null, first.id)
    expect(more.sets.map((s) => s.id)).toEqual([second.id])
    expect(more.phrases.every((p) => p.setId === second.id)).toBe(true)
    expect((await library.moreSetsByMaker(null, 'set-cafe')).sets).toEqual([])
    const { album, song } = await library.generateSong('mia', {
      setId: first.id,
      styleId: 'modern_pop',
      nativeLang: 'en-GB',
    })
    await library.updateAlbum('mia', album.id, { visibility: 'public' })
    const other = (
      await library.createAlbum('mia', {
        title: 'Empty',
        targetLang: 'es-ES',
        visibility: 'public',
      })
    ).album
    await vi.waitFor(
      async () => {
        expect((await library.song('mia', song.id)).status).toBe('ready')
      },
      { timeout: 5000 },
    )
    // An album with nothing to hear isn't offered.
    expect((await library.moreAlbumsByMaker(null, other.id)).albums.map((a) => a.id)).toEqual([
      album.id,
    ])
    expect((await library.moreAlbumsByMaker(null, album.id)).albums).toEqual([])
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
    const flagged = async (userId: string) =>
      (await library.pack(userId, 'es-ES')).sets.find((s) => s.id === set.id)?.hidden
    expect(await flagged('lou')).toBeUndefined()
    await library.report('oli', { kind: 'set', id: set.id, reason: 'offensive' })
    expect(await listed()).toBe(false)
    expect((await library.set(null, set.id)).set.id).toBe(set.id)
    // Only the owner is told why it left Community.
    expect(await flagged('lou')).toBe(true)
    await library.save('max', { kind: 'set', id: set.id })
    expect(await flagged('max')).toBeUndefined()
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
      'PROVIDER_UNAVAILABLE',
    )
    expect(await code(speech.clip('../etc/passwd'))).toBe('NOT_FOUND')
    // The day's renders are bounded.
    const others = (await library.set(null, 'set-tapas')).phrases.map(
      (p) => `${utteranceId('es-ES', p.target)}.mp3`,
    )
    await speech.clip(others[0] ?? '')
    expect(await code(speech.clip(others[1] ?? ''))).toBe('PROVIDER_UNAVAILABLE')
    // A refused render costs nothing and isn't retried at once.
    vi.stubEnv('LIMIT_SPEECH_RENDERS_DAILY', '3')
    let refused = 0
    const failing = new SpeechService(
      database,
      { now: () => now },
      {
        synthesize: () => {
          refused += 1
          return Promise.reject(new Error('refused'))
        },
      },
      runtime,
    )
    const fresh = (await library.set(null, 'set-market')).phrases.map(
      (p) => `${utteranceId('es-ES', p.target)}.mp3`,
    )
    expect(await code(failing.clip(fresh[0] ?? ''))).toBe('PROVIDER_UNAVAILABLE')
    expect(await code(failing.clip(fresh[0] ?? ''))).toBe('PROVIDER_UNAVAILABLE')
    expect(refused).toBe(1)
    // The refused render gave its try back: one more clip still fits today's three.
    await speech.clip(fresh[1] ?? '')
    expect(renders).toBe(3)
    // Deleting songs never takes a phrase's clip with it.
    const { album } = await library.generateSong('pia', {
      setId: 'set-cafe',
      styleId: 'modern_pop',
      nativeLang: 'en-GB',
    })
    await library.deleteAlbum('pia', album.id)
    await speech.clip(file)
    expect(renders).toBe(3)
    vi.stubEnv('LIMIT_SPEECH_RENDERS_DAILY', '500')
  })

  it('writes notes by the rules without a model, for free, and for a typed phrase stored without them', async () => {
    const before = await library.usage('rufus')
    const written = await library.generateNotes('rufus', {
      target: '¿Dónde está la estación?',
      native: 'Где вокзал?',
      targetLang: 'es-ES',
      nativeLang: 'ru-RU',
    })
    expect(written.provider).toBe('rules')
    expect(written.notes.pronunciation.ipa).toMatch(/^\[.+\]$/)
    expect(written.image.length).toBeGreaterThan(0)
    expect((await library.usage('rufus')).daily.phrases.used).toBe(before.daily.phrases.used)
    const { phrases } = await library.createSet('rufus', {
      title: 'Typed',
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
      visibility: 'private',
      phrases: [{ target: 'Tengo un perro', native: 'I have a dog', source: 'written' }],
    })
    expect(phrases[0]?.notesBy).toBe('rules')
    expect(phrases[0]?.notes.grammar.text.length).toBeGreaterThan(0)
    expect(phrases[0]?.image.length).toBeGreaterThan(0)
  })

  it('lists Loro’s phrases and the learner’s own by reference, one phrase with one progress', async () => {
    const typed = { target: 'Tengo un gato', native: 'I have a cat', source: 'written' as const }
    const { set, phrases } = await library.createSet('lena', {
      title: 'Mixed',
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
      phrases: [{ ref: 'cafe-03' }, typed],
    })
    expect(set.phraseIds[0]).toBe('cafe-03')
    expect(phrases.find((p) => p.id === 'cafe-03')?.setId).toBe('set-cafe')
    const own = set.phraseIds[1] ?? ''
    // Another set of hers lists her phrase: still one phrase, in the pack once.
    const other = await library.createSet('lena', {
      title: 'Cats',
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
      phrases: [{ ref: own }],
    })
    expect(other.set.phraseIds).toEqual([own])
    const pack = await library.pack('lena', 'es-ES')
    expect(pack.phrases.filter((p) => p.id === own)).toHaveLength(1)
    expect(pack.phrases.filter((p) => p.id === 'cafe-03')).toHaveLength(1)
    // Someone else's phrase, or one of another course, is not hers to list.
    expect(
      await code(
        library.createSet('otto', {
          title: 'Taken',
          targetLang: 'es-ES',
          nativeLang: 'en-GB',
          phrases: [{ ref: own }],
        }),
      ),
    ).toBe('VALIDATION_FAILED')
    const bg = (await library.pack(null, 'bg-BG')).phrases[0]?.id ?? ''
    expect(await code(library.updateSet('lena', set.id, { addPhrases: [{ ref: bg }] }))).toBe(
      'VALIDATION_FAILED',
    )
    // Taken out of the set that holds it, her phrase moves to the one that lists it.
    await library.updateSet('lena', set.id, { removePhraseIds: [own] })
    const moved = await library.set('lena', other.set.id)
    expect(moved.set.phraseIds).toEqual([own])
    expect(moved.phrases[0]?.setId).toBe(other.set.id)
    // Reordered, and emptied: a set may be empty.
    await library.updateSet('lena', set.id, { addPhrases: [{ ref: 'cafe-01' }] })
    expect(
      (await library.updateSet('lena', set.id, { order: ['cafe-01', 'cafe-03'] })).set.phraseIds,
    ).toEqual(['cafe-01', 'cafe-03'])
    expect(
      (await library.updateSet('lena', set.id, { removePhraseIds: ['cafe-01', 'cafe-03'] })).set
        .phraseIds,
    ).toEqual([])
    // Loro's phrase is still Loro's.
    expect((await library.set(null, 'set-cafe')).set.phraseIds).toContain('cafe-03')
    // Deleting the set that now holds her phrase takes it: nothing else lists it.
    await library.deleteSet('lena', other.set.id)
    expect((await library.pack('lena', 'es-ES')).phrases.some((p) => p.id === own)).toBe(false)
  })

  it('uploads a device’s sets once, keeping the device’s ids', async () => {
    const upload = {
      id: 'mine-s-dev1.a1-2',
      title: 'From my phone',
      targetLang: 'es-ES',
      nativeLang: 'bg-BG',
      phrases: [
        { id: 'mine-p-dev1.a1-1', target: 'Mi casa', native: 'Моята къща', source: 'written' },
        { ref: 'cafe-02' },
      ],
    }
    const first = await library.createSet('dora', upload)
    expect(first.set.id).toBe('mine-s-dev1.a1-2')
    expect(first.set.phraseIds).toEqual(['mine-p-dev1.a1-1', 'cafe-02'])
    expect(first.phrases[0]?.notesBy).toBe('rules')
    // Uploaded again (a sign-in cut short): the same set, nothing twice.
    const again = await library.createSet('dora', upload)
    expect(again.set.phraseIds).toEqual(first.set.phraseIds)
    expect((await library.pack('dora', 'es-ES')).sets.filter((s) => s.owner === 'me')).toHaveLength(
      1,
    )
    // A second device set with the same phrase lists it.
    const second = await library.createSet('dora', {
      ...upload,
      id: 'mine-s-dev1.a1-3',
      title: 'Also',
      phrases: [
        { id: 'mine-p-dev1.a1-1', target: 'Mi casa', native: 'Моята къща', source: 'written' },
      ],
    })
    expect(second.set.phraseIds).toEqual(['mine-p-dev1.a1-1'])
    // Another learner's device id that happens to match is not theirs: a new id.
    const clash = await library.createSet('ezra', { ...upload, title: 'Clash' })
    expect(clash.set.id).not.toBe('mine-s-dev1.a1-2')
    expect(clash.set.phraseIds[0]).not.toBe('mine-p-dev1.a1-1')
  })

  it('keeps phrases added on their own in one “My phrases” set per course, and edits them', async () => {
    const add = (target: string) =>
      library.addPhrase('finn', {
        phrase: { target, native: target, source: 'written' },
        targetLang: 'es-ES',
        nativeLang: 'en-GB',
        inboxTitle: 'My phrases',
      })
    const [a, b] = await Promise.all([add('Hola amigo'), add('Buenas noches')])
    expect(a.set.id).toBe(b.set.id)
    const inbox = await library.set('finn', a.set.id)
    expect(inbox.set.inbox).toBe(true)
    expect(inbox.set.title).toBe('My phrases')
    expect(inbox.set.phraseIds).toHaveLength(2)
    const id = inbox.set.phraseIds[0] ?? ''
    const edited = await library.editPhrase('finn', a.set.id, id, {
      target: 'Hola, amiga',
      native: 'Hi, friend',
    })
    const phrase = edited.phrases.find((p) => p.id === id)
    expect(phrase?.target).toBe('Hola, amiga')
    expect(phrase?.translations['en-GB']).toBe('Hi, friend')
    expect(phrase?.notesBy).toBe('rules')
    expect(await code(library.editPhrase('otto', a.set.id, id, { target: 'x', native: 'y' }))).toBe(
      'NOT_FOUND',
    )
    // Into a set of hers, when she says which.
    const typed = await library.addPhrase('finn', {
      phrase: { target: 'Un café', native: 'A coffee', source: 'written' },
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
      setId: (
        await library.createSet('finn', {
          title: 'Café',
          targetLang: 'es-ES',
          nativeLang: 'en-GB',
          phrases: [],
        })
      ).set.id,
      inboxTitle: 'My phrases',
    })
    expect(typed.set.inbox).toBeUndefined()
    expect(typed.set.phraseIds).toHaveLength(1)
    // Deleted, a phrase leaves every set of hers that listed it; it is hers alone to delete.
    const listed = await library.updateSet('finn', typed.set.id, { addPhrases: [{ ref: id }] })
    expect(listed.set.phraseIds).toContain(id)
    expect(await code(library.deletePhrase('otto', id))).toBe('NOT_FOUND')
    await library.deletePhrase('finn', id)
    expect((await library.set('finn', typed.set.id)).set.phraseIds).not.toContain(id)
    expect((await library.set('finn', a.set.id)).set.phraseIds).not.toContain(id)
  })

  it('makes “My phrases” only within the kept-sets cap, and keeps filling one already made', async () => {
    const add = (userId: string, target: string, setId?: string) =>
      library.addPhrase(userId, {
        phrase: { target, native: target, source: 'written' },
        targetLang: 'es-ES',
        nativeLang: 'en-GB',
        inboxTitle: 'My phrases',
        ...(setId ? { setId } : {}),
      })
    const make = (userId: string, title: string) =>
      library.createSet(userId, { title, targetLang: 'es-ES', nativeLang: 'en-GB', phrases: [] })
    // Two sets and "My phrases" reach the cap of three; it still takes phrases afterwards.
    await make('uma', 'Uno')
    await make('uma', 'Dos')
    const inbox = await add('uma', 'Hola')
    expect((await library.usage('uma')).kept.sets).toEqual({ used: 3, limit: 3 })
    expect((await add('uma', 'Adiós')).set.id).toBe(inbox.set.id)
    // At the cap without one, a phrase on its own is refused; into a set she has, it is kept.
    const sets = await Promise.all(['Uno', 'Dos', 'Tres'].map((title) => make('val', title)))
    expect(await code(add('val', 'Hola'))).toBe('LIMIT_REACHED')
    expect((await library.usage('val')).kept.sets.used).toBe(3)
    expect((await add('val', 'Hola', sets[0]?.set.id)).set.phraseIds).toHaveLength(1)
  })

  it('gives bank phrases and written suggestions clips, English prompts included', async () => {
    vi.stubEnv('TTS_PROVIDER', 'elevenlabs')
    vi.stubEnv('TTS_API_KEY', 'k')
    vi.stubEnv('TTS_MODEL', 'm')
    vi.stubEnv('TTS_VOICE_ES_ES', 'v-es')
    vi.stubEnv('TTS_VOICE_EN_GB', 'v-en')
    vi.stubEnv('LIMIT_PHRASES_DAILY', '50')
    try {
      const pack = await library.pack(null, 'es-ES')
      const bank = pack.bank.phrases[0]
      expect(Object.keys(bank?.audio ?? {}).sort()).toEqual(['en-GB', 'es-ES'])
      expect(pack.phrases[0]?.audio?.['en-GB']).toMatch(/^\/library\/speech\/[0-9a-f]{32}\.mp3\?v=/)
      const deck = await library.generatePhrases('suggested', {
        mode: 'topic',
        input: 'hotel',
        targetLang: 'es-ES',
        nativeLang: 'en-GB',
        count: 2,
      })
      const first = deck.phrases[0]
      expect(first?.audio?.['es-ES']).toBe(
        speechFor(
          {
            provider: 'elevenlabs',
            apiKey: 'k',
            model: 'm',
            outputFormat: 'mp3',
            voices: { 'es-ES': 'v-es' },
            stubRender: false,
          },
          { 'es-ES': first?.target ?? '' },
        )['es-ES'],
      )
      // What was suggested may be spoken: its utterance is the library's now.
      const spoken = await database.query<{ owner_id: string | null }>(
        'SELECT owner_id FROM library_speech WHERE id = $1',
        [utteranceId('en-GB', first?.native ?? '')],
      )
      expect(spoken.rows).toHaveLength(1)
    } finally {
      vi.stubEnv('TTS_PROVIDER', 'stub')
      vi.stubEnv('LIMIT_PHRASES_DAILY', '2')
    }
  })

  it('counts a learner’s phrase clips against their own day as well as the server’s', async () => {
    vi.stubEnv('LIMIT_SPEECH_OWNER_DAILY', '1')
    const transport = {
      synthesize: ({ text }: { text: string }) =>
        Promise.resolve({
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
        }),
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
    const written = (target: string) => ({
      target,
      native: 'x',
      image: ['forum'],
      source: 'written' as const,
      notes: {
        mnemonic: { title: 't', text: 't' },
        grammar: { title: 't', text: 't' },
        pronunciation: { title: 't', text: 't', ipa: '[a]', respelling: 'a' },
      },
    })
    await library.createSet('quin', {
      title: 'Q',
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
      phrases: [written('Una frase de Quin'), written('Otra frase de Quin')],
    })
    await speech.clip(`${utteranceId('es-ES', 'Una frase de Quin')}.mp3`)
    expect(await code(speech.clip(`${utteranceId('es-ES', 'Otra frase de Quin')}.mp3`))).toBe(
      'PROVIDER_UNAVAILABLE',
    )
    vi.stubEnv('LIMIT_SPEECH_OWNER_DAILY', '100')
  })

  it('speaks a demo song’s lines when the server has a voice for its language', async () => {
    let spoken = 0
    const pcm = {
      synthesize: () => {
        spoken += 1
        return Promise.resolve({
          bytes: new Uint8Array(new Int16Array(8000).fill(12_000).buffer),
          contentType: 'audio/pcm',
          provenance: {
            provider: 'elevenlabs' as const,
            model: 'm',
            voiceId: 'v-es',
            outputFormat: 'pcm_22050',
            locale: 'es-ES',
          },
          characterCount: 4,
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
    const unused = { synthesize: () => Promise.reject(new Error('not used')) }
    const voiced = new LibraryService(
      database,
      { now: () => now },
      new SpeechService(database, { now: () => now }, unused, runtime, pcm),
    )
    const { song } = await voiced.generateSong('rae', {
      setId: 'set-transit',
      styleId: 'acoustic_folk',
      nativeLang: 'en-GB',
    })
    await vi.waitFor(
      async () => {
        expect((await voiced.song('rae', song.id)).status).toBe('ready')
      },
      { timeout: 5000 },
    )
    const ready = await voiced.song('rae', song.id)
    expect(ready.voiced).toBe(true)
    expect(ready.audioBy).toBe('demo')
    // Each distinct line is spoken once, however often the chorus repeats it.
    const distinct = new Set(
      ready.sections.flatMap((section) => section.lines.map((line) => line.text)),
    )
    expect(spoken).toBe(distinct.size)
    // Without a voice for the language, the song is the plain demo.
    const { song: plain } = await library.generateSong('rae', {
      setId: 'set-market',
      styleId: 'acoustic_folk',
      nativeLang: 'en-GB',
    })
    await vi.waitFor(
      async () => {
        expect((await library.song('rae', plain.id)).status).toBe('ready')
      },
      { timeout: 5000 },
    )
    expect((await library.song('rae', plain.id)).voiced).toBe(false)
  })

  it('deletes everything a learner keeps, and nobody else’s', async () => {
    const phrases = (await deck('sam')).slice(0, 1)
    const { set } = await library.createSet('sam', {
      title: 'Mine',
      targetLang: 'es-ES',
      nativeLang: 'bg-BG',
      visibility: 'public',
      phrases,
    })
    const { album } = await library.generateSong('sam', {
      setId: set.id,
      styleId: 'modern_pop',
      nativeLang: 'en-GB',
    })
    await library.save('tom', { kind: 'set', id: set.id })
    await library.setProfile('sam', { displayName: 'Sam' })
    const progress = new ProgressService(database, { now: () => now })
    await progress.write('sam', { progress: { log: [] }, baseRevision: 0 })
    await vi.waitFor(
      async () => {
        expect((await library.album('sam', album.id)).songs[0]?.status).toBe('ready')
      },
      { timeout: 5000 },
    )
    await library.deleteEverything('sam')
    expect(await code(library.set('sam', set.id))).toBe('NOT_FOUND')
    expect(await code(library.album('sam', album.id))).toBe('NOT_FOUND')
    expect((await library.pack('tom', 'es-ES')).sets.map((s) => s.id)).not.toContain(set.id)
    expect((await progress.read('sam')).progress).toBeNull()
    expect(await library.profile('sam')).toEqual({ displayName: null })
    expect((await library.pack(null, 'es-ES')).sets.map((s) => s.id)).toContain('set-cafe')
    // Deleting your things doesn't give the day's generations back.
    expect((await library.usage('sam')).daily.song.used).toBe(1)
  })

  it('deletes an account with its sign-in, synced rows and allowance use', async () => {
    await database.query('INSERT INTO auth_users(id, created_at) VALUES ($1, $2)', ['vic', now])
    await database.query(
      "INSERT INTO auth_identities(provider, subject, user_id) VALUES ('email', 'vic-hash', 'vic')",
    )
    await database.query("INSERT INTO sync_heads(user_id, revision) VALUES ('vic', 3)")
    const phrases = (await deck('vic')).slice(0, 1)
    const { set } = await library.createSet('vic', {
      title: 'Gone',
      targetLang: 'es-ES',
      nativeLang: 'bg-BG',
      visibility: 'private',
      phrases,
    })
    await library.deleteAccount('vic')
    const count = async (sql: string) =>
      Number((await database.query<{ n: string }>(sql, ['vic'])).rows[0]?.n)
    expect(await count('SELECT count(*) AS n FROM auth_users WHERE id = $1')).toBe(0)
    expect(await count('SELECT count(*) AS n FROM auth_identities WHERE user_id = $1')).toBe(0)
    expect(await count('SELECT count(*) AS n FROM sync_heads WHERE user_id = $1')).toBe(0)
    expect(await count('SELECT count(*) AS n FROM library_usage WHERE user_id = $1')).toBe(0)
    expect(await code(library.set('vic', set.id))).toBe('NOT_FOUND')
  })

  it('gives a failed song back, makes it again on request, and removes it', async () => {
    const store = vi
      .spyOn(library as unknown as { storeAudio: () => Promise<string> }, 'storeAudio')
      .mockRejectedValueOnce(new Error('disk full'))
    const { song, album } = await library.generateSong('wes', {
      setId: 'set-cafe',
      styleId: 'modern_pop',
      nativeLang: 'en-GB',
    })
    await vi.waitFor(
      async () => {
        expect((await library.song('wes', song.id)).status).toBe('failed')
      },
      { timeout: 5000 },
    )
    store.mockRestore()
    expect((await library.usage('wes')).daily.song.used).toBe(0)
    // Only its owner, and only once it failed.
    expect(await code(library.retrySong('xan', song.id, { nativeLang: 'en-GB' }))).toBe('NOT_FOUND')
    const again = await library.retrySong('wes', song.id, { nativeLang: 'en-GB' })
    expect(again.status).toBe('rendering')
    await vi.waitFor(
      async () => {
        expect((await library.song('wes', song.id)).status).toBe('ready')
      },
      { timeout: 5000 },
    )
    expect((await library.usage('wes')).daily.song.used).toBe(1)
    expect(await code(library.retrySong('wes', song.id, { nativeLang: 'en-GB' }))).toBe(
      'VALIDATION_FAILED',
    )
    await library.deleteSong('wes', song.id)
    expect((await library.album('wes', album.id)).songs).toEqual([])
    expect(await code(library.song('wes', song.id))).toBe('NOT_FOUND')
  })

  it('lists shared albums with songs even behind a page of newer empty ones', async () => {
    const { album, song } = await library.generateSong('yan', {
      setId: 'set-market',
      styleId: 'modern_pop',
      nativeLang: 'en-GB',
    })
    await library.updateAlbum('yan', album.id, { title: 'Market songs', visibility: 'public' })
    await vi.waitFor(
      async () => {
        expect((await library.song('yan', song.id)).status).toBe('ready')
      },
      { timeout: 5000 },
    )
    for (let n = 0; n < 50; n++)
      await database.query(
        `INSERT INTO library_albums(id, owner_id, target_lang, title, description, cover_id, visibility, share_code, origin, position, created_at, updated_at)
         VALUES ($1, 'zed', 'es-ES', 'Empty', NULL, NULL, 'public', $2, 'user', 0, $3, $3)`,
        [`album-empty-${n}`, `empty${n}`, now + 1000 + n],
      )
    const listed = await library.community(null, { target: 'es-ES', kind: 'albums', q: 'market' })
    expect(listed.albums?.map((a) => a.id)).toEqual([album.id])
    expect(
      (await library.community(null, { target: 'es-ES', kind: 'albums' })).albums?.map((a) => a.id),
    ).toContain(album.id)
  })

  it('lists the songs of a set that the reader may hear', async () => {
    const { song, album } = await library.generateSong('uma', {
      setId: 'set-sobremesa',
      styleId: 'gentle_ballad',
      nativeLang: 'en-GB',
    })
    await vi.waitFor(
      async () => {
        expect((await library.song('uma', song.id)).status).toBe('ready')
      },
      { timeout: 5000 },
    )
    const loroSong = 'song-loro-sobremesa'
    // A set's cover knows it holds songs: Loro's song counts for any reader.
    const count = async (reader: string | null) =>
      (await library.pack(reader, 'es-ES')).sets.find((x) => x.id === 'set-sobremesa')?.songCount
    expect(await count(null)).toBe(1)
    expect((await library.songsOfSet('uma', 'set-sobremesa')).songs.map((s) => s.id)).toEqual([
      loroSong,
      song.id,
    ])
    // Uma's album is private: someone else hears only Loro's.
    expect((await library.songsOfSet('vic', 'set-sobremesa')).songs.map((s) => s.id)).toEqual([
      loroSong,
    ])
    await library.updateAlbum('uma', album.id, { visibility: 'public' })
    expect((await library.songsOfSet(null, 'set-sobremesa')).albums.map((a) => a.id)).toContain(
      album.id,
    )
    // Out of Community after three reports, and off the set's page too, but not for its owner.
    for (const who of ['r1', 'r2', 'r3'])
      await library.report(who, { kind: 'album', id: album.id, reason: 'offensive' })
    expect((await library.songsOfSet(null, 'set-sobremesa')).songs.map((s) => s.id)).toEqual([
      loroSong,
    ])
    expect((await library.songsOfSet('uma', 'set-sobremesa')).songs.map((s) => s.id)).toContain(
      song.id,
    )
  })

  it('makes a song lost to a restart again without spending another', async () => {
    const { song } = await library.generateSong('zoe', {
      setId: 'set-taxi',
      styleId: 'modern_pop',
      nativeLang: 'en-GB',
    })
    await vi.waitFor(
      async () => {
        expect((await library.song('zoe', song.id)).status).toBe('ready')
      },
      { timeout: 5000 },
    )
    // As if the server stopped while making it, long ago.
    await database.query(
      "UPDATE library_songs SET status = 'rendering', created_at = $2 WHERE id = $1",
      [song.id, now - 3_600_000],
    )
    expect((await library.song('zoe', song.id)).status).toBe('failed')
    expect(await code(library.deleteSong('zoe', 'song-none'))).toBe('NOT_FOUND')
    await library.retrySong('zoe', song.id, { nativeLang: 'en-GB' })
    // A second tap while it is being made is refused, and nothing more is spent.
    expect(await code(library.retrySong('zoe', song.id, { nativeLang: 'en-GB' }))).toBe(
      'VALIDATION_FAILED',
    )
    expect(await code(library.deleteSong('zoe', song.id))).toBe('VALIDATION_FAILED')
    expect((await library.usage('zoe')).daily.song.used).toBe(1)
    await vi.waitFor(
      async () => {
        expect((await library.song('zoe', song.id)).status).toBe('ready')
      },
      { timeout: 5000 },
    )
  })
})
