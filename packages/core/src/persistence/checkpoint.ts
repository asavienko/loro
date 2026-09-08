import { isTargetLocale, type TargetLocale } from '../domain/languages.js'
import type { SessionHandle } from '../engines/types.js'

/** Local-only resume data. Audio buffers and native resources never belong here. */
export interface CourseCheckpoint {
  readonly version: 1
  readonly targetLocale: TargetLocale
  readonly localDay: string
  /** Snapshot of the session's displayed content; absent legacy sessions are re-planned. */
  readonly contentSignature?: string
  readonly revision: number
  readonly streamCursor: number
  readonly refrainResume: {
    readonly session: SessionHandle | null
    readonly cursor: number
    readonly lastLatency: number | null
    readonly history: (number | null)[]
    readonly done: boolean
  }
}

const MAX_BYTES = 1_000_000
const MAX_ITEMS = 2_000
const MAX_TEXT = 1_024
const META_KEYS = ['repIndex', 'repeatTarget', 'repTarget', 'beatMs', 'automaticity', 'warmBand']
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}
function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
function number(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT
}
function latency(value: unknown): boolean {
  return value === null || number(value)
}
function prompt(value: unknown): boolean {
  return (
    record(value) &&
    keys(value, ['show', 'clozeMask', 'hookOnly']) &&
    ['full', 'cloze', 'meaning', 'nothing'].includes(String(value.show)) &&
    (value.hookOnly === undefined || typeof value.hookOnly === 'boolean') &&
    (value.clozeMask === undefined ||
      (Array.isArray(value.clozeMask) &&
        value.clozeMask.length <= MAX_ITEMS &&
        value.clozeMask.every(count)))
  )
}
function gate(value: unknown): boolean {
  if (!record(value)) return false
  switch (value.kind) {
    case 'listen':
    case 'self-report':
    case 'asr-full':
    case 'tap':
      return keys(value, ['kind'])
    case 'asr-partial':
      return keys(value, ['kind', 'minTokens']) && count(value.minTokens)
    case 'score':
      return keys(value, ['kind', 'minScore']) && number(value.minScore) && value.minScore <= 100
    default:
      return false
  }
}
function audio(value: unknown): boolean {
  return (
    value === null ||
    (record(value) &&
      keys(value, ['rate', 'source']) &&
      number(value.rate) &&
      value.rate > 0 &&
      value.rate <= 4 &&
      (value.source === 'catalog' || value.source === 'device-tts'))
  )
}
function item(value: unknown): boolean {
  return (
    record(value) &&
    keys(value, ['itemId', 'phraseId', 'mode', 'prompt', 'gate', 'audio', 'meta']) &&
    text(value.itemId) &&
    text(value.phraseId) &&
    ['echo', 'chorus', 'speed', 'cloze', 'call', 'cold'].includes(String(value.mode)) &&
    prompt(value.prompt) &&
    gate(value.gate) &&
    audio(value.audio) &&
    record(value.meta) &&
    keys(value.meta, META_KEYS) &&
    Object.values(value.meta).every((entry) => number(entry) || text(entry)) &&
    (value.meta.repIndex === undefined ||
      (count(value.meta.repIndex) && value.meta.repIndex < MAX_ITEMS)) &&
    (value.meta.repTarget === undefined ||
      (count(value.meta.repTarget) &&
        value.meta.repTarget > 0 &&
        value.meta.repTarget <= MAX_ITEMS)) &&
    (value.meta.repIndex === undefined ||
      value.meta.repTarget === undefined ||
      value.meta.repIndex < value.meta.repTarget)
  )
}
function session(value: unknown): value is SessionHandle {
  if (
    !record(value) ||
    !keys(value, ['sessionId', 'plan', 'cursor']) ||
    !text(value.sessionId) ||
    !count(value.cursor)
  )
    return false
  const plan = value.plan
  return (
    record(plan) &&
    keys(plan, ['engineId', 'items', 'estimatedMs', 'closed']) &&
    plan.engineId === 'refrain' &&
    Array.isArray(plan.items) &&
    plan.items.length <= MAX_ITEMS &&
    plan.items.every(item) &&
    value.cursor <= plan.items.length &&
    new Set(plan.items.map((entry: { itemId: string }) => entry.itemId)).size ===
      plan.items.length &&
    number(plan.estimatedMs) &&
    typeof plan.closed === 'boolean'
  )
}
function checkpoint(value: unknown): value is CourseCheckpoint {
  if (
    !record(value) ||
    !keys(value, [
      'version',
      'targetLocale',
      'localDay',
      'revision',
      'contentSignature',
      'streamCursor',
      'refrainResume',
    ]) ||
    value.version !== 1 ||
    typeof value.targetLocale !== 'string' ||
    !isTargetLocale(value.targetLocale) ||
    typeof value.localDay !== 'string' ||
    !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value.localDay) ||
    (value.contentSignature !== undefined &&
      (typeof value.contentSignature !== 'string' || value.contentSignature.length > MAX_BYTES)) ||
    !count(value.revision) ||
    !count(value.streamCursor)
  )
    return false
  const resume = value.refrainResume
  return (
    record(resume) &&
    keys(resume, ['session', 'cursor', 'lastLatency', 'history', 'done']) &&
    (resume.session === null || session(resume.session)) &&
    count(resume.cursor) &&
    (resume.session === null
      ? resume.cursor === 0
      : resume.cursor <= resume.session.plan.items.length) &&
    latency(resume.lastLatency) &&
    Array.isArray(resume.history) &&
    resume.history.length <= MAX_ITEMS &&
    resume.history.every(latency) &&
    typeof resume.done === 'boolean'
  )
}

/** Unknown versions and malformed/truncated data are discarded, never cast into a session. */
export function decodeCheckpoint(raw: string): CourseCheckpoint | null {
  if (raw.length > MAX_BYTES) return null
  try {
    const value: unknown = JSON.parse(raw)
    return checkpoint(value) ? value : null
  } catch {
    return null
  }
}

export function encodeCheckpoint(value: CourseCheckpoint): string {
  if (!checkpoint(value)) throw new Error('Invalid course checkpoint')
  const raw = JSON.stringify(value)
  if (raw.length > MAX_BYTES) throw new Error('Course checkpoint exceeds storage limit')
  return raw
}
