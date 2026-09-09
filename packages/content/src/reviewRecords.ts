/** F-08: release-time validation for attributable reviews of the exact bundled material. */
import type { ReviewPacket } from './reviewPacket.js'

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

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function isApprovedReview(review: Review | undefined): boolean {
  return (
    review?.status === 'approved' &&
    typeof review.reviewer === 'string' &&
    review.reviewer.trim() !== '' &&
    Array.isArray(review.reviewerLanguages) &&
    review.reviewerLanguages.every((language) => typeof language === 'string' && language !== '') &&
    review.reviewerLanguages.length > 0 &&
    typeof review.reviewedAt === 'string' &&
    !Number.isNaN(Date.parse(review.reviewedAt)) &&
    Array.isArray(review.findings) &&
    typeof review.signOffEvidence === 'string' &&
    review.signOffEvidence.trim() !== ''
  )
}

function exactEntries(expected: readonly Material[], actual: unknown, label: string): string[] {
  if (!Array.isArray(actual) || actual.length !== expected.length)
    return [`${label} entries do not match the current material.`]
  return expected.flatMap((entry, index) => {
    const candidate = actual[index] as Material | undefined
    if (!candidate || candidate.sha256 !== entry.sha256)
      return [`${label} entry ${index + 1} does not match the current material digest.`]
    return isApprovedReview(candidate.review)
      ? []
      : [`${label} entry ${index + 1} lacks an attributable approval.`]
  })
}

/** Reject stale, incomplete or unattributable review records before a reviewed release can ship. */
export function validateReviewRecord(packet: ReviewPacket, record: unknown): void {
  if (typeof record !== 'object' || record === null)
    throw new Error('Review record must be an object.')
  const value = record as {
    readonly schemaVersion?: unknown
    readonly materialSha256?: unknown
    readonly ui?: unknown
    readonly courses?: unknown
  }
  const problems = [
    ...(value.schemaVersion === packet.schemaVersion
      ? []
      : ['Review record schema version is stale.']),
    ...(value.materialSha256 === packet.materialSha256 && isSha256(value.materialSha256)
      ? []
      : ['Review record material digest does not match the current bundled material.']),
    ...exactEntries(packet.ui, value.ui, 'UI'),
    ...exactEntries(packet.courses, value.courses, 'Course'),
  ]
  if (problems.length > 0) throw new Error(problems.join(' '))
}
