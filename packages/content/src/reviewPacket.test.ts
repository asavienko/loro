import { describe, expect, it } from 'vitest'
import { buildReviewPacket } from './reviewPacket.js'

describe('F-08 bilingual review material', () => {
  it('exports all supported courses and UI resources without granting approval', () => {
    const packet = buildReviewPacket()
    expect(packet.ui.map(({ locale }) => locale)).toEqual(['en', 'bg', 'ru'])
    expect(packet.courses).toHaveLength(7)
    for (const entry of [...packet.ui, ...packet.courses]) {
      expect(entry.review.status).toBe('pending')
      expect(entry.review.reviewer).toBeNull()
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/)
    }
    expect(packet.courses.every((course) => course.catalog.phrases.length === 31)).toBe(true)
    expect(buildReviewPacket().materialSha256).toBe(packet.materialSha256)
  })

  it('includes runtime adaptations and teaching fields that raw starter JSON misses', () => {
    const { courses } = buildReviewPacket()
    const spanish = courses.find(
      (course) => course.nativeLanguage === 'bg' && course.targetLocale === 'es-ES',
    )!
    const bulgarian = courses.find(
      (course) => course.nativeLanguage === 'en' && course.targetLocale === 'bg-BG',
    )!
    expect(spanish.catalog.phrases.find((phrase) => phrase.id === 'cafe1')?.translations.bg).toBe(
      'Едно кортадо, моля',
    )
    expect(
      bulgarian.catalog.phrases.find((phrase) => phrase.id === 'bg-BG:cafe1')?.translations.en,
    ).toBe('A coffee with a little milk, please')
    expect(spanish.catalog.phrases.some((phrase) => phrase.teaching?.en)).toBe(true)
    expect(bulgarian.catalog.phrases.every((phrase) => phrase.teaching === undefined)).toBe(true)
  })
})
