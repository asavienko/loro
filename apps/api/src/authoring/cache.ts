/**
 * The request cache and the attempts file (plan 112 §3), both under the gitignored
 * `.cache/authoring/`: a rerun of the same request spends nothing, and a slot that failed keeps
 * its rejects so the next run can tell the model what not to repeat.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ensureCacheDir } from './context.js'
import type { PriorAttempt } from './prompt/phrases.js'

export interface CachedAnswer {
  cacheKey: string
  provider: string
  model: string
  at: string
  usage: { inputTokens: number; outputTokens: number }
  value: unknown
}

export function readCached(cacheKey: string): CachedAnswer | null {
  const path = join(ensureCacheDir('requests'), `${cacheKey}.json`)
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as CachedAnswer) : null
}

export function writeCached(answer: CachedAnswer): void {
  writeFileSync(
    join(ensureCacheDir('requests'), `${answer.cacheKey}.json`),
    `${JSON.stringify(answer, null, 2)}\n`,
  )
}

/** The full request as sent, for reading what the model was told. */
export function logRequest(cacheKey: string, body: unknown): void {
  writeFileSync(
    join(ensureCacheDir('requests'), `${cacheKey}.request.json`),
    `${JSON.stringify(body, null, 2)}\n`,
  )
}

export interface AttemptsFile {
  setId: string
  attempts: number
  last: PriorAttempt
}

function attemptsPath(setId: string): string {
  return join(ensureCacheDir('attempts'), `${setId}.json`)
}

export function readAttempts(setId: string): AttemptsFile | null {
  const path = attemptsPath(setId)
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as AttemptsFile) : null
}

export function writeAttempts(file: AttemptsFile): void {
  writeFileSync(attemptsPath(file.setId), `${JSON.stringify(file, null, 2)}\n`)
}

export function clearAttempts(setId: string): void {
  const path = attemptsPath(setId)
  if (existsSync(path)) unlinkSync(path)
}
