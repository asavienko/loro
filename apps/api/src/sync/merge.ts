/**
 * The bridge to `loro-core`'s WASM build.
 *
 * `serde-wasm-bindgen` emits Rust maps as JS `Map`s, so this module normalises them
 * to plain objects at the boundary — the rest of the API never sees the difference.
 */

import { createRequire } from 'node:module'

export interface Hlc {
  physical: number
  logical: number
  node_id: string
}

export interface FieldValue {
  v: unknown
  hlc: Hlc
}

export interface StoredRow {
  entity: string
  id: string
  fields: Record<string, FieldValue>
  deleted_at: number | null
}

export interface RowOp {
  entity: string
  id: string
  fields: Record<string, FieldValue>
  deleted_at: number | null
  classes: Record<string, string>
}

export interface MergeOutcome {
  row: StoredRow
  changed: boolean
  conflicts: string[]
}

interface WasmOutcome {
  row: { entity: string; id: string; fields: Map<string, FieldValue>; deleted_at: number | null }
  changed: boolean
  conflicts: string[]
}

/**
 * Loaded through normal package resolution, not a path relative to this file. The
 * relative path differed between `tsx src/main.ts` (dev), `dist/main.js` (the bundle),
 * and `/out` (the container) — the container would have resolved to nothing and
 * silently run without a merge. `@loro/core-rs` is a declared dependency, so pnpm
 * deploy carries `pkg/` into the image and every context resolves the same file.
 *
 * `createRequire` because wasm-pack's nodejs target emits CommonJS.
 */
interface WasmCore {
  merge_row: (l: unknown, r: unknown) => WasmOutcome
}

const core: WasmCore | null = (() => {
  try {
    return createRequire(import.meta.url)('@loro/core-rs/wasm') as WasmCore
  } catch {
    // Not built yet — `pnpm core-rs:build`. Callers get a clear error, and the
    // WASM-dependent tests skip rather than pass vacuously.
    return null
  }
})()

export function mergeAvailable(): boolean {
  return core !== null
}

export function mergeRow(local: StoredRow, remote: RowOp): MergeOutcome {
  if (core === null) {
    throw new Error('loro-core wasm is not built — run `pnpm core-rs:build`')
  }
  const out = core.merge_row(local, remote)
  return {
    row: {
      entity: out.row.entity,
      id: out.row.id,
      fields: Object.fromEntries(out.row.fields),
      deleted_at: out.row.deleted_at,
    },
    changed: out.changed,
    conflicts: out.conflicts,
  }
}
