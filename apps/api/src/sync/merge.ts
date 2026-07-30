/**
 * The bridge to `loro-core`'s WASM build.
 *
 * `serde-wasm-bindgen` emits Rust maps as JS `Map`s, so this module normalises them
 * to plain objects at the boundary — the rest of the API never sees the difference.
 */

import { createRequire } from 'node:module'
import type { MergeClass } from '@loro/core'

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
  /**
   * Field name → the merge class DECLARED IN THE SHARED POLICY (`@loro/core`), in its TS
   * spelling. The Rust enum spelling is this module's business, not a caller's — see
   * `WASM_MERGE_CLASS`.
   */
  classes: Record<string, MergeClass>
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

/**
 * TS merge-class names → the Rust enum variants.
 *
 * Typed as a total map over `MergeClass`, so adding a class to the shared policy is a
 * COMPILE error here rather than a field that quietly merges as `Lww` — which is the
 * silent data-loss bug the field policy exists to prevent (ADR-0002).
 */
const WASM_MERGE_CLASS: Record<MergeClass, string> = {
  lww: 'Lww',
  max: 'Max',
  'latest-review': 'LatestReview',
  'append-only': 'AppendOnly',
  tombstone: 'Tombstone',
}

export function mergeRow(local: StoredRow, remote: RowOp): MergeOutcome {
  if (core === null) {
    throw new Error('loro-core wasm is not built — run `pnpm core-rs:build`')
  }
  const classes = Object.fromEntries(
    Object.entries(remote.classes).map(([field, cls]) => [field, WASM_MERGE_CLASS[cls]]),
  )
  const out = core.merge_row(local, { ...remote, classes })
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
