import { afterEach, describe, expect, it } from 'vitest'
import {
  LOCAL_USER_ID,
  clearReviewCheckpoint,
  loadReviewCheckpoint,
  openSqlPersistence,
  saveReviewCheckpoint,
  reviewContentHash,
  type ReviewCheckpoint,
  type SqlDriver,
} from '@loro/core'
import { makePhrase } from '@loro/core/testing'
import { openNodeSqlite } from './driver.node'

const DAY = '2026-07-28'
const T0 = 1_785_231_660_000
const drivers: SqlDriver[] = []

afterEach(() => {
  for (const driver of drivers.splice(0)) {
    try {
      driver.close()
    } catch {
      /* already closed */
    }
  }
})

function open(): SqlDriver {
  const driver = openNodeSqlite()
  drivers.push(driver)
  openSqlPersistence(driver, () => `${String(T0)}:0:test`, T0)
  return driver
}

function payload(overrides: Partial<ReviewCheckpoint> = {}): ReviewCheckpoint {
  const phrase = { ...makePhrase('due'), srs: { due: T0, stability: 4, difficulty: 5, lastReview: T0, lapses: 0, state: 'review' as const, algorithm: 'fixture-only' } }
  const contentHash = reviewContentHash(phrase)
  return {
    version: 1,
    eventId: 'evt-next',
    targetLocale: 'es-ES',
    localDay: DAY,
    phraseId: phrase.id,
    contentHash,
    cursor: 0,
    queue: [{ phraseId: phrase.id, contentHash }],
    ...overrides,
  }
}

describe('review checkpoint real SQLite persist', () => {
  it('upserts owned columns with ON CONFLICT and decodes fail-closed', () => {
    const driver = open()
    expect(loadReviewCheckpoint(driver, LOCAL_USER_ID, 'es-ES')).toBeNull()
    saveReviewCheckpoint(driver, LOCAL_USER_ID, payload())
    expect(loadReviewCheckpoint(driver, LOCAL_USER_ID, 'es-ES')).toEqual(payload())
    saveReviewCheckpoint(driver, LOCAL_USER_ID, payload({ eventId: 'evt-2' }))
    expect(loadReviewCheckpoint(driver, LOCAL_USER_ID, 'es-ES')?.eventId).toBe('evt-2')
    driver.run('UPDATE local_metadata SET value = ? WHERE key = ?', [
      '{',
      'review_checkpoint:es-ES',
    ])
    expect(loadReviewCheckpoint(driver, LOCAL_USER_ID, 'es-ES')).toBeNull()
    saveReviewCheckpoint(driver, LOCAL_USER_ID, payload())
    clearReviewCheckpoint(driver, LOCAL_USER_ID, 'es-ES')
    expect(loadReviewCheckpoint(driver, LOCAL_USER_ID, 'es-ES')).toBeNull()
  })
})
