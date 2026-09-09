/**
 * Catalog TTS render pipeline. Node-only. Metro must not import this module.
 *
 * Inject the synthesize function so tests never call ElevenLabs. Stub and failed
 * renders cannot write phrase.audio.
 */

import { createHash } from 'node:crypto'
import { mkdir, rename, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { audioDurationMs } from './audioDuration.js'
import type { Catalog, CatalogPhrase } from './types.js'

export interface RenderProvenance {
  provider: 'elevenlabs' | 'stub'
  model: string
  voiceId: string
  outputFormat: string
  locale: string
}

export interface SynthesizeResult {
  bytes: Uint8Array
  contentType: string
  provenance: RenderProvenance
  characterCount: number | null
}

export interface RenderRequest {
  text: string
  locale: string
  voiceId: string
  signal?: AbortSignal
}

export interface RenderOptions {
  ids?: readonly string[]
  dryRun: boolean
  creditCeiling: number
  locale: string
  voiceId: string
  outputDir: string
  encode?: (bytes: Uint8Array, contentType: string) => Promise<Uint8Array>
  measureDuration?: (bytes: Uint8Array) => number | null
}

export interface RenderReport {
  attempted: number
  skipped: number
  rendered: number
  failed: number
  estimatedCharacters: number
  actualCharacters: number | null
  phrases: CatalogPhrase[]
  errors: readonly { id: string; code: string }[]
}

const SHA = /^[a-f0-9]{64}$/

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function audioUri(sha256: string): string {
  return `sha256/${sha256}`
}

function phraseText(phrase: CatalogPhrase, locale: string): string {
  if (locale === 'es-ES') return phrase.es
  throw new Error(`render locale ${locale} is not in this catalog snapshot`)
}

function selected(phrases: readonly CatalogPhrase[], ids: readonly string[] | undefined) {
  if (ids === undefined) return [...phrases]
  const wanted = new Set(ids)
  return phrases.filter((phrase) => wanted.has(phrase.id))
}

export async function renderCatalog(
  catalog: Catalog,
  synthesize: (input: RenderRequest) => Promise<SynthesizeResult>,
  options: RenderOptions,
): Promise<RenderReport> {
  if (options.creditCeiling < 0 || !Number.isSafeInteger(options.creditCeiling)) {
    throw new Error('credit ceiling must be a non-negative integer')
  }
  const measure = options.measureDuration ?? audioDurationMs
  // Conversion to AAC 64 kbps mono 24 kHz is the CLI's job. Identity is the default so
  // tests never need ffmpeg; a missing duration still fails closed.
  const encode = options.encode ?? ((bytes) => Promise.resolve(bytes))
  const targets = selected(catalog.phrases, options.ids)
  const errors: { id: string; code: string }[] = []
  let skipped = 0
  let rendered = 0
  let estimatedCharacters = 0
  let spentCharacters = 0
  let actualCharacters = 0
  let sawActual = false
  const phrases = catalog.phrases.map((phrase) => ({ ...phrase }))
  const byId = new Map(phrases.map((phrase) => [phrase.id, phrase]))

  await mkdir(options.outputDir, { recursive: true })

  for (const phrase of targets) {
    const text = phraseText(phrase, options.locale)
    estimatedCharacters += text.length
    if (options.dryRun) continue
    const current = byId.get(phrase.id)
    if (current === undefined) {
      errors.push({ id: phrase.id, code: 'missing' })
      continue
    }
    if (current.audio && SHA.test(current.audio.sha256)) {
      const existing = join(options.outputDir, `${current.audio.sha256}.bin`)
      const sidecar = join(options.outputDir, `${current.audio.sha256}.json`)
      try {
        const bytes = await readFile(existing)
        if (sha256Hex(bytes) === current.audio.sha256) {
          const provenance = JSON.parse(await readFile(sidecar, 'utf8')) as RenderProvenance
          if (
            provenance.voiceId === options.voiceId &&
            provenance.locale === options.locale &&
            provenance.provider === 'elevenlabs'
          ) {
            skipped += 1
            continue
          }
        }
      } catch {
        /* missing cache is a render, not a skip */
      }
    }
    if (spentCharacters + text.length > options.creditCeiling) {
      errors.push({ id: phrase.id, code: 'ceiling' })
      continue
    }
    spentCharacters += text.length
    try {
      const result = await synthesize({
        text,
        locale: options.locale,
        voiceId: options.voiceId,
      })
      if (result.provenance.provider !== 'elevenlabs') {
        errors.push({ id: phrase.id, code: 'stub' })
        continue
      }
      if (
        result.provenance.voiceId !== options.voiceId ||
        result.provenance.locale !== options.locale
      ) {
        errors.push({ id: phrase.id, code: 'voice' })
        continue
      }
      const encoded = await encode(result.bytes, result.contentType)
      const digest = sha256Hex(encoded)
      const ms = measure(encoded)
      if (ms === null) {
        errors.push({ id: phrase.id, code: 'duration' })
        continue
      }
      const tmp = join(options.outputDir, `${digest}.tmp`)
      const dest = join(options.outputDir, `${digest}.bin`)
      await writeFile(tmp, encoded)
      await rename(tmp, dest)
      await writeFile(
        join(options.outputDir, `${digest}.json`),
        `${JSON.stringify(result.provenance, null, 2)}\n`,
      )
      current.audio = { uri: audioUri(digest), sha256: digest, ms }
      rendered += 1
      if (result.characterCount !== null) {
        actualCharacters += result.characterCount
        sawActual = true
      }
    } catch (error) {
      const code =
        error !== null && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : 'unavailable'
      errors.push({ id: phrase.id, code })
    }
  }

  return {
    attempted: targets.length,
    skipped,
    rendered,
    failed: errors.length,
    estimatedCharacters,
    actualCharacters: sawActual ? actualCharacters : null,
    phrases,
    errors,
  }
}

export function assertPublishable(report: RenderReport, provider: string): void {
  if (provider !== 'elevenlabs') {
    throw new Error('stub and unknown providers cannot publish catalog audio')
  }
  if (report.failed > 0 || report.rendered + report.skipped !== report.attempted) {
    throw new Error('failed or incomplete renders cannot produce a publishable pack')
  }
}
