/** P3-30: durable Review resume boundary. Malformed payloads never become a session. */
import { isTargetLocale, type TargetLocale } from '../domain/languages.js'
import type { PhraseState } from '../domain/phrase.js'
import { isDue } from '../domain/phrase.js'
import { firstReviewPolicy } from '../engines/review.js'

export const REVIEW_CHECKPOINT_VERSION = 1 as const
export const REVIEW_CHECKPOINT_KEY_PREFIX = 'review_checkpoint:'

const MAX_BYTES = 1_000_000
const MAX_ITEMS = 2_000
const MAX_TEXT = 1_024

export interface ReviewDisplayedContent {
  readonly targetText: string
  readonly translation: string
}

export interface ReviewQueueEntry {
  readonly phraseId: string
  readonly contentHash: string
}

/**
 * What must be persisted before a Review grade can resume.
 *
 * `eventId` is the attempt identity the store will commit with `committed_attempt`.
 * The payload is local-only: it is not a sync entity and does not carry `field_hlc`.
 */
export interface ReviewCheckpoint {
  readonly version: typeof REVIEW_CHECKPOINT_VERSION
  readonly eventId: string
  readonly targetLocale: TargetLocale
  readonly localDay: string
  readonly phraseId: string
  readonly contentHash: string
  readonly cursor: number
  readonly queue: readonly ReviewQueueEntry[]
}

export type ReviewResumeRefusal =
  | 'absent'
  | 'malformed'
  | 'wrong-course'
  | 'wrong-day'
  | 'missing-phrase'
  | 'content-changed'
  | 'unscheduled'
  | 'not-due'
  | 'queue-mismatch'

export type ReviewResumeDecision =
  | { readonly ok: true; readonly checkpoint: ReviewCheckpoint }
  | { readonly ok: false; readonly reason: ReviewResumeRefusal }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT
}

function localDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value))
    return false
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= (daysInMonth[month - 1] ?? 0)
}

function entry(value: unknown): value is ReviewQueueEntry {
  return (
    record(value) &&
    keys(value, ['phraseId', 'contentHash']) &&
    text(value.phraseId) &&
    text(value.contentHash)
  )
}

function checkpoint(value: unknown): value is ReviewCheckpoint {
  if (
    !record(value) ||
    !keys(value, [
      'version',
      'eventId',
      'targetLocale',
      'localDay',
      'phraseId',
      'contentHash',
      'cursor',
      'queue',
    ]) ||
    value.version !== REVIEW_CHECKPOINT_VERSION ||
    !text(value.eventId) ||
    typeof value.targetLocale !== 'string' ||
    !isTargetLocale(value.targetLocale) ||
    !localDay(value.localDay) ||
    !text(value.phraseId) ||
    !text(value.contentHash) ||
    !count(value.cursor) ||
    !Array.isArray(value.queue) ||
    value.queue.length === 0 ||
    value.queue.length > MAX_ITEMS ||
    !value.queue.every(entry) ||
    value.cursor >= value.queue.length
  )
    return false
  const ids = value.queue.map((item) => item.phraseId)
  if (new Set(ids).size !== ids.length) return false
  return value.queue[value.cursor]?.phraseId === value.phraseId
}

/** FNV-1a over identity + displayed text. Core stays free of `node:crypto`. */
export function reviewContentHash(
  phrase: Pick<PhraseState, 'id' | 'phraseId' | 'ownEs' | 'ownEn'>,
  displayed?: ReviewDisplayedContent,
): string {
  const payload = [
    phrase.id,
    phrase.phraseId ?? '',
    phrase.ownEs ?? '',
    phrase.ownEn ?? '',
    displayed?.targetText ?? '',
    displayed?.translation ?? '',
  ].join('\0')
  let hash = 0x811c9dc5
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function reviewCheckpointKey(targetLocale: TargetLocale): string {
  return `${REVIEW_CHECKPOINT_KEY_PREFIX}${targetLocale}`
}

/** Build a fail-closed payload, or `null` when the cursor is past the queue. */
export function buildReviewCheckpoint(input: {
  readonly eventId: string
  readonly targetLocale: TargetLocale
  readonly localDay: string
  readonly cursor: number
  readonly queue: readonly ReviewQueueEntry[]
}): ReviewCheckpoint | null {
  const entry = input.queue[input.cursor]
  if (entry === undefined) return null
  const value: ReviewCheckpoint = {
    version: REVIEW_CHECKPOINT_VERSION,
    eventId: input.eventId,
    targetLocale: input.targetLocale,
    localDay: input.localDay,
    phraseId: entry.phraseId,
    contentHash: entry.contentHash,
    cursor: input.cursor,
    queue: input.queue,
  }
  return checkpoint(value) ? value : null
}

/** Unknown versions and malformed/truncated data are discarded, never cast into a session. */
export function decodeReviewCheckpoint(raw: string): ReviewCheckpoint | null {
  if (raw.length > MAX_BYTES) return null
  try {
    const value: unknown = JSON.parse(raw)
    return checkpoint(value) ? value : null
  } catch {
    return null
  }
}

export function encodeReviewCheckpoint(value: ReviewCheckpoint): string {
  if (!checkpoint(value)) throw new Error('Invalid review checkpoint')
  const raw = JSON.stringify(value)
  if (raw.length > MAX_BYTES) throw new Error('Review checkpoint exceeds storage limit')
  return raw
}

export interface ReviewResumeContext {
  readonly targetLocale: TargetLocale
  /** `clock.localDay()`, never `streakDay()`. */
  readonly localDay: string
  readonly at: number
  readonly phrases: readonly PhraseState[]
  readonly displayed?: Readonly<Record<string, ReviewDisplayedContent>>
}

/**
 * Resume is fail-closed. A stored payload that does not match today's course, day,
 * phrase identity, content or due schedule is ignored — never repaired into a session.
 */
export function validateReviewResume(
  stored: ReviewCheckpoint | null,
  ctx: ReviewResumeContext,
): ReviewResumeDecision {
  if (stored === null) return { ok: false, reason: 'absent' }
  if (stored.targetLocale !== ctx.targetLocale) return { ok: false, reason: 'wrong-course' }
  if (stored.localDay !== ctx.localDay) return { ok: false, reason: 'wrong-day' }
  const phrase = ctx.phrases.find((row) => row.id === stored.phraseId)
  if (phrase === undefined) return { ok: false, reason: 'missing-phrase' }
  if (firstReviewPolicy(phrase) === 'blocked-unscheduled')
    return { ok: false, reason: 'unscheduled' }
  if (!isDue(phrase, ctx.at)) return { ok: false, reason: 'not-due' }
  const displayed = ctx.displayed?.[phrase.id]
  if (stored.contentHash !== reviewContentHash(phrase, displayed))
    return { ok: false, reason: 'content-changed' }
  const expected = stored.queue[stored.cursor]
  if (expected === undefined || expected.phraseId !== stored.phraseId)
    return { ok: false, reason: 'queue-mismatch' }
  if (expected.contentHash !== stored.contentHash) return { ok: false, reason: 'queue-mismatch' }
  return { ok: true, checkpoint: stored }
}
