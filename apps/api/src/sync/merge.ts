/**
 * The bridge to `loro-core`'s WASM build.
 *
 * The shared JSON bridge preserves nested objects and explicit null values across
 * WASM, matching the native bridge and the target sync wire.
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
  core_call: (method: string, inputJson: string) => string
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
  return core !== null && typeof core.core_call === 'function'
}

/** HLC arithmetic is canonical Rust, including backward wall-clock handling. */
export function advanceHlc(previous: string, wallMs: number, remote?: string): string {
  if (!core) throw new Error('loro-core wasm is not built')
  return JSON.parse(
    core.core_call(
      remote === undefined ? 'hlc_tick' : 'hlc_receive',
      JSON.stringify({
        previous,
        wallMs,
        nodeId: 'srv',
        ...(remote === undefined ? {} : { remote, clampRemote: true }),
      }),
    ),
  ) as string
}

export function clampHlc(value: string, wallMs: number): string {
  if (!core) throw new Error('loro-core wasm is not built')
  return JSON.parse(core.core_call('hlc_clamp', JSON.stringify({ value, wallMs }))) as string
}

export function decodeHlc(value: string): Hlc {
  const [physical, logical, node_id] = value.split(':')
  if (physical === undefined || logical === undefined || node_id === undefined)
    throw new Error('Invalid HLC')
  return { physical: Number(physical), logical: Number(logical), node_id }
}
export function encodeHlc(value: Hlc): string {
  return `${value.physical}:${String(value.logical).padStart(4, '0')}:${value.node_id}`
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
  return JSON.parse(
    core.core_call('merge_row', JSON.stringify({ local, remote: { ...remote, classes } })),
  ) as MergeOutcome
}
