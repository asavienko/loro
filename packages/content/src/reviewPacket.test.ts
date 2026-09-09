import { describe, expect, it } from 'vitest'
import { buildReviewPacket } from './reviewPacket.js'
import { validateReviewRecord } from './reviewRecords.js'

function approvedRecord() {
  const packet = buildReviewPacket()
  const review = (reviewerLanguages: string[]) => ({
    status: 'approved' as const,
    reviewer: 'Bilingual reviewer',
    reviewerLanguages,
    reviewedAt: '2026-09-09T12:00:00.000Z',
    findings: [],
    signOffEvidence: 'review-system:record-123',
  })
  return {
    ...packet,
    ui: packet.ui.map((entry) => ({ ...entry, review: review(['en', entry.locale]) })),
    courses: packet.courses.map((entry) => ({
      ...entry,
      review: review([entry.nativeLanguage, entry.targetLocale.split('-')[0]!]),
    })),
    topics: packet.topics.map((entry) => ({
      ...entry,
      review: review(['en', 'es', 'bg', 'ru']),
    })),
  }
}

describe('F-08 bilingual review material', () => {
  it('exports all supported courses and UI resources without granting approval', () => {
    const packet = buildReviewPacket()
    expect(packet.ui.map(({ locale }) => locale)).toEqual(['en', 'bg', 'ru'])
    expect(packet.courses).toHaveLength(7)
    expect(packet.topics.map(({ id }) => id)).toEqual(['discover-bundled'])
    for (const entry of [...packet.ui, ...packet.courses, ...packet.topics]) {
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

  it('accepts only complete attributable approvals for the exact current material', () => {
    const record = approvedRecord()
    expect(() => {
      validateReviewRecord(buildReviewPacket(), record)
    }).not.toThrow()
    const incomplete = {
      ...record,
      courses: record.courses.map((course, index) =>
        index === 0 ? { ...course, review: { ...course.review, signOffEvidence: '' } } : course,
      ),
    }
    expect(() => {
      validateReviewRecord(buildReviewPacket(), incomplete)
    }).toThrow(/attributable approval/)
    const stale = { ...record, materialSha256: '0'.repeat(64) }
    expect(() => {
      validateReviewRecord(buildReviewPacket(), stale)
    }).toThrow(/does not match/)

    const changedResource = {
      ...record,
      ui: record.ui.map((entry, index) =>
        index === 0 ? { ...entry, resources: { unrelated: 'material never shipped' } } : entry,
      ),
    }
    expect(() => {
      validateReviewRecord(buildReviewPacket(), changedResource)
    }).toThrow(/digest/)

    const changedCatalog = {
      ...record,
      courses: record.courses.map((entry, index) =>
        index === 0
          ? { ...entry, nativeLanguage: 'ru', catalog: { ...entry.catalog, phrases: [] } }
          : entry,
      ),
    }
    expect(() => {
      validateReviewRecord(buildReviewPacket(), changedCatalog)
    }).toThrow(/identity|digest/)
  })

  it('requires each reviewer to cover the exact UI locale or course pair', () => {
    const record = approvedRecord()
    const englishOnly = {
      ...record,
      ui: record.ui.map((entry) => ({
        ...entry,
        review: { ...entry.review, reviewerLanguages: ['en'] },
      })),
      courses: record.courses.map((entry) => ({
        ...entry,
        review: { ...entry.review, reviewerLanguages: ['en'] },
      })),
    }
    expect(() => {
      validateReviewRecord(buildReviewPacket(), englishOnly)
    }).toThrow(/attributable approval/)

    const unknownLanguage = {
      ...record,
      ui: record.ui.map((entry) =>
        entry.locale === 'bg'
          ? { ...entry, review: { ...entry.review, reviewerLanguages: ['en', 'Bulgarian'] } }
          : entry,
      ),
    }
    expect(() => {
      validateReviewRecord(buildReviewPacket(), unknownLanguage)
    }).toThrow(/attributable approval/)
  })
})
