/**
 * The driver-level query helpers.
 *
 * Every repository reads through these, so a fake driver is the honest test: what is
 * being pinned is the helper's contract, not SQLite's.
 */

import { describe, expect, it } from 'vitest'
import { firstRow, placeholders, type SqlDriver, type SqlRow, type SqlValue } from './driver.js'

function fakeDriver(rows: SqlRow[]): SqlDriver & { lastParams: readonly SqlValue[] | undefined } {
  const driver = {
    lastParams: undefined as readonly SqlValue[] | undefined,
    exec: () => undefined,
    run: () => undefined,
    all(_sql: string, params?: readonly SqlValue[]): SqlRow[] {
      driver.lastParams = params
      return rows
    },
    transaction: <T>(fn: () => T): T => fn(),
    close: () => undefined,
  }
  return driver
}

describe('firstRow', () => {
  it('returns the first row when the query matched', () => {
    const driver = fakeDriver([{ n: 3 }, { n: 4 }])
    expect(firstRow(driver, 'SELECT n FROM t')).toEqual({ n: 3 })
  })

  it('returns null — not undefined — when nothing matched', () => {
    // Callers ask "is there a row?"; `null` is the answer every repository returns.
    expect(firstRow(fakeDriver([]), 'SELECT n FROM t')).toBeNull()
  })

  it('passes parameters straight through', () => {
    const driver = fakeDriver([])
    firstRow(driver, 'SELECT n FROM t WHERE a = ? AND b = ?', ['local', 7])
    expect(driver.lastParams).toEqual(['local', 7])
  })
})

describe('placeholders', () => {
  it('emits one bind marker per value', () => {
    expect(placeholders(1)).toBe('?')
    expect(placeholders(3)).toBe('?, ?, ?')
  })

  it('emits nothing for an empty list', () => {
    // `IN ()` is invalid SQL, which is why both callers return early on an empty list
    // rather than relying on this.
    expect(placeholders(0)).toBe('')
  })
})
