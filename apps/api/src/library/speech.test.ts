/** P3-01: a phrase's clip made on demand, asked about while it renders. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SqlConnection, SqlDatabase, SqlResult } from '../database/database.js'
import { SpeechService, silentLanguages, utteranceId } from './speech.js'

interface Row {
  id: string
  lang: string
  text: string
  voice_id: string | null
  model: string | null
  audio_id: string | null
  failed_at: number | null
  owner_id: string | null
}

/** Just the statements speech.ts sends, kept in memory. */
function memoryDatabase(rows: Row[]) {
  const speech = new Map(rows.map((r) => [r.id, r]))
  const audio = new Map<string, { body: Buffer; content_type: string }>()
  const usage = new Map<string, number>()
  const result = <T>(found: unknown[]): SqlResult<T> => ({
    rows: found as T[],
    rowCount: found.length,
  })
  const connection: SqlConnection = {
    query<T>(sql: string, values: readonly unknown[] = []): Promise<SqlResult<T>> {
      const v = values as unknown[]
      if (sql.startsWith('SELECT * FROM library_speech'))
        return Promise.resolve(
          result<T>(speech.has(v[0] as string) ? [{ ...speech.get(v[0] as string) }] : []),
        )
      if (sql.startsWith('SELECT body')) {
        const found = audio.get(v[0] as string)
        return Promise.resolve(result<T>(found ? [found] : []))
      }
      if (sql.startsWith('INSERT INTO library_usage')) {
        const key = `${String(v[0])}:${String(v[1])}`
        const used = usage.get(key) ?? 0
        if (used >= Number(v[2])) return Promise.resolve(result<T>([]))
        usage.set(key, used + 1)
        return Promise.resolve(result<T>([{ used: used + 1 }]))
      }
      if (sql.startsWith('UPDATE library_usage')) {
        const key = `${String(v[0])}:${String(v[1])}`
        usage.set(key, Math.max(0, (usage.get(key) ?? 0) - 1))
        return Promise.resolve(result<T>([]))
      }
      if (sql.startsWith('INSERT INTO library_audio')) {
        audio.set(v[0] as string, { content_type: v[1] as string, body: v[3] as Buffer })
        return Promise.resolve(result<T>([]))
      }
      if (sql.startsWith('UPDATE library_speech SET failed_at')) {
        const row = speech.get(v[0] as string)
        if (row) row.failed_at = v[1] as number
        return Promise.resolve(result<T>([]))
      }
      if (sql.startsWith('UPDATE library_speech SET voice_id')) {
        const row = speech.get(v[0] as string)
        if (row)
          Object.assign(row, { voice_id: v[1], model: v[2], audio_id: v[3], failed_at: null })
        return Promise.resolve(result<T>([]))
      }
      throw new Error(`unexpected statement: ${sql}`)
    },
  }
  const db: SqlDatabase = {
    ...connection,
    transaction: (work) => work(connection),
    ready: () => Promise.resolve(true),
  }
  return { db, usage }
}

const runtime = {
  provider: 'elevenlabs' as const,
  apiKey: 'k',
  model: 'm',
  outputFormat: 'mp3',
  voices: { 'es-ES': 'v-es' },
  stubRender: false,
}

function utterance(text: string, owner: string | null = null): Row {
  return {
    id: utteranceId('es-ES', text),
    lang: 'es-ES',
    text,
    voice_id: null,
    model: null,
    audio_id: null,
    failed_at: null,
    owner_id: owner,
  }
}

/** A voice whose renders finish when the test says so. */
function heldVoice() {
  const waiting: { text: string; finish: (ok: boolean, code?: string) => void }[] = []
  return {
    waiting,
    transport: {
      synthesize: ({ text }: { text: string }) =>
        new Promise<never>((resolve, reject) => {
          waiting.push({
            text,
            finish: (ok, code) => {
              if (!ok) {
                reject(Object.assign(new Error('no'), { code }))
                return
              }
              resolve({
                bytes: new TextEncoder().encode(`mp3:${text}`),
                contentType: 'audio/mpeg',
                provenance: {
                  provider: 'elevenlabs',
                  model: 'm',
                  voiceId: 'v-es',
                  outputFormat: 'mp3',
                  locale: 'es-ES',
                },
                characterCount: text.length,
              } as never)
            },
          })
        }),
    },
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('a clip made on demand', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('starts rendering when asked about, once however many ask, then is ready', async () => {
    const hola = utterance('Hola')
    const { db } = memoryDatabase([hola])
    const voice = heldVoice()
    const speech = new SpeechService(db, { now: () => 0 }, voice.transport, runtime)
    const state = `${hola.id}.json`
    expect(await speech.clipState(state)).toEqual({ status: 'rendering' })
    expect(await speech.clipState(state)).toEqual({ status: 'rendering' })
    // The clip itself, asked for meanwhile, waits on the same render.
    const clip = speech.clip(`${hola.id}.mp3`)
    await settle()
    expect(voice.waiting).toHaveLength(1)
    voice.waiting[0]?.finish(true)
    expect(new TextDecoder().decode((await clip).bytes)).toBe('mp3:Hola')
    expect(await speech.clipState(state)).toEqual({ status: 'ready' })
    expect(voice.waiting).toHaveLength(1)
  })

  it('answers failed for text it doesn’t hold, a language without a voice, and a bad name', async () => {
    const { db } = memoryDatabase([{ ...utterance('Hello'), lang: 'en-GB' }])
    const speech = new SpeechService(db, { now: () => 0 }, heldVoice().transport, runtime)
    expect(await speech.clipState(`${utteranceId('es-ES', 'Secret')}.json`)).toEqual({
      status: 'failed',
    })
    expect(await speech.clipState(`${utteranceId('en-GB', 'Hello')}.json`)).toEqual({
      status: 'failed',
    })
    await expect(speech.clipState('../x.json')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('without a provider says the clip can’t be made', async () => {
    const hola = utterance('Hola')
    const { db } = memoryDatabase([hola])
    const speech = new SpeechService(db, { now: () => 0 }, heldVoice().transport, null)
    expect(await speech.clipState(`${hola.id}.json`)).toEqual({ status: 'failed' })
  })

  it('a render that fails says so, gives its try back, and is tried again later', async () => {
    const hola = utterance('Hola', 'pia')
    const { db, usage } = memoryDatabase([hola])
    const voice = heldVoice()
    let now = 0
    const speech = new SpeechService(db, { now: () => now }, voice.transport, runtime)
    const state = `${hola.id}.json`
    expect(await speech.clipState(state)).toEqual({ status: 'rendering' })
    await settle()
    voice.waiting[0]?.finish(false, 'capacity')
    await settle()
    await settle()
    // Busy three times over: each try waits a moment and asks again.
    for (let i = 1; i < 3; i++) {
      await vi.waitFor(
        () => {
          expect(voice.waiting).toHaveLength(i + 1)
        },
        { timeout: 3000 },
      )
      voice.waiting[i]?.finish(false, 'capacity')
    }
    await vi.waitFor(async () => {
      expect(await speech.clipState(state)).toEqual({ status: 'failed' })
    })
    expect([...usage.values()]).toEqual([0, 0])
    now += 31_000
    expect(await speech.clipState(state)).toEqual({ status: 'rendering' })
  })

  it('a refused render isn’t asked for again for hours', async () => {
    const hola = utterance('Hola')
    const { db } = memoryDatabase([hola])
    const voice = heldVoice()
    let now = 0
    const speech = new SpeechService(db, { now: () => now }, voice.transport, runtime)
    const state = `${hola.id}.json`
    await speech.clipState(state)
    await settle()
    voice.waiting[0]?.finish(false, 'voice_not_found')
    await vi.waitFor(async () => {
      expect(await speech.clipState(state)).toEqual({ status: 'failed' })
    })
    now += 60_000
    expect(await speech.clipState(state)).toEqual({ status: 'failed' })
    expect(voice.waiting).toHaveLength(1)
  })

  it('the day’s renders used up: the clip answers failed rather than rendering', async () => {
    vi.stubEnv('LIMIT_SPEECH_RENDERS_DAILY', '0')
    const hola = utterance('Hola')
    const { db } = memoryDatabase([hola])
    const voice = heldVoice()
    const speech = new SpeechService(db, { now: () => 0 }, voice.transport, runtime)
    const state = `${hola.id}.json`
    expect(await speech.clipState(state)).toEqual({ status: 'rendering' })
    await vi.waitFor(async () => {
      expect(await speech.clipState(state)).toEqual({ status: 'failed' })
    })
    expect(voice.waiting).toHaveLength(0)
  })
})

describe('silentLanguages', () => {
  it('names every language Loro offers that has no voice, so a deploy shows it', () => {
    expect(silentLanguages(runtime)).toEqual(['en-GB', 'en-US', 'bg-BG', 'ru-RU', 'pl-PL', 'cs-CZ'])
    const voices = Object.fromEntries(
      ['en-GB', 'en-US', 'es-ES', 'bg-BG', 'ru-RU', 'pl-PL', 'cs-CZ'].map((l) => [l, `v-${l}`]),
    )
    expect(silentLanguages({ ...runtime, voices })).toEqual([])
    expect(silentLanguages({ ...runtime, voices: { ...voices, 'pl-PL': ' ' } })).toEqual(['pl-PL'])
  })

  it('says nothing without a provider: then no language has clips by design', () => {
    expect(silentLanguages(null)).toEqual([])
    expect(silentLanguages({ ...runtime, provider: 'stub' } as never)).toEqual([])
  })
})
