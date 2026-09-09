/** F-08: exact review material, never an assertion of linguistic approval. Node only. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { NATIVE_LANGUAGES, TARGET_LOCALES, supportsPair } from '@loro/core'
import { loadLearningCatalog } from './multilingual.js'

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
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
    return { locale, sha256: digest(resources), resources, review: pendingReview() }
  })
  const courses = NATIVE_LANGUAGES.flatMap((nativeLanguage) =>
    TARGET_LOCALES.filter((targetLocale) => supportsPair(nativeLanguage, targetLocale)).map(
      (targetLocale) => {
        const catalog = loadLearningCatalog(targetLocale, nativeLanguage)
        return {
          nativeLanguage,
          targetLocale,
          sha256: digest(catalog),
          catalog,
          review: pendingReview(),
        }
      },
    ),
  )
  return {
    schemaVersion: 1,
    requirement: 'F-08',
    // Exclude mutable review records from the identity of the material being reviewed.
    materialSha256: digest({
      ui: ui.map(({ locale, sha256 }) => ({ locale, sha256 })),
      courses: courses.map(({ nativeLanguage, targetLocale, sha256 }) => ({
        nativeLanguage,
        targetLocale,
        sha256,
      })),
    }),
    ui,
    courses,
  }
}
