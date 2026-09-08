import { settingsValues, userPhraseValues, refrainDayValues } from './sync.js'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import * as target from './target.js'
import * as draft from './draft.js'
import { currentOperations, PullResponseSchema as CurrentPull } from './current.js'
import { FIELD_POLICY } from '../sync/fieldPolicy.js'
import { buildOpenApi, serializeOpenApi } from '../api-tooling/openapi.js'
import type { Operation } from './operation.js'

const id = '0197a001-0000-7000-8000-000000000001'
const other = '0197a001-0000-7000-8000-000000000002'
const hlc = '1721558400123:0007:device_1'
const field = <T>(v: T) => ({ v, hlc })
const upsert = {
  seq: 1,
  entity: 'user_phrase',
  entity_id: id,
  op: 'upsert',
  fields: { difficulty: field('hard') },
}
const request = { client_hlc: hlc, ops: [upsert] }
const line = { es: 'Un café, por favor.', en: 'A coffee, please.' }
const options = [
  { ...line, best: true, tip: 'A natural way to order.', phrase_id: 'cafe1' },
  { es: '¿Qué me recomienda?', en: 'What do you recommend?', tip: 'A useful question to ask.' },
  { es: '¿Tienen leche?', en: 'Do you have milk?', tip: 'Ask about available milk.' },
]
const scene = {
  place: 'Café',
  city: 'Madrid',
  emoji: '☕',
  role: 'Camarero',
  turns: Array.from({ length: 3 }, () => ({ npc: line, options })),
  closer: line,
}
const chatRequest = {
  request_id: id,
  thread_id: id,
  topic_id: 'cafe',
  pace: 'natural',
  locale: 'es-ES',
  turns: [{ id, speaker: 'learner', text: 'Un cafe.' }],
}
const feedback = {
  turn_id: id,
  original: 'Un cafe.',
  corrected: 'Un café.',
  corrections: [
    {
      start: 3,
      end: 7,
      before: 'cafe',
      replacement: 'café',
      explanation: 'The stress needs an accent.',
      kind: 'spelling',
      provenance: 'live',
    },
  ],
  alternatives: [],
  glosses: [],
  explanation: null,
  provenance: 'live',
}
const chatResponse = {
  request_id: id,
  provenance: 'live',
  degraded: false,
  safety: 'ok',
  reply: { ...line, id: other },
  suggestions: [],
  feedback: [feedback],
}

describe('target wire boundaries (F-04)', () => {
  it('validates identifiers, real calendar dates and Rust-compatible HLC bounds', () => {
    expect(target.RowIdSchema.safeParse(id).success).toBe(true)
    for (const bad of ['cafe1', 'up_123', id.replace('-7000', '-4000')])
      expect(target.RowIdSchema.safeParse(bad).success).toBe(false)
    for (const bad of ['2026-02-29', '2026-13-01', '2026-09-31', 'yesterday'])
      expect(target.LocalDateSchema.safeParse(bad).success).toBe(false)
    expect(target.LocalDateSchema.safeParse('2024-02-29').success).toBe(true)
    for (const bad of [
      '-1:0000:x',
      '1:0000:',
      '1:4294967296:x',
      '9999999999999999:0000:x',
      '1:0000:x:y',
    ])
      expect(target.HlcSchema.safeParse(bad).success).toBe(false)
    expect(target.HlcSchema.parse(hlc)).toBe(hlc)
    expect(target.PullRequestSchema.parse({ since: null }).limit).toBe(500)
    expect(target.PullRequestSchema.safeParse({ since: hlc }).success).toBe(false)
  })
  it('separates invalid envelopes, rejected operations and accepted work', () => {
    expect(() => target.validatePushBatch(null)).toThrow()
    expect(() =>
      target.validatePushBatch({ ...request, ops: Array.from({ length: 501 }, () => upsert) }),
    ).toThrow()
    const result = target.validatePushBatch({
      client_hlc: hlc,
      ops: [
        upsert,
        null,
        { ...upsert, seq: 2, fields: { audio_path: field('/recording') } },
        { seq: 3, entity: 'user_phrase', entity_id: id, op: 'delete', deleted_at: 5 },
        upsert,
      ],
    })
    expect(result.valid.map((op) => op.seq)).toEqual([1, 3])
    expect(result.rejected.map((r) => [r.index, r.seq])).toEqual([
      [1, null],
      [2, 2],
      [4, 1],
    ])
    expect(
      target.PushRequestSchema.safeParse({ ...request, user_id: 'someone_else' }).success,
    ).toBe(false)
  })
  it('requires complete FSRS groups and paired daily counters', () => {
    const fields = {
      srsStability: field(1.5),
      srsDifficulty: field(5),
      srsDue: field(2000),
      srsLastReview: field(1000),
      srsLapses: field(0),
      srsState: field('review'),
    }
    expect(target.UserPhraseFieldsSchema.safeParse(fields).success).toBe(true)
    for (const key of target.fsrsFields.filter((field) => field !== 'srsAlgorithm')) {
      const partial = Object.fromEntries(Object.entries(fields).filter(([name]) => name !== key))
      expect(target.UserPhraseFieldsSchema.safeParse(partial).success).toBe(false)
    }
    expect(target.UserPhraseFieldsSchema.safeParse({ repsToday: field(2) }).success).toBe(false)
    expect(
      target.UserPhraseFieldsSchema.safeParse({
        repsToday: field(2),
        repsTodayDay: field('2026-09-06'),
      }).success,
    ).toBe(true)
  })
  it('requires explicit tombstones in implemented and target sync', () => {
    expect(
      CurrentPull.safeParse({
        changes: [{ entity: 'user_phrase', entity_id: id, fields: {}, deleted_at: null }],
        next: 'opaque_cursor_example',
        server_hlc: hlc,
        has_more: false,
      }).success,
    ).toBe(true)
    expect(
      CurrentPull.safeParse({
        changes: [{ entity: 'user_phrase', id, fields: {} }],
        next: hlc,
        server_hlc: hlc,
        has_more: false,
      }).success,
    ).toBe(false)
    expect(
      target.ChangeSchema.safeParse({
        entity: 'user_phrase',
        entity_id: id,
        fields: {},
        deleted_at: 1,
      }).success,
    ).toBe(true)
    expect(
      target.ChangeSchema.safeParse({ entity: 'user_phrase', entity_id: id, fields: {} }).success,
    ).toBe(false)
    expect(target.PushOpSchema.safeParse({ ...upsert, op: 'delete', fields: {} }).success).toBe(
      false,
    )
  })
  it('covers all policy fields explicitly, including legacy exclusions and gated trip shapes', () => {
    const shapes = {
      ...target.syncValueShapes,
      trip: draft.tripValues,
      trip_drop: draft.tripDropValues,
      trip_phrase: draft.tripPhraseValues,
    }
    expect(Object.keys(shapes).sort()).toEqual(Object.keys(FIELD_POLICY).sort())
    for (const [entity, policy] of Object.entries(FIELD_POLICY)) {
      const shape = shapes[entity as keyof typeof shapes]
      if (Object.hasOwn(policy, '*')) {
        expect(Object.keys(shape).length).toBeGreaterThan(0)
        expect(Object.hasOwn(shape, '*')).toBe(false)
      } else {
        const keys = [
          ...Object.keys(shape),
          ...(entity === 'settings' ? target.excludedSettingsFields : []),
        ]
        expect(keys.sort()).toEqual(Object.keys(policy).sort())
      }
    }
  })
  it('rejects audio/transcript payloads even in append-only records', () => {
    const values = {
      phraseId: field(id),
      at: field(1),
      engine: field('prosody'),
      overall: field(null),
      melodyScore: field(null),
    }
    for (const name of [
      'audio',
      'audio_path',
      'pcm',
      'handle',
      'embedding',
      'transcript',
      'thread_text',
    ]) {
      expect(
        target.PushOpSchema.safeParse({
          ...upsert,
          entity: 'take',
          fields: { ...values, [name]: field('private') },
        }).success,
      ).toBe(false)
    }
    expect(
      target.PushOpSchema.safeParse({ ...upsert, entity: 'take', fields: values }).success,
    ).toBe(true)
    expect(
      target.PushOpSchema.safeParse({
        ...upsert,
        entity: 'trip',
        fields: { city: field('Madrid') },
      }).success,
    ).toBe(false)
    expect(
      draft.TripSyncOpSchema.safeParse({
        ...upsert,
        entity: 'trip',
        fields: { city: field('Madrid') },
      }).success,
    ).toBe(true)
  })
  it('matches problem code/status and preserves additive response compatibility', () => {
    expect(
      target.ProblemSchema.safeParse({
        type: 'https://loro.app/errors/unauthenticated',
        title: 'Authentication required',
        code: 'UNAUTHENTICATED',
        status: 500,
      }).success,
    ).toBe(false)
    expect(
      target.ProblemSchema.safeParse({
        type: 'https://loro.app/errors/schema-too-old',
        title: 'Update required',
        code: 'SCHEMA_TOO_OLD',
        status: 409,
      }).success,
    ).toBe(false)
    expect(
      target.PushResponseSchema.parse({
        accepted: [],
        rejected: [],
        conflicts: [],
        server_hlc: hlc,
        server_time: 1,
        future: true,
      })['future'],
    ).toBe(true)
  })
})

describe('AI and privacy contracts', () => {
  it('enforces target scene shape and pedagogical invariants', () => {
    expect(target.SceneSchema.safeParse(scene).success).toBe(true)
    expect(target.SceneSchema.safeParse({ ...scene, turns: scene.turns.slice(0, 1) }).success).toBe(
      false,
    )
    for (const badOptions of [
      options.map((o) => ({ ...o, best: false })),
      options.map((o) => ({ ...o, best: true })),
      [options[0], options[0], options[2]],
      [
        { ...options[0], es: Array.from({ length: 13 }, () => 'palabra').join(' ') },
        ...options.slice(1),
      ],
    ]) {
      expect(
        target.SceneSchema.safeParse({
          ...scene,
          turns: [{ npc: line, options: badOptions }, ...scene.turns.slice(1)],
        }).success,
      ).toBe(false)
    }
    expect(target.SceneEventSchema.safeParse({ event: 'token', data: 'unvalidated' }).success).toBe(
      false,
    )
    expect(
      target.SceneEventSchema.safeParse({
        event: 'completed',
        data: { scene_id: 'scene1', cached: false, fallback: true, provenance: 'bundled', scene },
      }).success,
    ).toBe(true)
  })
  it('represents missing translation confidence and enforces review', () => {
    const result = {
      status: 'available',
      index: 0,
      ...line,
      provenance: 'live',
      confidence: null,
      needs_review: true,
    }
    expect(target.TranslationSchema.safeParse(result).success).toBe(true)
    expect(target.TranslationSchema.safeParse({ ...result, needs_review: false }).success).toBe(
      false,
    )
    expect(
      target.TranslationSchema.safeParse({ ...result, confidence: 0.2, needs_review: false })
        .success,
    ).toBe(false)
    expect(target.TranslateResponseSchema.safeParse({ results: [result, result] }).success).toBe(
      false,
    )
    expect(() =>
      target.validateTranslationExchange(
        { lines: [line.es], source: 'es', target: 'en' },
        { results: [] },
      ),
    ).toThrow('every input')
    expect(
      target.validateTranslationExchange(
        { lines: [line.es], source: 'es', target: 'en' },
        { results: [result] },
      ).results,
    ).toHaveLength(1)
    expect(target.LatencySchema.safeParse(null).success).toBe(true)
    expect(target.ScoreSchema.safeParse(101).success).toBe(false)
    expect(target.ScoreSchema.safeParse(undefined).success).toBe(false)
  })
  it('requires feedback evidence and binds responses to request/turn IDs', () => {
    expect(draft.validateChatExchange(chatRequest, chatResponse)).toEqual(chatResponse)
    expect(() =>
      draft.validateChatExchange(chatRequest, { ...chatResponse, request_id: other }),
    ).toThrow('Stale')
    expect(() =>
      draft.validateChatExchange(chatRequest, {
        ...chatResponse,
        feedback: [{ ...feedback, turn_id: other }],
      }),
    ).toThrow('reference')
    expect(draft.ChatFeedbackSchema.safeParse({ ...feedback, corrected: 'Invented' }).success).toBe(
      false,
    )
    expect(
      draft.ChatFeedbackSchema.safeParse({
        ...feedback,
        corrections: [{ ...feedback.corrections[0], start: 2 }],
      }).success,
    ).toBe(false)
    expect(draft.ChatTurnRequestSchema.safeParse({ ...chatRequest, audio: 'bytes' }).success).toBe(
      false,
    )
    expect(
      draft.ChatTurnRequestSchema.safeParse({
        ...chatRequest,
        turns: Array.from({ length: 21 }, () => chatRequest.turns[0]),
      }).success,
    ).toBe(false)
  })
  it('requires topic graph references to resolve', () => {
    const node = {
      id: 'start',
      reply: line,
      suggestions: [{ ...line, id: 's1', next_node: 'start', register: 'neutral' }],
      glosses: [],
    }
    expect(
      draft.ChatTopicResourceSchema.safeParse({
        version: 1,
        topic_id: 'cafe',
        start_node: 'start',
        nodes: [node],
      }).success,
    ).toBe(true)
    expect(
      draft.ChatTopicResourceSchema.safeParse({
        version: 1,
        topic_id: 'cafe',
        start_node: 'missing',
        nodes: [node],
      }).success,
    ).toBe(false)
    expect(draft.BillingWebhookRequestSchema.safeParse({ event: 'pretend' }).success).toBe(false)
  })
  it('allows only registered analytics fields and excludes caller-controlled identity', () => {
    const context = {
      session_id: id,
      app_version: '1.0.0+1',
      platform: 'ios',
      os_version: '18.0',
      device_model: 'iPhone',
      locale: 'es-ES',
      active_engine: 'refrain',
      trip_active: false,
      offline: true,
    }
    const event = {
      event_id: id,
      client_ts: 1,
      context,
      name: 'phrase_produced',
      props: {
        phrase_id: 'cafe1',
        engine: 'refrain',
        mode: 'cold',
        latency_ms: null,
        verified_by: 'self',
        hints_used: 0,
      },
    }
    expect(target.EventSchema.safeParse(event).success).toBe(true)
    for (const bad of [
      { ...event, name: 'unknown_event' },
      { ...event, user_id: 'other' },
      { ...event, props: { ...event.props, transcript: 'secret' } },
      { ...event, props: { ...event.props, phrase_id: 'my private sentence' } },
    ])
      expect(target.EventSchema.safeParse(bad).success).toBe(false)
    expect(
      target.AnalyticsRequestSchema.safeParse({ events: Array.from({ length: 501 }, () => event) })
        .success,
    ).toBe(false)
  })
})

describe('registry and generated OpenAPI', () => {
  it('publishes only implemented routes in current and excludes drafts from stable exports', () => {
    expect(currentOperations).toHaveLength(25)
    expect(new Set(currentOperations.map((op) => op.status))).toEqual(new Set(['implemented']))
    expect(Object.keys(buildOpenApi('current').paths).sort()).toEqual(
      [...new Set(currentOperations.map((o) => o.path))].sort(),
    )
    expect('ChatTurnRequestSchema' in target).toBe(false)
    expect('TripSyncOpSchema' in target).toBe(false)
    expect(new Set(target.targetOperations.map((op) => op.status))).toEqual(new Set(['planned']))
    for (const op of draft.draftOperations) expect(op.unresolved?.length ?? 0).toBeGreaterThan(0)
  })
  it('publishes the authenticated runtime sync and session boundaries', () => {
    for (const id of ['syncPush', 'syncPull', 'syncStatus', 'authClaim']) {
      const operation = currentOperations.find((op) => op.id === id)
      expect(operation?.auth).toBe('bearer')
      expect(operation?.headers?.['X-Loro-Device']?.safeParse(undefined).success).toBe(false)
      expect(operation?.responses[200]).toBeDefined()
      expect(operation?.responses[201]).toBeUndefined()
    }
    expect(currentOperations.find((op) => op.id === 'syncPull')?.request?.schema).toBe(
      target.PullRequestSchema,
    )
    expect(currentOperations.find((op) => op.id === 'syncPush')?.request?.schema).toBe(
      target.PushRequestSchema,
    )
    const logout = buildOpenApi('current').paths['/auth/logout']?.['post']
    const response = z
      .object({ responses: z.record(z.string(), z.object({ content: z.unknown().optional() })) })
      .parse(logout)
    expect(response.responses['204']?.content).toBeUndefined()
    expect(currentOperations.find((op) => op.id === 'accountRead')?.auth).toBe('bearer')
  })
  it('validates examples, unique operation IDs, and path parameter coverage', () => {
    for (const operations of [
      currentOperations,
      [...target.targetOperations, ...draft.draftOperations],
    ] as readonly (readonly Operation[])[]) {
      expect(new Set(operations.map((op) => op.id)).size).toBe(operations.length)
      for (const op of operations) {
        const params = [...op.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]).sort()
        expect(Object.keys(op.pathParams ?? {}).sort()).toEqual(params)
        for (const payload of [op.request, ...Object.values(op.responses)].filter(
          (p) => p !== undefined,
        )) {
          for (const example of payload.examples ?? [])
            expect(
              payload.schema.safeParse(example.value).success,
              `${op.id}/${example.name}`,
            ).toBe(true)
        }
      }
    }
  })
  it('generates deterministically with resolvable local references and no body for 304', () => {
    for (const kind of ['current', 'target'] as const) {
      expect(serializeOpenApi(kind)).toBe(serializeOpenApi(kind))
      const document = buildOpenApi(kind)
      const json = serializeOpenApi(kind)
      for (const [, name] of json.matchAll(/"\$ref": "#\/components\/schemas\/([^"]+)"/g))
        expect(name !== undefined && Object.hasOwn(document.components.schemas, name)).toBe(true)
    }
    const manifest = buildOpenApi('target').paths['/content/manifest']?.['get']
    const response = z
      .object({ responses: z.record(z.string(), z.object({ content: z.unknown().optional() })) })
      .parse(manifest)
    expect(response.responses['304']?.content).toBeUndefined()
  })
})

it('F-08: language sync fields accept supported pairs and reject mismatched identities', () => {
  expect(
    settingsValues.languagePair.parse({ nativeLanguage: 'bg', targetLocale: 'ru-RU' }),
  ).toEqual({ nativeLanguage: 'bg', targetLocale: 'ru-RU' })
  expect(() =>
    settingsValues.languagePair.parse({ nativeLanguage: 'bg', targetLocale: 'bg-BG' }),
  ).toThrow()
  expect(userPhraseValues.targetLocale.parse('ru-RU')).toBe('ru-RU')
  expect(refrainDayValues.targetLocale.parse('bg-BG')).toBe('bg-BG')
  expect(() => userPhraseValues.ownMeaningLanguage.parse('de')).toThrow()
})
