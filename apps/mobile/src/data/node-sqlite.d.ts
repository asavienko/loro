/**
 * Minimal types for Node's built-in SQLite.
 *
 * Hand-written rather than pulled from `@types/node`, because adding node types to the
 * mobile app would make `node:fs` and friends type-check inside React Native code. Only
 * the test driver uses this module, and only these three methods.
 */
declare module 'node:sqlite' {
  export interface StatementSync {
    all(...params: unknown[]): Record<string, unknown>[]
    run(...params: unknown[]): { changes: number; lastInsertRowid: number }
  }

  export class DatabaseSync {
    constructor(path: string)
    exec(sql: string): void
    prepare(sql: string): StatementSync
    close(): void
  }
}
