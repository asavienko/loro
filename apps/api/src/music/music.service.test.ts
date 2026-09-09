import { afterEach, describe, expect, it } from 'vitest'
import { LoroError } from '../common/errors.js'
import { MusicService } from './music.service.js'
import { MemoryMusicRepository } from './repository.js'

const principal = { userId: 'account-a', deviceId: 'device-a', sessionId: 'session-a' }
const lyricsBody = {
  target_locale: 'es-ES',
  meaning_language: 'en',
  catalog_phrase_ids: ['cafe1', 'cafe2', 'cafe3'],
}

describe('music service budget and identity (p3f-11)', () => {
  const previousMonthly = process.env['MUSIC_MONTHLY_BUDGET_USD_PER_USER']
  const previousDaily = process.env['MUSIC_DAILY_BUDGET_USD_GLOBAL']

  afterEach(() => {
    if (previousMonthly === undefined) delete process.env['MUSIC_MONTHLY_BUDGET_USD_PER_USER']
    else process.env['MUSIC_MONTHLY_BUDGET_USD_PER_USER'] = previousMonthly
    if (previousDaily === undefined) delete process.env['MUSIC_DAILY_BUDGET_USD_GLOBAL']
    else process.env['MUSIC_DAILY_BUDGET_USD_GLOBAL'] = previousDaily
  })

  it('replays ready styles without a new debit and exhausts only new generation', async () => {
    process.env['MUSIC_MONTHLY_BUDGET_USD_PER_USER'] = '0.000003'
    process.env['MUSIC_DAILY_BUDGET_USD_GLOBAL'] = '1'
    const service = new MusicService(new MemoryMusicRepository(), { now: () => 1_721_558_400_123 })
    const lyrics = await service.createLyrics(principal, lyricsBody)
    const body = {
      lyric_document_id: lyrics.lyric_document_id,
      style_ids: ['acoustic_folk', 'modern_pop', 'gentle_ballad'],
    }
    const first = await service.renderStyles(principal, body)
    expect(first.jobs).toHaveLength(3)
    const replay = await service.renderStyles(principal, body)
    expect(replay.jobs.map((job) => job.track_id)).toEqual(first.jobs.map((job) => job.track_id))
    const other = await service.createLyrics(principal, {
      ...lyricsBody,
      catalog_phrase_ids: ['cafe1', 'cafe2', 'cafe4'],
    })
    await expect(
      service.renderStyles(principal, {
        lyric_document_id: other.lyric_document_id,
        style_ids: ['acoustic_folk', 'modern_pop'],
      }),
    ).rejects.toBeInstanceOf(LoroError)
  })

  it('keeps cached styles when a later request cannot afford a new style', async () => {
    process.env['MUSIC_MONTHLY_BUDGET_USD_PER_USER'] = '0.000002'
    process.env['MUSIC_DAILY_BUDGET_USD_GLOBAL'] = '1'
    const service = new MusicService(new MemoryMusicRepository(), { now: () => 1_721_558_400_123 })
    const lyrics = await service.createLyrics(principal, lyricsBody)
    const first = await service.renderStyles(principal, {
      lyric_document_id: lyrics.lyric_document_id,
      style_ids: ['acoustic_folk', 'modern_pop'],
    })
    expect(first.jobs.every((job) => job.status === 'ready')).toBe(true)
    const mixed = await service.renderStyles(principal, {
      lyric_document_id: lyrics.lyric_document_id,
      style_ids: ['acoustic_folk', 'modern_pop', 'gentle_ballad'],
    })
    expect(mixed.jobs.map((job) => job.status)).toEqual(['ready', 'ready', 'failed'])
    expect(mixed.jobs[2]?.error_code).toBe('budget')
    expect(mixed.jobs[0]?.track_id).toBe(first.jobs[0]?.track_id)
  })
})
