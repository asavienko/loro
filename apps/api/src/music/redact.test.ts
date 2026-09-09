import { describe, expect, it } from 'vitest'
import { assertNoLyricLeak, redactMusicValue } from './redact.js'

describe('music log redaction', () => {
  it('strips lyric and phrase text from structured logs', () => {
    const redacted = redactMusicValue({
      job_id: 'job_1',
      style_id: 'acoustic_folk',
      target_text: 'Me pone un cortado, por favor',
      lines: ['Para llevar, por favor'],
    })
    expect(JSON.stringify(redacted)).not.toMatch(/cortado|llevar/i)
    expect(redacted).toMatchObject({ job_id: 'job_1', style_id: 'acoustic_folk' })
    expect(() => {
      assertNoLyricLeak(JSON.stringify(redacted))
    }).not.toThrow()
    expect(() => {
      assertNoLyricLeak('served Me pone un cortado')
    }).toThrow(/leaked/)
  })
})
