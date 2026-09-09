import { synchronousResult } from '@loro/core'

/**
 * Nested-transaction scaffold for native/node SQLite.
 *
 * The browser driver keeps its own copy: it snapshots localStorage around COMMIT
 * and must reopen the file when durable storage rejects a successful SQLite write.
 */
export function withSavepoints(
  run: (sql: string) => void,
  begin: 'BEGIN' | 'BEGIN IMMEDIATE' = 'BEGIN',
): <T>(fn: () => T) => T {
  let depth = 0
  return <T>(fn: () => T): T => {
    const outer = depth === 0
    const savepoint = `loro_${String(depth)}`
    run(outer ? begin : `SAVEPOINT ${savepoint}`)
    depth++
    try {
      const result = synchronousResult(fn())
      run(outer ? 'COMMIT' : `RELEASE SAVEPOINT ${savepoint}`)
      return result
    } catch (error) {
      run(outer ? 'ROLLBACK' : `ROLLBACK TO SAVEPOINT ${savepoint}`)
      if (!outer) run(`RELEASE SAVEPOINT ${savepoint}`)
      throw error
    } finally {
      depth--
    }
  }
}
