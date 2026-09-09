/** F-08: release-time validation for attributable reviews of the exact bundled material. */
import { reviewEntrySha256, reviewMaterialSha256, type ReviewPacket } from './reviewPacket.js'

interface Review {
  readonly status?: unknown
  readonly reviewer?: unknown
  readonly reviewerLanguages?: unknown
  readonly reviewedAt?: unknown
  readonly findings?: unknown
  readonly signOffEvidence?: unknown
}

interface Material {
  readonly sha256?: unknown
  readonly review?: Review
}

type RecordValue = Record<string, unknown>

const REVIEW_LANGUAGES = new Set(['en', 'bg', 'ru', 'es'])

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function isApprovedReview(
  review: Review | undefined,
  requiredLanguages: readonly string[],
): boolean {
  const reviewerLanguages = review?.reviewerLanguages
  return (
    review?.status === 'approved' &&
    typeof review.reviewer === 'string' &&
    review.reviewer.trim() !== '' &&
    Array.isArray(reviewerLanguages) &&
    reviewerLanguages.every(
      (language) => typeof language === 'string' && REVIEW_LANGUAGES.has(language),
    ) &&
    requiredLanguages.every((language) => reviewerLanguages.includes(language)) &&
    typeof review.reviewedAt === 'string' &&
    !Number.isNaN(Date.parse(review.reviewedAt)) &&
    Array.isArray(review.findings) &&
    typeof review.signOffEvidence === 'string' &&
    review.signOffEvidence.trim() !== ''
  )
}

function exactEntries(
  expected: readonly Material[],
  actual: unknown,
  label: string,
  identity: (entry: RecordValue, expected: RecordValue) => boolean,
  payload: (entry: RecordValue) => unknown,
  requiredLanguages: (entry: RecordValue) => readonly string[],
): string[] {
  if (!Array.isArray(actual) || actual.length !== expected.length)
    return [`${label} entries do not match the current material.`]
  return expected.flatMap((entry, index) => {
    const candidate: unknown = actual[index]
    if (!isRecord(candidate) || !isRecord(entry) || !identity(candidate, entry))
      return [`${label} entry ${index + 1} does not match the current material identity.`]
    if (
      candidate.sha256 !== entry.sha256 ||
      !isSha256(candidate.sha256) ||
      reviewEntrySha256(payload(candidate)) !== candidate.sha256
    )
      return [`${label} entry ${index + 1} does not match the current material digest.`]
    return isApprovedReview(candidate.review as Review | undefined, requiredLanguages(entry))
      ? []
      : [`${label} entry ${index + 1} lacks an attributable approval.`]
  })
}

function recordMaterialSha256(value: RecordValue): string | undefined {
  if (!Array.isArray(value.ui) || !Array.isArray(value.courses)) return undefined
  const ui = value.ui.map((entry) => {
    if (!isRecord(entry) || typeof entry.locale !== 'string' || typeof entry.sha256 !== 'string')
      return undefined
    return { locale: entry.locale, sha256: entry.sha256 }
  })
  const courses = value.courses.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.nativeLanguage !== 'string' ||
      typeof entry.targetLocale !== 'string' ||
      typeof entry.sha256 !== 'string'
    )
      return undefined
    return {
      nativeLanguage: entry.nativeLanguage,
      targetLocale: entry.targetLocale,
      sha256: entry.sha256,
    }
  })
  if (ui.some((entry) => entry === undefined) || courses.some((entry) => entry === undefined))
    return undefined
  return reviewMaterialSha256({
    ui: ui as { locale: string; sha256: string }[],
    courses: courses as { nativeLanguage: string; targetLocale: string; sha256: string }[],
  })
}

/** Reject stale, incomplete or unattributable review records before a reviewed release can ship. */
export function validateReviewRecord(packet: ReviewPacket, record: unknown): void {
  if (!isRecord(record)) throw new Error('Review record must be an object.')
  const value = record
  const problems = [
    ...(value.schemaVersion === packet.schemaVersion
      ? []
      : ['Review record schema version is stale.']),
    ...(value.materialSha256 === packet.materialSha256 &&
    isSha256(value.materialSha256) &&
    recordMaterialSha256(value) === packet.materialSha256
      ? []
      : ['Review record material digest does not match the current bundled material.']),
    ...exactEntries(
      packet.ui,
      value.ui,
      'UI',
      (candidate, expected) => candidate.locale === expected.locale,
      (candidate) => candidate.resources,
      (expected) => ['en', expected.locale as string],
    ),
    ...exactEntries(
      packet.courses,
      value.courses,
      'Course',
      (candidate, expected) =>
        candidate.nativeLanguage === expected.nativeLanguage &&
        candidate.targetLocale === expected.targetLocale,
      (candidate) => candidate.catalog,
      (expected) => [
        String(expected.nativeLanguage),
        String(expected.targetLocale).split('-')[0] ?? '',
      ],
    ),
  ]
  if (problems.length > 0) throw new Error(problems.join(' '))
}
