/**
 * The server runs the SAME merge as the client.
 *
 * This is the property ADR-0002 exists to guarantee, and the one whose absence would
 * be most expensive: two implementations of a conflict-resolution rule diverge on some
 * edge case, and the divergence surfaces months later as a learner losing a rating, a
 * note, or a rep count.
 *
 * So the test loads the ACTUAL WASM build of `loro-core` — the same Rust that compiles
 * to the iOS static lib and the Android .so — and exercises it through the same shapes
 * the sync endpoint uses.
 *
 * See docs/architecture/sync-protocol.md and docs/architecture/backend.md#sync
 */

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const pkgPath = join(here, '../../../../packages/core-rs/pkg/loro_core.js')

interface Hlc {
  physical: number
  logical: number
  node_id: string
}
interface FieldValue {
  v: unknown
  hlc: Hlc
}
interface MergeOutcome {
  // serde-wasm-bindgen emits Rust maps as JS `Map`s, not plain objects.
  row: { entity: string; id: string; fields: Map<string, FieldValue>; deleted_at: number | null }
  changed: boolean
  conflicts: string[]
}
type MergeRow = (local: unknown, remote: unknown) => MergeOutcome

const available = existsSync(pkgPath)
const core = available ? (createRequire(import.meta.url)(pkgPath) as { merge_row: MergeRow }) : null

const hlc = (physical: number, node_id: string): Hlc => ({ physical, logical: 0, node_id })

function merge(
  local: Record<string, FieldValue>,
  remote: Record<string, FieldValue>,
  classes: Record<string, string>,
  opts: { localDeleted?: number; remoteDeleted?: number } = {},
): MergeOutcome {
  if (core === null) throw new Error('wasm not built')
  return core.merge_row(
    { entity: 'user_phrase', id: 'up_1', fields: local, deleted_at: opts.localDeleted ?? null },
    {
      entity: 'user_phrase',
      id: 'up_1',
      fields: remote,
      deleted_at: opts.remoteDeleted ?? null,
      classes,
    },
  )
}

// The build is required for the API's sync path. Skipped rather than failed when
// absent, so a UI-only contributor without a Rust toolchain isn't blocked.
describe.skipIf(!available)('loro-core merge, via WASM (the same code the client runs)', () => {
  it('keeps the higher counter under `max`, even against a later clock', () => {
    // THE case that motivates the Max class. Device A is at reps 20 offline; device B
    // reaches 18 with a later HLC. Last-write-wins would silently lose two reps.
    const out = merge(
      { reps: { v: 20, hlc: hlc(1000, 'a') } },
      { reps: { v: 18, hlc: hlc(9999, 'b') } },
      { reps: 'Max' },
    )
    expect(out.row.fields.get('reps')?.v).toBe(20)
    expect(out.changed).toBe(false)
  })

  it('takes the later write under `lww` — which is why counters must not be lww', () => {
    const out = merge(
      { reps: { v: 20, hlc: hlc(1000, 'a') } },
      { reps: { v: 18, hlc: hlc(9999, 'b') } },
      { reps: 'Lww' },
    )
    expect(out.row.fields.get('reps')?.v).toBe(18)
    expect(out.changed).toBe(true)
  })

  it('resolves a learner signal to the later write', () => {
    const out = merge(
      { difficulty: { v: 'med', hlc: hlc(1000, 'a') } },
      { difficulty: { v: 'hard', hlc: hlc(2000, 'b') } },
      { difficulty: 'Lww' },
    )
    expect(out.row.fields.get('difficulty')?.v).toBe('hard')
    expect(out.conflicts).toContain('difficulty')
  })

  it('lets a delete win over a concurrent edit at any clock', () => {
    // A learner who removed a phrase on their phone must not have it resurrected
    // by a stale edit from their tablet.
    const out = merge({ loved: { v: true, hlc: hlc(9999, 'a') } }, {}, {}, { remoteDeleted: 5000 })
    expect(out.row.deleted_at).toBe(5000)
  })

  it('is idempotent — replaying an op changes nothing', () => {
    const local = { difficulty: { v: 'med', hlc: hlc(1000, 'a') } }
    const remote = { difficulty: { v: 'hard', hlc: hlc(2000, 'b') } }
    const once = merge(local, remote, { difficulty: 'Lww' })
    expect(once.changed).toBe(true)

    const applied = Object.fromEntries(once.row.fields) as Record<string, FieldValue>
    const twice = merge(applied, remote, { difficulty: 'Lww' })
    expect(twice.changed).toBe(false)
    expect(twice.row.fields.get('difficulty')?.v).toBe('hard')
  })

  it('moves the FSRS group as a unit, never a mix of two devices', () => {
    // Taking `stability` from one device and `due` from another would produce a
    // scheduling state no algorithm ever computed.
    const out = merge(
      {
        srsStability: { v: 3.0, hlc: hlc(1000, 'a') },
        srsDue: { v: 1_000_000, hlc: hlc(1000, 'a') },
        srsLastReview: { v: 500, hlc: hlc(1000, 'a') },
      },
      {
        srsStability: { v: 7.5, hlc: hlc(2000, 'b') },
        srsDue: { v: 9_000_000, hlc: hlc(2000, 'b') },
        srsLastReview: { v: 1500, hlc: hlc(2000, 'b') },
      },
      {
        srsStability: 'LatestReview',
        srsDue: 'LatestReview',
        srsLastReview: 'LatestReview',
      },
    )
    expect(out.row.fields.get('srsStability')?.v).toBe(7.5)
    expect(out.row.fields.get('srsDue')?.v).toBe(9_000_000)
    expect(out.row.fields.get('srsLastReview')?.v).toBe(1500)
  })
})
