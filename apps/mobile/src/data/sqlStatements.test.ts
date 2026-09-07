import { describe, expect, it } from 'vitest'
import { sqlStatements } from './sqlStatements'

describe('native SQLite script splitting', () => {
  it('keeps quoted semicolons, escapes and comments intact', () => {
    expect(sqlStatements("INSERT INTO t VALUES ('a;''b'); -- ;\nCREATE TABLE x (v TEXT);")).toEqual(
      ["INSERT INTO t VALUES ('a;''b');", ' -- ;\nCREATE TABLE x (v TEXT);'],
    )
  })
  it('rejects truncated input before executing a migration', () => {
    expect(() => sqlStatements("SELECT 'truncated")).toThrow('Unterminated')
  })
})
