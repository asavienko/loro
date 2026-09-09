/** F-08: exact review material, never an assertion of linguistic approval. Node only. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { NATIVE_LANGUAGES, TARGET_LOCALES, supportsPair } from '@loro/core'
import { loadLearningCatalog } from './multilingual.js'
import { topicReviewSnapshot } from './topicSuggestions.js'

/** The review record uses the same byte identity as the exported packet. */
export function reviewEntrySha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function reviewMaterialSha256(material: {
  readonly ui: readonly { readonly locale: string; readonly sha256: string }[]
  readonly courses: readonly {
    readonly nativeLanguage: string
    readonly targetLocale: string
    readonly sha256: string
  }[]
  readonly topics: readonly { readonly id: string; readonly sha256: string }[]
}): string {
  return reviewEntrySha256({
    ui: material.ui.map(({ locale, sha256 }) => ({ locale, sha256 })),
    courses: material.courses.map(({ nativeLanguage, targetLocale, sha256 }) => ({
      nativeLanguage,
      targetLocale,
      sha256,
    })),
    topics: material.topics.map(({ id, sha256 }) => ({ id, sha256 })),
  })
}

function pendingReview() {
  return {
    status: 'pending' as const,
    reviewer: null,
    reviewerLanguages: [],
    reviewedAt: null,
    findings: [],
    signOffEvidence: null,
  }
}

export type ReviewPacket = ReturnType<typeof buildReviewPacket>

export function buildReviewPacket() {
  const ui = NATIVE_LANGUAGES.map((locale) => {
    const resources: unknown = JSON.parse(
      readFileSync(
        new URL(`../../../apps/mobile/src/lib/i18n/${locale}.json`, import.meta.url),
        'utf8',
      ),
    )
    return { locale, sha256: reviewEntrySha256(resources), resources, review: pendingReview() }
  })
  const courses = NATIVE_LANGUAGES.flatMap((nativeLanguage) =>
    TARGET_LOCALES.filter((targetLocale) => supportsPair(nativeLanguage, targetLocale)).map(
      (targetLocale) => {
        const catalog = loadLearningCatalog(targetLocale, nativeLanguage)
        return {
          nativeLanguage,
          targetLocale,
          sha256: reviewEntrySha256(catalog),
          catalog,
          review: pendingReview(),
        }
      },
    ),
  )
  const snapshot = topicReviewSnapshot()
  const topics = [
    {
      id: 'discover-bundled',
      sha256: reviewEntrySha256(snapshot),
      material: snapshot,
      review: pendingReview(),
    },
  ]
  return {
    schemaVersion: 1,
    requirement: 'F-08',
    // Exclude mutable review records from the identity of the material being reviewed.
    materialSha256: reviewMaterialSha256({ ui, courses, topics }),
    ui,
    courses,
    topics,
  }
}
