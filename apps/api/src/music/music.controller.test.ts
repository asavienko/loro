import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { LoroError } from '../common/errors.js'
import { ProblemDetailsFilter } from '../common/problem-filter.js'
import { AuthGuard } from '../auth/auth.guard.js'
import { AuthService } from '../auth/auth.service.js'
import { MusicController } from './music.controller.js'
import { MusicService } from './music.service.js'
import { MUSIC_REPOSITORY, MemoryMusicRepository } from './repository.js'

const principalA = { userId: 'account-a', deviceId: 'device-a', sessionId: 'session-a' }
const principalB = { userId: 'account-b', deviceId: 'device-b', sessionId: 'session-b' }
const auth = {
  authenticate: vi.fn((token: string) => {
    if (token === 'token-a') return Promise.resolve(principalA)
    if (token === 'token-b') return Promise.resolve(principalB)
    return Promise.reject(new LoroError('UNAUTHENTICATED'))
  }),
}

let app: INestApplication
let base: string

beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [MusicController],
    providers: [
      AuthGuard,
      MusicService,
      { provide: AuthService, useValue: auth },
      { provide: MUSIC_REPOSITORY, useClass: MemoryMusicRepository },
    ],
  }).compile()
  app = module.createNestApplication()
  app.setGlobalPrefix('v1')
  app.useGlobalFilters(new ProblemDetailsFilter())
  await app.listen(0, '127.0.0.1')
  base = `${await app.getUrl()}/v1`
})

afterAll(async () => {
  await app.close()
})

async function post(path: string, token: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('music HTTP authz and stub journey (p3f-11)', () => {
  it('refuses anonymous lyrics spend', async () => {
    const response = await fetch(`${base}/music/lyrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_locale: 'es-ES',
        meaning_language: 'en',
        catalog_phrase_ids: ['cafe1', 'cafe2', 'cafe3'],
      }),
    })
    expect(response.status).toBe(401)
  })

  it('creates lyrics, renders styles, and hides another principal’s track', async () => {
    const lyrics = await post('/music/lyrics', 'token-a', {
      target_locale: 'es-ES',
      meaning_language: 'en',
      catalog_phrase_ids: ['cafe1', 'cafe2', 'cafe3'],
    })
    expect(lyrics.status).toBe(200)
    const lyricsBody = (await lyrics.json()) as { lyric_document_id: string; fallback: boolean }
    expect(lyricsBody.fallback).toBe(true)

    const renders = await post('/music/renders', 'token-a', {
      lyric_document_id: lyricsBody.lyric_document_id,
      style_ids: ['acoustic_folk', 'modern_pop', 'gentle_ballad'],
    })
    const renderBody = (await renders.json()) as {
      jobs: { status: string; track_id: string | null }[]
    }
    expect(renderBody.jobs.length).toBe(3)
    const ready = renderBody.jobs.filter((job) => job.status === 'ready')
    expect(ready.length).toBeGreaterThanOrEqual(2)
    const trackId = ready[0]?.track_id
    expect(typeof trackId).toBe('string')
    if (typeof trackId !== 'string') throw new Error('expected track id')

    const own = await fetch(`${base}/music/tracks/${trackId}`, {
      headers: { Authorization: 'Bearer token-a' },
    })
    expect(own.status).toBe(200)
    const meta = (await own.json()) as { generated: boolean; duration_ms: number }
    expect(meta.generated).toBe(true)
    expect(meta.duration_ms).toBe(400)

    const audio = await fetch(`${base}/music/tracks/${trackId}/content`, {
      headers: { Authorization: 'Bearer token-a' },
    })
    expect(audio.status).toBe(200)
    expect(audio.headers.get('content-type')).toBe('audio/wav')
    expect((await audio.arrayBuffer()).byteLength).toBeGreaterThan(40)

    const other = await fetch(`${base}/music/tracks/${trackId}`, {
      headers: { Authorization: 'Bearer token-b' },
    })
    expect(other.status).toBe(404)
  })
})
