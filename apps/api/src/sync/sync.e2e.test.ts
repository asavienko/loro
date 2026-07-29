/**
 * Sync over HTTP, against a real Nest app.
 *
 * Boots the actual application and drives the endpoint the way a client does, so the
 * merge semantics are verified through the whole stack — controller, field policy,
 * and the Rust merge — not just at the unit level.
 */

import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../app.module.js'
import { ProblemDetailsFilter } from '../common/problem-filter.js'
import { mergeAvailable } from './merge.js'

const hlc = (
  physical: number,
  node_id: string,
): { physical: number; logical: number; node_id: string } => ({
  physical,
  logical: 0,
  node_id,
})

// Only the merge itself needs the WASM. Everything else — routing, validation, the
// readiness gate, content, AI — must be verified even on a checkout with no Rust
// toolchain, so the skip is per-test rather than on the whole suite.
const needsWasm = it.skipIf(!mergeAvailable())

describe('the API over HTTP', () => {
  let app: INestApplication
  let base: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('v1')
    app.useGlobalFilters(new ProblemDetailsFilter())
    await app.init()
    await app.listen(0)
    base = await app.getUrl()
  })

  afterAll(async () => {
    await app.close()
  })

  const post = async (path: string, body: unknown): Promise<Record<string, unknown>> => {
    const res = await fetch(`${base}/v1${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return (await res.json()) as Record<string, unknown>
  }

  it('serves health', async () => {
    const res = await fetch(`${base}/v1/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok' })
  })

  it('reports readiness from the real merge state, not a hard-coded ok', async () => {
    // A deploy that loses the WASM artifact still starts. Readiness is the only thing
    // standing between that build and live traffic, so it must check, not assume.
    const res = await fetch(`${base}/v1/health/ready`)
    const body = (await res.json()) as { status: string; checks: Record<string, string> }
    expect(body.checks['merge']).toBe(mergeAvailable() ? 'ok' : 'unavailable')
    expect(res.status).toBe(mergeAvailable() ? 200 : 503)
  })

  it('serves the content manifest with real counts', async () => {
    const res = await fetch(`${base}/v1/content/manifest`)
    const body = (await res.json()) as { phrase_count: number; lang: string; packs: unknown[] }
    expect(body.lang).toBe('es-ES')
    expect(body.phrase_count).toBeGreaterThanOrEqual(31)
    expect(body.packs.length).toBeGreaterThan(0)
  })

  needsWasm('reports the shared Rust merge as loaded', async () => {
    expect(await post('/sync/status', {})).toMatchObject({ merge: 'loro-core (wasm)' })
  })

  needsWasm('keeps the higher counter under `max`, even against a later clock', async () => {
    const id = `up_${Date.now()}`
    await post('/sync/push', {
      ops: [
        {
          seq: 1,
          entity: 'user_phrase',
          entity_id: id,
          op: 'upsert',
          fields: {
            reps: { v: 20, hlc: hlc(1000, 'a') },
            difficulty: { v: 'hard', hlc: hlc(1000, 'a') },
          },
        },
      ],
    })
    // Device B: a LOWER count with a LATER clock. LWW would lose two reps.
    await post('/sync/push', {
      ops: [
        {
          seq: 2,
          entity: 'user_phrase',
          entity_id: id,
          op: 'upsert',
          fields: {
            reps: { v: 18, hlc: hlc(9999, 'b') },
            difficulty: { v: 'easy', hlc: hlc(9999, 'b') },
          },
        },
      ],
    })

    const pulled = (await post('/sync/pull', {})) as {
      changes: { id: string; fields: Record<string, { v: unknown }> }[]
    }
    const row = pulled.changes.find((r) => r.id === id)
    expect(row).toBeDefined()
    expect(row?.fields['reps']?.v, 'max class must hold the higher count').toBe(20)
    expect(row?.fields['difficulty']?.v, 'lww class takes the later write').toBe('easy')
  })

  needsWasm('keeps two devices adding the same catalog phrase as two rows', async () => {
    // Row ids are per-learner UUIDv7s, not catalog ids (plans/04). If both devices sent
    // `entity_id: 'cafe1'` they would key the same row and per-field LWW would
    // interleave two independent add events into one — a data-loss bug invisible until
    // a second device exists. Here they send distinct row ids for the same `phraseId`.
    const stamp = Date.now()
    const rowA = `0197f2a0-${stamp % 10_000}-7000-8000-aaaaaaaaaaaa`
    const rowB = `0197f2a0-${stamp % 10_000}-7000-8000-bbbbbbbbbbbb`

    await post('/sync/push', {
      ops: [rowA, rowB].map((id, i) => ({
        seq: 20 + i,
        entity: 'user_phrase',
        entity_id: id,
        op: 'upsert',
        fields: {
          phraseId: { v: 'cafe1', hlc: hlc(1000 + i, i === 0 ? 'a' : 'b') },
          difficulty: { v: i === 0 ? 'hard' : 'easy', hlc: hlc(1000 + i, i === 0 ? 'a' : 'b') },
        },
      })),
    })

    const pulled = (await post('/sync/pull', {})) as {
      changes: { id: string; fields: Record<string, { v: unknown }> }[]
    }
    const a = pulled.changes.find((r) => r.id === rowA)
    const b = pulled.changes.find((r) => r.id === rowB)

    expect(a, 'device A kept its own row').toBeDefined()
    expect(b, 'device B kept its own row').toBeDefined()
    expect(a?.fields['phraseId']?.v).toBe('cafe1')
    expect(b?.fields['phraseId']?.v).toBe('cafe1')
    // The ratings did not interleave: each device's row still holds what it wrote.
    expect(a?.fields['difficulty']?.v).toBe('hard')
    expect(b?.fields['difficulty']?.v).toBe('easy')
  })

  it('rejects a field with no declared merge class rather than guessing', async () => {
    // This is the guard that stops an undeclared field becoming silent data loss.
    const res = (await post('/sync/push', {
      ops: [
        {
          seq: 9,
          entity: 'user_phrase',
          entity_id: 'up_guard',
          op: 'upsert',
          fields: { someNewField: { v: 1, hlc: hlc(1, 'a') } },
        },
      ],
    })) as { accepted: number[]; rejected: { code: string; field?: string }[] }

    expect(res.accepted).toEqual([])
    expect(res.rejected[0]).toMatchObject({ code: 'VALIDATION_FAILED', field: 'someNewField' })
  })

  it('rejects an unknown entity', async () => {
    const res = (await post('/sync/push', {
      ops: [{ seq: 10, entity: 'nope', entity_id: 'x', op: 'upsert', fields: {} }],
    })) as { rejected: { code: string }[] }
    expect(res.rejected[0]?.code).toBe('schema_unknown')
  })

  it('returns problem details without leaking internals', async () => {
    const res = await fetch(`${base}/v1/content/diff?from=banana`)
    expect(res.status).toBe(422)
    const body = (await res.json()) as Record<string, unknown>
    expect(body['code']).toBe('VALIDATION_FAILED')
    expect(JSON.stringify(body)).not.toContain('at ') // no stack frames
  })

  it('serves a valid roleplay scene, with exactly one best option per turn', async () => {
    const res = (await post('/ai/scene', { theme: 'Hotel' })) as {
      scene: { turns: { options: { best?: boolean; tip: string }[] }[] }
    }
    expect(res.scene.turns.length).toBeGreaterThanOrEqual(3)
    for (const turn of res.scene.turns) {
      expect(turn.options).toHaveLength(3)
      // The distinction between "that's how a local says it" and a coach note is
      // the pedagogical payload of the whole screen.
      expect(turn.options.filter((o) => o.best === true)).toHaveLength(1)
      for (const o of turn.options) expect(o.tip.length).toBeGreaterThan(10)
    }
  })
})
