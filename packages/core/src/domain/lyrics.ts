/**
 * Phrase-containment and safety checks for lyric documents. Fail closed before a
 * learner sees lyrics or any music spend (plan 96 / P3F-04).
 */
import {
  LyricDocumentSchema,
  MUSIC_MAX_TITLE_CHARS,
  type LyricDocument,
  type LyricUsedPhrase,
} from '../api/music.js'
import type { NativeLanguage, TargetLocale } from './languages.js'
import { supportsPair } from './languages.js'
import { MUSIC_MIN_SECTIONS_FOR_DURATION, plannedTotalDurationMs } from './lyric-plan.js'
import { foldSearchText } from './text.js'

export interface CatalogLyricLine {
  readonly id: string
  readonly targetText: string
  readonly translation: string
  readonly deprecatedBy?: string
}

export interface LyricValidationFailure {
  readonly ok: false
  readonly errors: readonly string[]
}

export interface LyricValidationSuccess {
  readonly ok: true
  readonly document: LyricDocument
}

export type LyricValidationResult = LyricValidationSuccess | LyricValidationFailure

const FAKE_CLAIM =
  /(?:\d+\s*%|\bpercent(?:age)?\b|\b\d+\s*ms\b|\blatency\b|\bstreak\b|\bscore\b|\b\d+\s*reps?\b)/i
const COPYRIGHT_MARK =
  /(?:\bfeat\.?\b|\bft\.\b|\bwritten by\b|\bsongwriter\b|\bpublisher\b|\brecord label\b|©|℗)/i

export function foldLyricText(value: string): string {
  return foldSearchText(value)
    .replace(/[¿¡?!.,;:«»"'“”]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function looksLikeTargetLanguage(text: string, locale: TargetLocale): boolean {
  const letters = text.normalize('NFC').replace(/[^\p{L}]/gu, '')
  if (letters.length === 0) return false
  const units = [...letters]
  if (locale === 'es-ES') {
    const latin = units.filter((letter) => /\p{Script=Latin}/u.test(letter)).length
    return latin / units.length >= 0.8
  }
  const cyrillic = units.filter((letter) => /\p{Script=Cyrillic}/u.test(letter)).length
  return cyrillic / units.length >= 0.8
}

function allSungText(document: LyricDocument): string[] {
  return [
    document.title.target,
    document.title.translation,
    ...document.sections.flatMap((section) => section.lines),
    ...document.gloss_lines.flatMap((line) => [line.target, line.translation]),
  ]
}

function lineAt(document: LyricDocument, used: LyricUsedPhrase): string | undefined {
  const section = document.sections.find((entry) => entry.name === used.section_name)
  return section?.lines[used.line_index]
}

function phraseMatch(line: string, phrase: string): LyricUsedPhrase['match'] | null {
  const foldedLine = foldLyricText(line)
  const foldedPhrase = foldLyricText(phrase)
  if (foldedPhrase.length === 0) return null
  if (foldedLine === foldedPhrase) return 'exact_line'
  if (foldedLine.includes(foldedPhrase)) return 'contiguous_span'
  return null
}

export function validateLyricDocument(
  value: unknown,
  selected: readonly CatalogLyricLine[],
  catalog: readonly CatalogLyricLine[] = selected,
): LyricValidationResult {
  const parsed = LyricDocumentSchema.safeParse(value)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) }
  }
  const document = parsed.data
  const errors: string[] = []

  if (!supportsPair(document.meaning_language, document.target_locale)) {
    errors.push('unsupported_language_pair')
  }
  if (document.phrase_ids.length !== selected.length) {
    errors.push('phrase_id_count')
  }
  if (selected.some((phrase) => phrase.deprecatedBy !== undefined)) {
    errors.push('deprecated_phrase')
  }
  if (new Set(selected.map((phrase) => phrase.id)).size !== selected.length) {
    errors.push('duplicate_selected_ids')
  }
  for (const [index, phrase] of selected.entries()) {
    if (document.phrase_ids[index] !== phrase.id) errors.push(`phrase_order:${phrase.id}`)
  }

  const totalMs = plannedTotalDurationMs(document.sections.length)
  if (document.sections.length < MUSIC_MIN_SECTIONS_FOR_DURATION || totalMs === null) {
    errors.push('duration_budget')
  }

  const usedIds = new Set<string>()
  for (const used of document.used_phrases) {
    usedIds.add(used.catalog_phrase_id)
    const selectedPhrase = selected.find((phrase) => phrase.id === used.catalog_phrase_id)
    if (selectedPhrase === undefined) {
      errors.push(`unknown_used_phrase:${used.catalog_phrase_id}`)
      continue
    }
    if (foldLyricText(used.target_text) !== foldLyricText(selectedPhrase.targetText)) {
      errors.push(`used_text_mismatch:${used.catalog_phrase_id}`)
    }
    const line = lineAt(document, used)
    if (line === undefined) {
      errors.push(`missing_used_line:${used.catalog_phrase_id}`)
      continue
    }
    const match = phraseMatch(line, selectedPhrase.targetText)
    if (match === null) errors.push(`uncovered:${used.catalog_phrase_id}`)
    else if (match !== used.match) errors.push(`match_kind:${used.catalog_phrase_id}`)
  }

  for (const phrase of selected) {
    if (!usedIds.has(phrase.id)) errors.push(`missing_coverage:${phrase.id}`)
    const appears = document.sections.some((section) =>
      section.lines.some((line) => phraseMatch(line, phrase.targetText) !== null),
    )
    if (!appears) errors.push(`missing_line:${phrase.id}`)
  }

  const selectedIds = new Set(selected.map((phrase) => phrase.id))
  for (const extra of catalog) {
    if (selectedIds.has(extra.id)) continue
    const leaked = document.sections.some((section) =>
      section.lines.some((line) => phraseMatch(line, extra.targetText) === 'exact_line'),
    )
    if (leaked) errors.push(`invented_catalog_phrase:${extra.id}`)
  }

  for (const line of document.sections.flatMap((section) => section.lines)) {
    if (!looksLikeTargetLanguage(line, document.target_locale)) {
      errors.push('target_language')
      break
    }
  }

  if (allSungText(document).some((text) => FAKE_CLAIM.test(text))) {
    errors.push('fake_numbers')
  }
  if (allSungText(document).some((text) => COPYRIGHT_MARK.test(text))) {
    errors.push('copyright')
  }

  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)] }
  return { ok: true, document }
}

export function bundledLyricDocument(
  selected: readonly CatalogLyricLine[],
  targetLocale: TargetLocale,
  meaningLanguage: NativeLanguage,
  catalogVersion: number,
): LyricDocument {
  if (selected.length < 3 || selected.length > 8) {
    throw new Error('Bundled lyrics require 3–8 catalog phrases')
  }
  if (!supportsPair(meaningLanguage, targetLocale)) {
    throw new Error('Unsupported language pair')
  }
  const split = Math.ceil(selected.length / 2)
  const first = selected.slice(0, split)
  const rest = selected.slice(split)
  const chorus = selected[0]
  if (chorus === undefined) throw new Error('Bundled lyrics require a chorus phrase')
  const verse2 = rest.length > 0 ? rest : [chorus]
  const titleTarget = chorus.targetText.slice(0, MUSIC_MAX_TITLE_CHARS)
  const titleTranslation = chorus.translation.slice(0, MUSIC_MAX_TITLE_CHARS)
  const used_phrases: LyricUsedPhrase[] = []
  const pushUsed = (
    phrase: CatalogLyricLine,
    section_name: LyricUsedPhrase['section_name'],
    line_index: number,
    line: string,
  ): void => {
    if (used_phrases.some((entry) => entry.catalog_phrase_id === phrase.id)) return
    const match = phraseMatch(line, phrase.targetText)
    if (match === null) return
    used_phrases.push({
      catalog_phrase_id: phrase.id,
      target_text: phrase.targetText,
      section_name,
      line_index,
      match,
    })
  }

  const verse1Lines = first.map((phrase) => phrase.targetText)
  const verse2Lines = verse2.map((phrase) => phrase.targetText)
  const chorusLine = chorus.targetText
  first.forEach((phrase, index) => {
    const line = verse1Lines[index]
    if (line !== undefined) pushUsed(phrase, 'Verse 1', index, line)
  })
  pushUsed(chorus, 'Chorus', 0, chorusLine)
  verse2.forEach((phrase, index) => {
    const line = verse2Lines[index]
    if (line !== undefined) pushUsed(phrase, 'Verse 2', index, line)
  })

  return {
    schema_version: 1,
    target_locale: targetLocale,
    meaning_language: meaningLanguage,
    catalog_version: catalogVersion,
    phrase_ids: selected.map((phrase) => phrase.id),
    title: { target: titleTarget, translation: titleTranslation },
    sections: [
      { name: 'Verse 1', lines: verse1Lines },
      { name: 'Chorus', lines: [chorusLine] },
      { name: 'Verse 2', lines: verse2Lines },
    ],
    used_phrases,
    gloss_lines: selected.map((phrase) => ({
      target: phrase.targetText,
      translation: phrase.translation,
    })),
  }
}
